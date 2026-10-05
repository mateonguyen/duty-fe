import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DutyApiService } from '../../../core/api/duty-api.service';
import { OrgUnitNodeDto } from '../../../shared/models/org-unit';
import {
  DutyMonitoringDto,
  DutyShiftDto,
  RosterApiService,
} from '../roster-api.service';
import { SkeletonModule } from 'primeng/skeleton'; // retained for potential partial placeholders
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { trigger, transition, style, animate } from '@angular/animations';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { finalize } from 'rxjs';

/**
 * Live Monitoring Component
 *
 * Displays real-time duty monitoring with simplified UI:
 * - No shift grouping - focus on "who is on duty now"
 * - 2-tier layout: Unit → Location → Staff list
 * - Real-time clock display
 * - Auto-refresh with live time update
 * - Hierarchical unit filtering
 */
@Component({
  standalone: true,
  selector: 'app-live-monitor',
  imports: [
    CommonModule,
    FormsModule,
    SkeletonModule,
    LoadingSpinnerComponent,
    TooltipModule,
    CardModule,
    ButtonModule,
    BadgeModule,
  ],
  templateUrl: './live-monitor.component.html',
  styleUrls: ['./live-monitor.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class LiveMonitorComponent implements OnInit, OnDestroy {
  private api = inject(RosterApiService);
  private directory = inject(DutyApiService);
  private route = inject(ActivatedRoute);
  private element = inject(ElementRef<HTMLElement>);

  // State management
  // Unified page loading state (overlay spinner)
  loading = signal(false);
  units = signal<DutyMonitoringDto[]>([]);
  orgTree = signal<OrgUnitNodeDto[]>([]);
  private orgTreeLoaded = signal(false);
  private monitorLoaded = signal(false);
  selectedUnit = signal('');
  filterOpen = signal(false);
  expandedFilterUnits = new Set<string>();

  // Timer management
  refreshTimer: any;
  countdownTimer: any;
  clockTimer: any;
  countdown = signal(30);
  currentTime = signal<Date>(new Date());

  // Collapse state management
  collapsedUnits = new Map<string, boolean>();
  collapsedLocations = new Map<string, boolean>();

  // Form controls
  isLiveMode = signal(true);
  selectedTime: string = this.nowLocal();

  // Fullscreen state
  isFullscreen = signal(false);

  // Computed properties
  filterTree = computed(() => {
    const active = new Set(this.units().map(unit => unit.unitCode));
    const prune = (node: OrgUnitNodeDto): OrgUnitNodeDto | null => {
      const children = (node.children || []).map(prune).filter((child): child is OrgUnitNodeDto => child !== null);
      return active.has(node.code) || children.length ? { ...node, children } : null;
    };
    const tree = this.orgTree().map(prune).filter((node): node is OrgUnitNodeDto => node !== null);
    const included = new Set<string>();
    const visit = (node: OrgUnitNodeDto) => { included.add(node.code); node.children.forEach(visit); };
    tree.forEach(visit);
    return [...tree, ...this.units().filter(unit => !included.has(unit.unitCode)).map(unit => ({
      id: 0, code: unit.unitCode, name: unit.unitName, children: [],
    }))];
  });

  private unitHierarchy = computed(() => {
    const result = new Map<string, { order: number; parent: string }>();
    let order = 0;
    const visit = (nodes: OrgUnitNodeDto[], parent = '') => {
      for (const node of nodes) {
        result.set(node.code, { order: order++, parent });
        visit(node.children || [], node.name);
      }
    };
    visit(this.orgTree());
    return result;
  });

  selectedUnitLabel = computed(() => {
    const code = this.selectedUnit();
    if (!code) return `Tất cả đơn vị (${this.units().length})`;
    const find = (nodes: OrgUnitNodeDto[]): string | null => {
      for (const node of nodes) {
        if (node.code === code) return node.name;
        const child = find(node.children);
        if (child) return child;
      }
      return null;
    };
    return find(this.filterTree()) || code;
  });

  filteredUnits = computed(() => {
    const selected = this.selectedUnit();
    const all = this.units();
    if (!selected) return this.sortUnits(all);
    const codes = new Set<string>();
    const collect = (node: OrgUnitNodeDto) => { codes.add(node.code); node.children.forEach(collect); };
    const find = (nodes: OrgUnitNodeDto[]): boolean => {
      for (const node of nodes) {
        if (node.code === selected) { collect(node); return true; }
        if (find(node.children)) return true;
      }
      return false;
    };
    find(this.filterTree());
    return this.sortUnits(all.filter(unit => codes.has(unit.unitCode)));
  });

  private sortUnits(units: DutyMonitoringDto[]): DutyMonitoringDto[] {
    const hierarchy = this.unitHierarchy();
    return [...units].sort((a, b) =>
      (hierarchy.get(a.unitCode)?.order ?? Number.MAX_SAFE_INTEGER) - (hierarchy.get(b.unitCode)?.order ?? Number.MAX_SAFE_INTEGER)
      || a.unitName.localeCompare(b.unitName, 'vi'));
  }

  parentUnitName(code: string): string { return this.unitHierarchy().get(code)?.parent || ''; }

  unitStaffCount(unit: DutyMonitoringDto): number {
    return unit.locations.reduce((total, location) => total + this.getLocationStaff(location).leaders.length + this.getLocationStaff(location).staff.length, 0);
  }

  // Format current time for display
  formattedTime = computed(() => {
    const time = this.currentTime();
    return this.formatDisplayTime(time);
  });

  // Total stats across all units
  totalStats = computed(() => {
    const units = this.filteredUnits();
    let totalLocations = 0;
    let totalStaff = 0;
    let totalLeaders = 0;

    units.forEach((unit) => {
      totalLocations += unit.locations?.length || 0;
      unit.locations?.forEach((loc) => {
        const staffData = this.getLocationStaff(loc);
        totalLeaders += staffData.leaders.length;
        totalStaff += staffData.staff.length;
      });
    });

    return { totalLocations, totalStaff, totalLeaders };
  });

  ngOnInit(): void {
    // Read query params for unit filtering
    this.route.queryParams.subscribe((params) => {
      if (params['unitId']) {
        this.selectedUnit.set(params['unitId']);
      }
    });

    this.load();
    this.directory.getOrgTree().subscribe({
      next: tree => {
        this.orgTree.set(tree);
        tree.forEach(node => this.expandedFilterUnits.add(node.code));
        this.orgTreeLoaded.set(true);
        this.reconcileFilter();
      },
      error: () => { this.orgTree.set([]); this.orgTreeLoaded.set(true); this.reconcileFilter(); },
    });
    this.startAutoRefresh();
    this.startClock();
    this.setupFullscreenListener();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.stopClock();
  }

  @HostListener('document:click', ['$event'])
  closeFilterOnOutsideClick(event: MouseEvent): void {
    if (!this.element.nativeElement.querySelector('.unit-filter')?.contains(event.target as Node)) {
      this.filterOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeFilterOnEscape(): void {
    this.filterOpen.set(false);
  }

  /**
   * Start clock timer (updates every second)
   */
  private startClock(): void {
    this.clockTimer = setInterval(() => {
      if (this.isLiveMode()) this.currentTime.set(new Date());
    }, 1000);
  }

  /**
   * Stop clock timer
   */
  private stopClock(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  /**
   * Start 30-second auto-refresh with countdown
   */
  private startAutoRefresh(): void {
    this.countdown.set(30);
    this.refreshTimer = setInterval(() => this.load(false), 30000);
    this.countdownTimer = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.countdown.set(30);
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  /**
   * Stop all timers
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  /**
   * Toggle between live mode and custom time
   */
  toggleLiveMode(): void {
    this.isLiveMode.set(!this.isLiveMode());
    if (this.isLiveMode()) {
      this.currentTime.set(new Date());
      this.load();
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
      this.selectedTime = this.nowLocal();
      this.currentTime.set(new Date(this.selectedTime));
    }
  }

  /**
   * Handle custom time change
   */
  onTimeChange(): void {
    this.currentTime.set(new Date(this.selectedTime));
    this.load();
  }

  /**
   * Manual refresh - restart countdown
   */
  manualRefresh(): void {
    this.stopAutoRefresh();
    this.load();
    if (this.isLiveMode()) this.startAutoRefresh();
  }

  /**
   * Load monitoring data with skeleton loader
   */
  load(spin = true): void {
    if (spin) {
      this.loading.set(true);
    }

    // Reset countdown when loading
    this.countdown.set(30);

    // Use current time or selected time
    const timeToUse = this.isLiveMode()
      ? new Date()
      : new Date(this.selectedTime);
    const isoTimestamp = timeToUse.toISOString();

    this.api
      .getMonitoringLive({
        atTime: isoTimestamp,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.units.set(res);
          this.monitorLoaded.set(true);
          this.reconcileFilter();
        },
        error: () => {
          // errors handled by global/toasts elsewhere
        },
      });
  }

  private containsFilterCode(nodes: OrgUnitNodeDto[], code: string): boolean {
    return nodes.some(node => node.code === code || this.containsFilterCode(node.children, code));
  }

  private reconcileFilter(): void {
    if (this.orgTreeLoaded() && this.monitorLoaded() && this.selectedUnit()
      && !this.containsFilterCode(this.filterTree(), this.selectedUnit())) {
      this.selectedUnit.set('');
    }
  }

  selectFilterUnit(code: string): void {
    this.selectedUnit.set(code);
    this.filterOpen.set(false);
  }

  toggleFilterNode(code: string): void {
    this.expandedFilterUnits.has(code) ? this.expandedFilterUnits.delete(code) : this.expandedFilterUnits.add(code);
  }

  isFilterNodeExpanded(code: string): boolean {
    return this.expandedFilterUnits.has(code);
  }

  activeUnitCount(node: OrgUnitNodeDto): number {
    const active = this.units().some(unit => unit.unitCode === node.code) ? 1 : 0;
    return active + node.children.reduce((sum, child) => sum + this.activeUnitCount(child), 0);
  }

  /**
   * Format display time with day name
   */
  formatDisplayTime(date: Date): string {
    const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = days[date.getDay()];

    const pad = (n: number) => n.toString().padStart(2, '0');
    const dd = pad(date.getDate());
    const mm = pad(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());

    return `${dayName}, ${dd}/${mm}/${yyyy} – ${hh}:${min}`;
  }

  /**
   * Get all staff from a location (flattened from shifts)
   */
  getLocationStaff(location: any): { leaders: any[]; staff: any[] } {
    const leaders: any[] = [];
    const staff: any[] = [];

    // Flatten all roles from all shifts
    location.shifts?.forEach((shift: any) => {
      shift.roles?.forEach((role: any) => {
        if (role.isLeader) {
          leaders.push(role);
        } else {
          staff.push(role);
        }
      });
    });

    return { leaders, staff };
  }

  /**
   * Get location status: 'full' | 'partial' | 'empty'
   */
  getLocationStatus(location: any): {
    status: string;
    label: string;
    icon: string;
  } {
    const staffData = this.getLocationStaff(location);
    const total = staffData.leaders.length + staffData.staff.length;

    if (total === 0) {
      return { status: 'empty', label: 'Trống', icon: '🔴' };
    }

    // The API compares staffing with MinStaff and RequireLeader for each active shift.
    const shifts: DutyShiftDto[] = location.shifts || [];
    if (shifts.length > 0 && shifts.every((shift) => shift.status === 1)) {
      return { status: 'full', label: 'Đủ', icon: '🟢' };
    }

    return { status: 'partial', label: 'Thiếu', icon: '🟡' };
  }

  /**
   * Get initials from name for avatar
   */
  getInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (
      words[words.length - 2].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  }

  /**
   * Toggle unit collapse state
   */
  toggleUnit(unitCode: string): void {
    this.collapsedUnits.set(unitCode, !this.collapsedUnits.get(unitCode));
  }

  /**
   * Check if unit is collapsed
   */
  isUnitCollapsed(unitCode: string): boolean {
    return this.collapsedUnits.get(unitCode) || false;
  }

  /**
   * Toggle location collapse state
   */
  toggleLocation(unitCode: string, locationId: number): void {
    const key = `${unitCode}-${locationId}`;
    this.collapsedLocations.set(key, !this.collapsedLocations.get(key));
  }

  /**
   * Check if location is collapsed
   */
  isLocationCollapsed(unitCode: string, locationId: number): boolean {
    const key = `${unitCode}-${locationId}`;
    return this.collapsedLocations.get(key) || false;
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    if (!this.isFullscreen()) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }

  /**
   * Enter fullscreen mode
   */
  private enterFullscreen(): void {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }

    document.body.classList.add('monitoring-fullscreen');
    this.isFullscreen.set(true);
  }

  /**
   * Exit fullscreen mode
   */
  private exitFullscreen(): void {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }

    document.body.classList.remove('monitoring-fullscreen');
    this.isFullscreen.set(false);
  }

  /**
   * Setup fullscreen change listener (for ESC key)
   */
  private setupFullscreenListener(): void {
    document.addEventListener('fullscreenchange', () => {
      const fsElement = document.fullscreenElement;
      if (!fsElement) {
        document.body.classList.remove('monitoring-fullscreen');
        this.isFullscreen.set(false);
      }
    });
  }

  /**
   * Get current datetime in local format for input
   */
  private nowLocal(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }
}
