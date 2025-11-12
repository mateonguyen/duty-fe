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
import { AssignmentRead, DayKey } from '../../schedule';

type CellExtra = string | string[] | Record<string, boolean> | null | undefined;

@Component({
  standalone: true,
  selector: 'app-month-board',
  imports: [CommonModule, ButtonModule, DragDropModule],
  templateUrl: './month-board.component.html',
})
export class MonthBoardComponent {
  // Chuyển thành signal để computed có thể track
  private _from = signal<string>('');
  private _to = signal<string>('');

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
  @Input() assignments: AssignmentRead[] = [];
  @Input() readOnly = false;

  @Output() quickAdd = new EventEmitter<string>(); // dateKey
  @Output() remove = new EventEmitter<AssignmentRead>();
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
      (a) => a.date === dayKey && a.shiftId === this.selectedShiftId
    );
    // Sort leaders first
    return filtered.sort((a, b) => {
      if (a.isLeader && !b.isLeader) return -1;
      if (!a.isLeader && b.isLeader) return 1;
      return 0;
    });
  }

  isToday(d: Date) {
    const t = new Date();
    return (
      t.getFullYear() === d.getFullYear() &&
      t.getMonth() === d.getMonth() &&
      t.getDate() === d.getDate()
    );
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
