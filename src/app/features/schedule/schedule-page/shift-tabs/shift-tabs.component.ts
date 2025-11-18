import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DutyApiService } from '../../../../core/api/duty-api.service';
import { CheckboxModule } from 'primeng/checkbox';
import { Shift, DutyLocation } from '../../schedule';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  standalone: true,
  selector: 'app-shift-tabs',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    TooltipModule,
  ],
  templateUrl: './shift-tabs.component.html',
})
export class ShiftTabsComponent {
  @Input() shifts: Shift[] = [];
  @Input() selectedShiftId: number | null = null;
  @Input() visibleShiftIds: number[] | null = null; // if null -> show all

  // Keep location inputs for backward compatibility, but don't use in UI
  @Input() locations: DutyLocation[] = [];
  @Input() locationId: number | null = null;
  @Output() locationChange = new EventEmitter<number>();
  @Output() locationCreated = new EventEmitter<DutyLocation>();

  @Output() shiftChange = new EventEmitter<number>();
  @Output() visibleShiftsChange = new EventEmitter<number[]>();

  // Tính sẵn ca đang chọn (tránh find() trong template)
  selectedShift = computed<Shift | null>(() => {
    const id = this.selectedShiftId;
    if (!id) return null;
    return this.shifts.find((s) => s.id === id) ?? null;
  });

  select(s: Shift) {
    this.shiftChange.emit(s.id);
  }

  constructor(private dutyApi: DutyApiService) {}

  // ===== Manage visible shifts =====
  manageOpen = false;
  manageSel = new Set<number>();

  get shiftsToShow(): Shift[] {
    const ids = this.visibleShiftIds;
    if (!ids || ids.length === 0) return this.shifts;
    const set = new Set(ids);
    return this.shifts.filter((s) => set.has(s.id));
  }

  openManageShifts() {
    const ids =
      this.visibleShiftIds && this.visibleShiftIds.length
        ? this.visibleShiftIds
        : this.shifts.map((s) => s.id);
    this.manageSel = new Set(ids);
    this.manageOpen = true;
  }

  toggleShift(id: number, checked: boolean) {
    if (checked) this.manageSel.add(id);
    else this.manageSel.delete(id);
  }
  selectAllShifts() {
    this.manageSel = new Set(this.shifts.map((s) => s.id));
  }
  clearAllShifts() {
    this.manageSel.clear();
  }
  applyVisibleShifts() {
    if (this.manageSel.size === 0) return; // keep at least one
    this.visibleShiftsChange.emit(Array.from(this.manageSel));
    this.manageOpen = false;
  }
}
