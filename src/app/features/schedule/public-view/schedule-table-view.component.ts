import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { AssignmentRead, DutyLocation } from '../schedule';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

/**
 * Table view mode:
 * - byShift: Columns are SHIFTS, filter by LOCATIONS (default)
 * - byLocation: Columns are LOCATIONS, filter by SHIFTS
 */
export type TableViewMode = 'byShift' | 'byLocation';

interface ShiftHdr {
  id: number;
  name: string;
  timeRange?: string;
}

interface TableColumn {
  id: number;
  label: string;
  sublabel?: string;
  meta: {
    type: 'shift' | 'location';
    shift?: ShiftHdr;
    location?: DutyLocation;
  };
}

@Component({
  standalone: true,
  selector: 'app-schedule-table-view',
  imports: [
    CommonModule,
    DatePipe,
    OverlayPanelModule,
    ButtonModule,
    TooltipModule,
  ],
  templateUrl: './schedule-table-view.component.html',
  styleUrls: ['./schedule-table-view.component.scss'],
})
export class ScheduleTableViewComponent implements OnInit, OnChanges {
  @Input() from!: string;
  @Input() to!: string;
  @Input() shifts: ShiftHdr[] = [];
  @Input() locations: DutyLocation[] = [];
  @Input() assignments: AssignmentRead[] = [];
  @Input() selectedLocationId: number | null = null;
  @Input() selectedShiftId: number | null = null;

  // Emit current view mode to parent for filter control
  @Output() viewModeChange = new EventEmitter<TableViewMode>();

  // View mode: byShift (default) or byLocation
  viewMode: TableViewMode = 'byShift';
  currentColumns: TableColumn[] = [];
  todayKey = signal<string>(new Date().toISOString().substring(0, 10));

  ngOnInit(): void {
    // Always start with byShift mode (columns = shifts, filter = locations)
    this.viewMode = 'byShift';
    this.buildColumns();
    this.viewModeChange.emit(this.viewMode);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Rebuild columns when shifts or locations change
    if (changes['shifts'] || changes['locations']) {
      console.log(
        '[Table] ngOnChanges - shifts:',
        this.shifts?.length,
        'locations:',
        this.locations?.length
      );
      this.buildColumns();
    }
  }

  get days(): string[] {
    const days: string[] = [];
    if (!this.from || !this.to) return days;
    const start = new Date(this.from + 'T00:00:00');
    const end = new Date(this.to + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().substring(0, 10);
      days.push(iso);
    }
    return days;
  }

  /**
   * Build columns based on current view mode
   * - byShift: columns are SHIFTS
   * - byLocation: columns are LOCATIONS
   */
  buildColumns(): void {
    if (this.viewMode === 'byShift') {
      // COLUMNS = SHIFTS (filter by locations)
      this.currentColumns = this.shifts.map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: s.timeRange,
        meta: { type: 'shift' as const, shift: s },
      }));
    } else {
      // COLUMNS = LOCATIONS (filter by shifts)
      this.currentColumns = this.locations.map((l) => ({
        id: l.id,
        label: l.name,
        meta: { type: 'location' as const, location: l },
      }));
    }

    // Force new array reference for change detection
    this.currentColumns = [...this.currentColumns];
  }

  /**
   * Toggle between byShift and byLocation mode
   */
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'byShift' ? 'byLocation' : 'byShift';
    console.log('[Table] Toggle to mode:', this.viewMode);
    console.log('[Table] Shifts available:', this.shifts.length);
    console.log('[Table] Locations available:', this.locations.length);
    this.buildColumns();
    console.log(
      '[Table] Columns after build:',
      this.currentColumns.length,
      this.currentColumns.map((c) => c.label)
    );
    this.viewModeChange.emit(this.viewMode);
  }

  /**
   * Get assignments for a specific cell based on view mode
   */
  getAssignmentsForCell(date: string, columnId: number): AssignmentRead[] {
    let items: AssignmentRead[];

    if (this.viewMode === 'byShift') {
      // columnId = shiftId; filter by selected locations
      items = this.assignments.filter(
        (a) =>
          a.date === date &&
          a.shiftId === columnId &&
          (this.selectedLocationId == null ||
            a.locationId === this.selectedLocationId)
      );
    } else {
      // columnId = locationId; filter by selected shifts
      items = this.assignments.filter(
        (a) =>
          a.date === date &&
          a.locationId === columnId &&
          (this.selectedShiftId == null || a.shiftId === this.selectedShiftId)
      );
    }

    // Sort: leaders first, then by position level (lower = higher rank), then by name
    return items.sort((a, b) => {
      if (a.isLeader !== b.isLeader) {
        return (b.isLeader ? 1 : 0) - (a.isLeader ? 1 : 0);
      }
      if (a.positionLevel !== b.positionLevel) {
        return (a.positionLevel || 999) - (b.positionLevel || 999);
      }
      return a.userName.localeCompare(b.userName);
    });
  }

  /**
   * Legacy method for backward compatibility (deprecated)
   * @deprecated Use getAssignmentsForCell instead
   */
  getCell(date: string, shiftId: number): AssignmentRead[] {
    return this.getAssignmentsForCell(date, shiftId);
  }

  /**
   * Get toggle button label based on current mode
   */
  getToggleButtonLabel(): string {
    return this.viewMode === 'byShift'
      ? 'Xem theo địa điểm'
      : 'Xem theo ca trực';
  }

  /**
   * Get toggle button icon based on current mode
   */
  getToggleButtonIcon(): string {
    return this.viewMode === 'byShift' ? 'pi pi-map-marker' : 'pi pi-clock';
  }

  /**
   * Get current mode display label
   */
  getModeLabel(): string {
    return this.viewMode === 'byShift'
      ? 'Hiển thị theo ca trực'
      : 'Hiển thị theo địa điểm';
  }

  /**
   * Get mode description for tooltip
   */
  getModeDescription(): string {
    return this.viewMode === 'byShift'
      ? 'Cột là ca trực, lọc theo địa điểm'
      : 'Cột là địa điểm, lọc theo ca trực';
  }

  isToday(date: string): boolean {
    return date === this.todayKey();
  }

  getWeekday(date: string): string {
    const d = new Date(date + 'T00:00:00');
    const wd = d.getDay();
    if (wd === 0) return 'CN';
    return `THỨ ${wd + 1}`; // 1->THỨ 2 ... 6->THỨ 7
  }

  selectedAssignment: AssignmentRead | null = null;
  showAssignmentDetails(event: Event, assignment: AssignmentRead, op: any) {
    this.selectedAssignment = assignment;
    op.toggle(event);
  }

  getShiftLine(a: AssignmentRead): string {
    const parts: string[] = [];
    if (a.shiftName) parts.push(a.shiftName);
    if (a.shiftTimeRange) parts.push(a.shiftTimeRange);
    return parts.join(' ');
  }
}
