import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
  effect,
  AfterViewInit,
  ElementRef,
  HostListener,
} from '@angular/core';
import { fromEvent, Subscription as RxSubscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  NavigationEnd,
} from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs';
import { finalize, interval, Subscription, switchMap, EMPTY } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { ScopeService } from '../../services/scope.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { NotificationDto } from '../../../shared/models/notification.model';
import { MenuService } from '../../services/menu.service';

@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet,
    MenubarModule,
    AvatarModule,
    MenuModule,
    RouterLinkActive,
    BadgeModule,
    TooltipModule,
    ButtonModule,
  ],
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.scss'],
})
export class AppLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private elementRef = inject(ElementRef<HTMLElement>);
  public auth: AuthService = inject(AuthService);
  private scopes: ScopeService = inject(ScopeService);
  private notificationService: NotificationService =
    inject(NotificationService);
  private menuService = inject(MenuService);

  // Signal to track current URL and trigger re-computation
  private currentUrl = signal(this.router.url);
  isRosterEditorRoute = computed(() => {
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    return path === '/schedule/rosters/new' || /^\/schedule\/rosters\/[^/]+\/edit$/.test(path);
  });
  menuSearch = signal('');
  menuSearchOpen = signal(false);
  menuSearchIndex = signal(0);
  menuSearchResults = computed(() => {
    const query = this.normalizeSearch(this.menuSearch().trim());
    if (!query) return [];
    const routes: { label: string; group: string; url: string; icon?: string }[] = [
      { label: 'Trang chủ', group: 'Chung', url: '/', icon: 'pi pi-home' },
    ];
    const collect = (items: MenuItem[], group: string) => {
      for (const item of items) {
        const label = item.label || '';
        if (item.routerLink && !item.disabled) {
          routes.push({ label, group, url: String(item.routerLink), icon: item.icon });
        }
        if (item.items?.length) collect(item.items, group || label);
      }
    };
    for (const item of this.menuItems()) collect(item.items || [item], item.label || 'Chung');
    return routes.filter((route) => this.normalizeSearch(`${route.label} ${route.group}`).includes(query)).slice(0, 8);
  });

  private normalizeSearch(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  }

  onMenuSearchInput(event: Event): void {
    this.menuSearch.set((event.target as HTMLInputElement).value);
    this.menuSearchIndex.set(0);
    this.menuSearchOpen.set(true);
  }

  onMenuSearchKeydown(event: KeyboardEvent): void {
    const results = this.menuSearchResults();
    if (event.key === 'Escape') {
      this.menuSearchOpen.set(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      this.menuSearchIndex.set((this.menuSearchIndex() + delta + results.length) % results.length);
    }
    if (event.key === 'Enter' && results.length) {
      event.preventDefault();
      this.openMenuSearchResult(results[this.menuSearchIndex()]?.url || results[0].url);
    }
  }

  openMenuSearchResult(url: string): void {
    this.menuSearch.set('');
    this.menuSearchOpen.set(false);
    void this.router.navigateByUrl(url);
  }

  @HostListener('document:click', ['$event'])
  closeMenuSearchOnOutsideClick(event: MouseEvent): void {
    if (!(event.target instanceof Node) || !this.elementRef.nativeElement.querySelector('.search-wrapper')?.contains(event.target)) {
      this.menuSearchOpen.set(false);
    }
  }

  // Signal to track if user menu is open
  isUserMenuOpen = signal(false);

  // Notification dropdown state
  isNotificationMenuOpen = signal(false);
  notifications = signal<NotificationDto[]>([]);
  totalUnread = signal(0);
  loadingNotifications = signal(false);
  notificationError = signal('');
  private refreshSubscription?: Subscription;
  private resizeSub?: RxSubscription;

  // Preference: if true => when menu is OPEN show chevron-down; when CLOSED show chevron-up
  // if false (default common pattern) => when OPEN show chevron-up; when CLOSED show chevron-down
  chevronDownWhenOpen = true;

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) this.loadNotifications();
    });
    // Update signal on navigation
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.menuSearchOpen.set(false);
        // Close notification dropdown on navigation
        this.isNotificationMenuOpen.set(false);
      });
  }

  // BFF Mode: Get org unit from user profile (stored in auth.service)
  orgUnitName = computed(() => {
    const user = this.auth.user();
    return (user as any)?.orgUnitName || '';
  });

  orgUnitCode = computed(() => {
    const user = this.auth.user();
    return (user as any)?.orgUnitCode || '';
  });

  positionTitle = computed(() => {
    const user = this.auth.user();
    return (user as any)?.positionTitle || '';
  });

  fullName = computed(() => {
    const user = this.auth.user();
    return (user as any)?.fullName || '';
  });

  isLeader = computed(() => {
    const user = this.auth.user();
    return !!(user as any)?.isLeader;
  });

  // User display name from BFF (fullName -> username)
  userDisplayName = computed(
    () => this.auth.fullName() || this.auth.username() || '',
  );

  // Scope chip prefers active scope service name, else JWT org unit claims
  scopeDisplay = computed(() => {
    const active = this.activeScopeName();
    if (active) return active;
    const name = this.orgUnitName();
    if (name) return name;
    const code = this.orgUnitCode();
    if (code) return code;
    return '—';
  });

  ngOnInit(): void {
    // Poll every 2 minutes
    this.refreshSubscription = interval(120000).subscribe(() => {
      if (this.auth.isAuthenticated()) {
        this.loadNotifications();
      }
    });
  }

  ngAfterViewInit(): void {
    this.updateNavbarMetrics();
    // Update on resize to keep CSS vars accurate
    this.resizeSub = fromEvent(window, 'resize').subscribe(() =>
      this.updateNavbarMetrics(),
    );
  }

  // Removed: authReady debug effect (BFF mode uses only isAuthenticated)

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.resizeSub?.unsubscribe();
  }

  userItems = [
    {
      label: 'Hồ sơ cá nhân',
      icon: 'pi pi-user',
      command: () => this.router.navigate(['/account/profile']),
    },
    {
      label: 'Đổi mật khẩu',
      icon: 'pi pi-lock',
      command: () => this.router.navigate(['/account/change-password']),
    },
    {
      label: 'Hướng dẫn sử dụng',
      icon: 'pi pi-book',
      command: () => this.router.navigate(['/help/user-guide']),
    },
    { separator: true },
    {
      label: 'Đăng xuất',
      icon: 'pi pi-sign-out',
      command: () => this.auth.logout(),
    },
  ];

  // Toggle custom user dropdown
  toggleUserMenu() {
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  // Handle item click; execute command if present then close menu
  onUserItemClick(item: MenuItem) {
    if (item.separator) return;
    if (item.command) {
      item.command({ originalEvent: new Event('click'), item });
    }
    this.isUserMenuOpen.set(false);
  }

  // Notification dropdown methods
  toggleNotificationMenu(): void {
    const isOpen = this.isNotificationMenuOpen();
    this.isNotificationMenuOpen.set(!isOpen);
    if (!isOpen) {
      // Reload when opening
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.notificationError.set('');
    this.loadingNotifications.set(true);
    this.notificationService
      .getMyNotifications(5)
      .pipe(finalize(() => this.loadingNotifications.set(false)))
      .subscribe({
        next: (data) => {
          this.notifications.set(data.items || []);
          this.totalUnread.set(data.totalUnread || 0);
          console.log('[AppLayout] Notifications loaded:', {
            count: data.items?.length ?? 0,
            unread: data.totalUnread ?? 0,
          });
        },
        error: (err) => {
          // ✅ NON-BLOCKING: Log but don't crash, just set empty state
          console.warn(
            '[AppLayout] Failed to load notifications (non-blocking):',
            err,
          );
          this.notificationError.set('Chưa tải được thông báo. Hãy thử lại.');
          // Don't show error banner - notifications are not critical for app function
        },
      });
  }

  onNotificationClick(notification: NotificationDto): void {
    // Mark as read
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          notification.isRead = true;
          this.totalUnread.set(Math.max(0, this.totalUnread() - 1));
        },
        error: (err) => console.error('Failed to mark as read', err),
      });
    }

    // Close dropdown
    this.isNotificationMenuOpen.set(false);

    // Navigate if linkUrl provided
    if (notification.linkUrl) {
      this.router.navigateByUrl(notification.linkUrl);
    }
  }

  markAllNotificationsAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications().forEach((n) => (n.isRead = true));
        this.totalUnread.set(0);
      },
      error: (err) => console.error('Failed to mark all as read', err),
    });
  }

  formatNotificationDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  // menubar sẽ dùng cái này để luôn có class active đúng
  // Now powered by MenuService for consistency with admin sidebar
  menuItems = computed<MenuItem[]>(() => {
    const baseMenu = this.menuService.getTopBarMenu()();
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    const activeRoute = this.findActiveMenuRoute(baseMenu, path);
    return this.addActiveClasses(baseMenu, activeRoute);
  });

  private findActiveMenuRoute(items: MenuItem[], path: string): string | null {
    let best: string | null = null;
    const visit = (entries: MenuItem[]) => {
      for (const item of entries) {
        if (item.routerLink) {
          const route = String(item.routerLink).replace(/\/$/, '') || '/';
          if ((path === route || path.startsWith(`${route}/`)) && (!best || route.length > best.length)) {
            best = route;
          }
        }
        if (item.items?.length) visit(item.items);
      }
    };
    visit(items);
    return best;
  }

  private addActiveClasses(items: MenuItem[], activeRoute: string | null): MenuItem[] {
    return items.map((item) => {
      const styleClass = this.buildStyleClass(
        item,
        activeRoute,
        item.items as MenuItem[] | undefined,
      );

      return {
        ...item,
        styleClass,
        items: item.items ? this.addActiveClasses(item.items, activeRoute) : undefined,
      };
    });
  }

  private buildStyleClass(item: MenuItem, activeRoute: string | null, children?: MenuItem[]): string {
    const classes: string[] = [];
    // Preserve existing styleClass
    if (item.styleClass) {
      classes.push(item.styleClass);
    }

    // Add active class if this item or any child is active
    if (activeRoute && item.routerLink === activeRoute) {
      classes.push('app-menu-active');
    } else if (activeRoute && children?.some((c) => this.hasActiveRoute(c, activeRoute))) {
      classes.push('app-menu-active');
    }

    return classes.join(' ');
  }

  private hasActiveRoute(item: MenuItem, activeRoute: string): boolean {
    return item.routerLink === activeRoute || !!item.items?.some((child) => this.hasActiveRoute(child, activeRoute));
  }

  // Active scope display (prefer roster.create, fallback to roster.view)
  activeScopeName = computed(() => {
    const s1 = this.scopes.getActiveScope('roster.create');
    const s2 = this.scopes.getActiveScope('roster.view');
    return s1?.displayName || s2?.displayName || '';
  });

  /**
   * Measure navbar height and update CSS variables for page offsets.
   * - --app-navbar-height: actual navbar height in px
   * - --app-top-offset: 0 if navbar is fixed (content already padded), else navbar height
   */
  private updateNavbarMetrics(): void {
    const navbar = document.getElementById('app-navbar');
    if (!navbar) return;

    const height = navbar.offsetHeight || 0;
    const computedStyle = getComputedStyle(navbar);
    const position = computedStyle.position;

    const root = document.documentElement;
    root.style.setProperty('--app-navbar-height', `${height}px`);

    const isFixed = position === 'fixed';
    const topOffset = isFixed ? '0px' : `${height}px`;
    root.style.setProperty('--app-top-offset', topOffset);
  }
}
