import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { AssignmentRead, DayKey, SimpleUser } from '../../schedule';

type CellExtra = string | string[] | Record<string, boolean> | null | undefined;

@Component({
  standalone: true,
  selector: 'app-month-board',
  imports: [
    CommonModule,
    ButtonModule,
    DragDropModule,
    OverlayPanelModule,
    DialogModule,
    TooltipModule,
  ],
  templateUrl: './month-board.component.html',
  styleUrls: ['./month-board.component.scss'],
})
export class MonthBoardComponent {
  // Max assignments to show per cell before showing "+X"
  private readonly MAX_VISIBLE_ASSIGNMENTS = 2;

  // Chuyển thành signal để computed có thể track
  private _from = signal<string>('');
  private _to = signal<string>('');

  // Track selected assignment for popover
  selectedAssignment = signal<AssignmentRead | null>(null);
  selectedDayKey = signal<string | null>(null);
  dayDialogOpen = signal(false);

  @Input() set from(val: string) {
    this._from.set(val);
  }
  get from() {
    return this._from();
  }

  @Input() set to(val: string) {
    this._to.set(val);
  }
  get to() {
    return this._to();
  }

  @Input() selectedShiftId: number | null = null;
  @Input() selectedLocationId: number | null = null;
  @Input() selectedShiftName = '';
  @Input() selectedLocationName = '';
  @Input() assignments: AssignmentRead[] = [];
  @Input() readOnly = false;
  @Input() selectedUser: SimpleUser | null = null;

  @Output() quickAdd = new EventEmitter<string>(); // dateKey
  @Output() remove = new EventEmitter<AssignmentRead>();
  @Output() commanderChange = new EventEmitter<AssignmentRead>();
  @Output() staffDropped = new EventEmitter<{ user: any; date: string }>();
  onStaffDrop(event: CdkDragDrop<any>, d: any) {
    if (!d.inRange || this.readOnly) return;
    const user = event.item.data;
    this.staffDropped.emit({ user, date: d.key });
  }

