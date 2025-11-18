import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  Input,
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

export type RosterTableAxisMode = 'shift-columns' | 'location-columns';

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

  private readonly AXIS_MODE_KEY = 'rosterTableAxisMode';

  axisMode: RosterTableAxisMode = 'shift-columns';
  currentColumns: TableColumn[] = [];
  todayKey = signal<string>(new Date().toISOString().substring(0, 10));

  ngOnInit(): void {
    // Restore axis mode from localStorage
    const saved = localStorage.getItem(
      this.AXIS_MODE_KEY
    ) as RosterTableAxisMode | null;
    if (saved === 'location-columns' || saved === 'shift-columns') {
      this.axisMode = saved;
    }
    this.buildColumns();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Rebuild columns when shifts or locations change
    if (changes['shifts'] || changes['locations']) {
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
   * Build columns based on current axis mode
   */
  buildColumns(): void {
    if (this.axisMode === 'shift-columns') {
      // COLUMNS = SHIFTS (current mode)
      this.currentColumns = this.shifts.map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: s.timeRange,
        meta: { type: 'shift' as const, shift: s },
      }));
    } else {
      // COLUMNS = LOCATIONS
      this.currentColumns = this.locations.map((l) => ({
        id: l.id,
        label: l.name,
        meta: { type: 'location' as const, location: l },
      }));
    }
  }

  /**
   * Toggle between shift-columns and location-columns mode
   */
  toggleAxisMode(): void {
    this.axisMode =
      this.axisMode === 'shift-columns' ? 'location-columns' : 'shift-columns';
    this.persistAxisMode();
    this.buildColumns();
  }

  /**
   * Save axis mode to localStorage
   */
  private persistAxisMode(): void {
    localStorage.setItem(this.AXIS_MODE_KEY, this.axisMode);
  }

  /**
   * Get assignments for a specific cell based on axis mode
   */
  getAssignmentsForCell(date: string, columnId: number): AssignmentRead[] {
    let items: AssignmentRead[];

    if (this.axisMode === 'shift-columns') {
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
    return this.axisMode === 'shift-columns'
      ? 'Xem theo địa điểm'
      : 'Xem theo ca trực';
  }

  /**
   * Get toggle button icon based on current mode
   */
  getToggleButtonIcon(): string {
    return this.axisMode === 'shift-columns'
      ? 'pi pi-arrow-right-arrow-left'
      : 'pi pi-arrow-left-arrow-right';
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
