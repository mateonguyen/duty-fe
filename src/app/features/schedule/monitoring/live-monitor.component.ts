import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  DutyMonitoringDto,
  DutyShiftDto,
  RosterApiService,
} from '../roster-api.service';
import { ScopeService, ScopeRef } from '../../../core/services/scope.service';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { trigger, transition, style, animate } from '@angular/animations';

/**
 * Live Monitoring Component
 *
 * Displays real-time duty monitoring with simplified UI:
 * - No shift grouping - focus on "who is on duty now"
 * - 2-tier layout: Unit → Location → Staff list
 * - Real-time clock display
 * - Auto-refresh with live time update
 * - Multi-select unit filtering
 */
@Component({
  standalone: true,
  selector: 'app-live-monitor',
  imports: [
    CommonModule,
    FormsModule,
    MultiSelectModule,
    SkeletonModule,
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
  private scopeService = inject(ScopeService);
  private route = inject(ActivatedRoute);

  // State management
  loading = signal(false);
  showSkeleton = signal(false);
  units = signal<DutyMonitoringDto[]>([]);
  scopes = signal<ScopeRef[]>([]);
  selectedUnits = signal<string[]>([]);

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
  filteredUnits = computed(() => {
    const selected = this.selectedUnits();
    const all = this.units();
    if (selected.length === 0) return all;
    return all.filter((u) => selected.includes(u.unitCode));
  });

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
        this.selectedUnits.set([params['unitId']]);
      }
    });

    this.scopeService.load('roster.view').subscribe({
      next: (items) => this.scopes.set(items),
      error: () => this.scopes.set([]),
    });
    this.load();
    this.startAutoRefresh();
    this.startClock();
    this.setupFullscreenListener();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.stopClock();
  }

  /**
   * Start clock timer (updates every second)
   */
  private startClock(): void {
    this.clockTimer = setInterval(() => {
      this.currentTime.set(new Date());
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
    this.startAutoRefresh();
  }

  /**
   * Load monitoring data with skeleton loader
   */
  load(spin = true): void {
    if (spin) {
      this.loading.set(true);
      this.showSkeleton.set(true);
      // Minimum 2s skeleton display for better UX
      setTimeout(() => this.showSkeleton.set(false), 2000);
    }

    // Reset countdown when loading
    this.countdown.set(30);

    const selected = this.selectedUnits();
    const unitCode = selected.length === 1 ? selected[0] : undefined;

    // Use current time or selected time
    const timeToUse = this.isLiveMode()
      ? new Date()
      : new Date(this.selectedTime);
    const isoTimestamp = timeToUse.toISOString();

    this.api
      .getMonitoringLive({
        atTime: isoTimestamp,
        unitCode: unitCode,
      })
      .subscribe({
        next: (res) => {
          this.units.set(res);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.showSkeleton.set(false);
        },
      });
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

    // Check if all required roles are filled
    let requiredRoles = 0;
    let filledRoles = 0;

    location.shifts?.forEach((shift: any) => {
      shift.roles?.forEach((role: any) => {
        requiredRoles++;
        if (role.staffDisplayName) filledRoles++;
      });
    });

    if (filledRoles === requiredRoles && requiredRoles > 0) {
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