  // build grid (4–6 tuần) từ from/to
  weeks = computed(() => {
    const start = new Date(this._from());
    const end = new Date(this._to());
    const first = startOfWeek(start);
    const last = endOfWeek(end);
    const days: { date: Date; key: string; inRange: boolean }[] = [];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const key = toKey(d);
      days.push({
        date: new Date(d),
        key,
        inRange: key >= this._from() && key <= this._to(),
      });
    }
    // chunk 7
    const res: (typeof days)[] = [];
    for (let i = 0; i < days.length; i += 7) res.push(days.slice(i, i + 7));
    return res;
  });

  cellAssignments(dayKey: string) {
    if (!this.selectedShiftId) return [];
    const filtered = this.assignments.filter(
      (a) =>
        a.date === dayKey &&
        a.shiftId === this.selectedShiftId &&
        (this.selectedLocationId == null ||
          a.locationId === this.selectedLocationId)
    );
    return this.sortAssignments(filtered);
  }

  private sortAssignments(list: AssignmentRead[]): AssignmentRead[] {
    return [...list].sort((a, b) => {
      // First priority: leaders before staff
      const aLeader = !!a.isLeader;
      const bLeader = !!b.isLeader;
      if (aLeader !== bLeader) return aLeader ? -1 : 1;

      // Second priority: sort by positionLevel (lower C_LEVEL = higher rank, e.g., 1=Director)
      const aLevel = a.positionLevel ?? 999; // Default to high number if null
      const bLevel = b.positionLevel ?? 999;
      if (aLevel !== bLevel) return aLevel - bLevel;

      // Fallback: alphabetical by name
      return (a.userName || '').localeCompare(b.userName || '');
    });
  }

  leaderAssignments(dayKey: string): AssignmentRead[] {
    return this.cellAssignments(dayKey).filter((a) => a.isLeader);
  }

  staffAssignments(dayKey: string): AssignmentRead[] {
    return this.cellAssignments(dayKey).filter((a) => !a.isLeader);
  }

  // Get visible leaders (limited by MAX_VISIBLE_ASSIGNMENTS)
  visibleLeaders(dayKey: string): AssignmentRead[] {
    const leaders = this.leaderAssignments(dayKey);
    const staff = this.staffAssignments(dayKey);
    const total = leaders.length + staff.length;

    if (total <= this.MAX_VISIBLE_ASSIGNMENTS) {
      return leaders;
    }

    // Show at least 1 leader if exists, rest for staff
    const maxLeaders = Math.min(
      leaders.length,
      Math.max(1, this.MAX_VISIBLE_ASSIGNMENTS - staff.length)
    );
    return leaders.slice(0, maxLeaders);
  }

  // Get visible staff (limited by remaining space after leaders)
  visibleStaff(dayKey: string): AssignmentRead[] {
    const leaders = this.leaderAssignments(dayKey);
    const staff = this.staffAssignments(dayKey);
    const total = leaders.length + staff.length;

    if (total <= this.MAX_VISIBLE_ASSIGNMENTS) {
      return staff;
    }

    const visibleLeaderCount = this.visibleLeaders(dayKey).length;
    const maxStaff = Math.max(
      0,
      this.MAX_VISIBLE_ASSIGNMENTS - visibleLeaderCount
    );
    return staff.slice(0, maxStaff);
  }

  // Get overflow count (+X)
  overflowCount(dayKey: string): number {
    const leaders = this.leaderAssignments(dayKey);
    const staff = this.staffAssignments(dayKey);
    const total = leaders.length + staff.length;
    const visible =
      this.visibleLeaders(dayKey).length + this.visibleStaff(dayKey).length;
    return Math.max(0, total - visible);
  }

  // Get all overflow assignments for tooltip
  overflowAssignments(dayKey: string): AssignmentRead[] {
    const all = this.cellAssignments(dayKey);
    const visibleLeaders = this.visibleLeaders(dayKey);
    const visibleStaff = this.visibleStaff(dayKey);
    const visible = new Set([...visibleLeaders, ...visibleStaff]);
    return all.filter((a) => !visible.has(a));
  }

  // Format overflow tooltip
  getOverflowTooltip(dayKey: string): string {
    const overflow = this.overflowAssignments(dayKey);
    return overflow
      .map(
        (a) =>
          `${a.isLeader ? '⭐ ' : ''}${a.userName}${
            a.positionTitle ? ' - ' + a.positionTitle : ''
          }`
      )
      .join('\n');
  }

  // Highlight only when the selected person belongs to the visible shift and location.
  hasSelectedUserAssignment(dayKey: string): boolean {
    if (!this.selectedUser) return false;
    return this.cellAssignments(dayKey).some((a) => a.userId === this.selectedUser!.id);
  }

  isToday(d: Date) {
    const t = new Date();
    return (
      t.getFullYear() === d.getFullYear() &&
      t.getMonth() === d.getMonth() &&
      t.getDate() === d.getDate()
    );
  }

  /**
   * Show assignment details in popover
   */
  showAssignmentDetails(event: Event, assignment: AssignmentRead, op: any) {
    event.stopPropagation();
    this.selectedDayKey.set(null);
    this.selectedAssignment.set(assignment);
    op.show(event);
  }

  showDayDetails(event: Event, dayKey: string) {
    event.stopPropagation();
    this.selectedAssignment.set(null);
    this.selectedDayKey.set(dayKey);
    this.dayDialogOpen.set(true);
  }

  onCellKeydown(event: Event, dayKey: string) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.showDayDetails(event, dayKey);
  }

  // Tag tooltip content combining name, title, unit and shift (snapshot fields)
  getTagTooltip(a: AssignmentRead): string {
    const parts: string[] = [];
    parts.push(a.userName);
    if (a.positionTitle) parts.push(a.positionTitle);
    if (a.orgUnitName) parts.push(a.orgUnitName);
    const shift = [a.shiftName, a.shiftTimeRange].filter(Boolean).join(' ');
    if (shift) parts.push(shift);
    return parts.join(' • ');
  }
}

function toKey(d: Date) {
  const m = (d.getMonth() + 1 + '').padStart(2, '0');
  const day = (d.getDate() + '').padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
}
function endOfWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  return x;
}
