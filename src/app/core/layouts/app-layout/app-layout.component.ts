import { Component, computed, inject, signal } from '@angular/core';
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
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { ScopeService } from '../../services/scope.service';

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
  ],
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.scss'],
})
export class AppLayoutComponent {
  private router = inject(Router);
  auth = inject(AuthService);
  private scopes = inject(ScopeService);

  // Signal to track current URL and trigger re-computation
  private currentUrl = signal(this.router.url);

  // Signal to track if user menu is open
  isUserMenuOpen = signal(false);

  // Preference: if true => when menu is OPEN show chevron-down; when CLOSED show chevron-up
  // if false (default common pattern) => when OPEN show chevron-up; when CLOSED show chevron-down
  chevronDownWhenOpen = true;

  constructor() {
    // Update signal on navigation
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
      });
  }

  userItems = [
    { label: 'Hồ sơ cá nhân', icon: 'pi pi-user' },
    { label: 'Đổi mật khẩu', icon: 'pi pi-lock' },
    { separator: true },
    {
      label: 'Đăng xuất',
      icon: 'pi pi-sign-out',
      command: () => this.auth.logout(),
    },
  ];

  // permission có thể là string hoặc string[]
  // Note: 'Quản trị' group requires 'admin.view' to be visible at all
  private raw = signal<MenuItem[]>([
    {
      label: 'Quản trị',
      icon: 'pi pi-cog',
      permission: ['catalog.manage', 'user.manage', 'role.assign'], // entire group hidden unless user has this
      items: [
        { label: 'Danh mục', disabled: true, styleClass: 'menu-group' },
        {
          label: 'Địa điểm trực',
          routerLink: '/admin/catalog/duty-locations',
          icon: 'pi pi-map-marker',
          permission: 'catalog.manage',
        },
        {
          label: 'Ca trực',
          routerLink: '/admin/catalog/shifts',
          icon: 'pi pi-clock',
          permission: 'catalog.manage',
        },
        {
          label: 'Vai trò trực',
          routerLink: '/admin/catalog/duty-roles',
          icon: 'pi pi-verified',
          permission: 'catalog.manage',
        },
        { separator: true },
        { label: 'Quản trị', disabled: true, styleClass: 'menu-group' },
        {
          label: 'Vai trò',
          routerLink: '/admin/access/roles',
          icon: 'pi pi-key',
          permission: 'user.manage',
        },
        {
          label: 'Gán vai trò',
          routerLink: '/admin/access/user-roles',
          icon: 'pi pi-user-edit',
          permission: 'role.assign',
        },
        {
          label: 'Cấu hình hệ thống',
          routerLink: '/admin/system-config',
          icon: 'pi pi-cog',
          permission: 'user.manage',
        },
      ],
    },
    {
      label: 'Lịch trực',
      icon: 'pi pi-calendar',
      permission: ['roster.view', 'roster.create'],
      items: [
        {
          label: 'Danh sách kỳ lịch',
          routerLink: '/schedule/rosters',
          icon: 'pi pi-list',
          permission: 'roster.view',
        },
        {
          label: 'Tạo kỳ lịch mới',
          routerLink: '/schedule/rosters/new',
          icon: 'pi pi-calendar-plus',
          permission: 'roster.create',
        },
        { separator: true },
        {
          label: 'Xem lịch công khai',
          routerLink: '/schedule/public',
          icon: 'pi pi-eye',
          permission: 'roster.create',
        },
      ],
    },
    {
      label: 'Báo cáo',
      icon: 'pi pi-chart-bar',
      permission: 'report.view',
      items: [
        {
          label: 'Tổng hợp theo ca',
          routerLink: '/reports/by-shift',
          icon: 'pi pi-chart-line',
          permission: 'report.view',
        },
        {
          label: 'Theo cán bộ',
          routerLink: '/reports/by-user',
          icon: 'pi pi-users',
          permission: 'report.view',
        },
      ],
    },
  ]);

  // menubar sẽ dùng cái này để luôn có class active đúng
  menuItems = computed<MenuItem[]>(() => {
    // Force dependency on currentUrl and whoami snapshot so menu re-renders on navigation or permission change
    const url = this.currentUrl();
    const snapshot = this.auth.whoamiSnapshot();
    void url; // use to trigger recomputation
    void snapshot; // use to trigger recomputation

    // Helper: kiểm tra quyền (string hoặc string[])
    const hasPerm = (perm?: string | string[]) => {
      if (!perm) return true;
      if (Array.isArray(perm)) return this.auth.hasAnyPermission(perm);
      return this.auth.hasPermission(perm);
    };

    // Filter menu: recursively filter items based on permissions
    const filterMenu = (items: MenuItem[]): MenuItem[] =>
      items
        .map((mi) => {
          const itemPerm = (mi as any).permission;

          // Check parent permission first - if parent fails, entire group is hidden
          if (!hasPerm(itemPerm)) {
            return null;
          }

          // Recursively filter children
          let filteredItems = mi.items ? filterMenu(mi.items) : undefined;

          // If this is a leaf item (no children)
          if (!mi.items) {
            // Set active class if this item's route matches
            return {
              ...mi,
              styleClass: this.buildStyleClass(mi),
            };
          }

          // If this is a parent with children, only keep if children exist after filtering
          if (filteredItems && filteredItems.length > 0) {
            return {
              ...mi,
              styleClass: this.buildStyleClass(mi, filteredItems),
              items: filteredItems,
            };
          }

          // Parent with no valid children and no own routerLink -> hide
          if (!mi.routerLink) {
            return null;
          }

          // Parent has routerLink and passed permission check -> keep as leaf
          return {
            ...mi,
            items: undefined,
            styleClass: this.buildStyleClass(mi),
          };
        })
        .filter(Boolean) as MenuItem[];

    return filterMenu(this.raw());
  });

  private buildStyleClass(item: MenuItem, children?: MenuItem[]): string {
    const classes: string[] = [];

    // Preserve existing styleClass
    if (item.styleClass) {
      classes.push(item.styleClass);
    }

    // Add active class if this item or any child is active
    if (item.routerLink && this.isActive(item.routerLink)) {
      classes.push('app-menu-active');
    } else if (
      children?.some((c) => c.routerLink && this.isActive(c.routerLink))
    ) {
      classes.push('app-menu-active');
    }

    return classes.join(' ');
  }

  // Active scope display (prefer roster.create, fallback to roster.view)
  activeScopeName = computed(() => {
    const s1 = this.scopes.getActiveScope('roster.create');
    const s2 = this.scopes.getActiveScope('roster.view');
    return s1?.displayName || s2?.displayName || '';
  });

  private isActive(link: any): boolean {
    if (!link) return false;
    // Root path must be exact match only
    if (typeof link === 'string' && (link === '/' || link === '')) {
      return this.router.url === '/' || this.router.url === '';
    }
    // Other routes: prefix match
    return this.router.isActive(link, false);
  }
}
