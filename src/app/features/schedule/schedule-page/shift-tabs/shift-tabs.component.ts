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
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DutyApiService } from '../../../../core/api/duty-api.service';
import { CheckboxModule } from 'primeng/checkbox';
import { firstValueFrom } from 'rxjs';
import { Shift, DutyLocation } from '../../schedule';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  standalone: true,
  selector: 'app-shift-tabs',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    DialogModule,
    InputTextModule,
    InputSwitchModule,
    CheckboxModule,
    TooltipModule,
  ],
  templateUrl: './shift-tabs.component.html',
})
export class ShiftTabsComponent {
  @Input() shifts: Shift[] = [];
  @Input() selectedShiftId: number | null = null;
  @Input() visibleShiftIds: number[] | null = null; // if null -> show all
  @Input() locations: DutyLocation[] = [];
  @Input() locationId: number | null = null;
  @Output() shiftChange = new EventEmitter<number>();
  @Output() locationChange = new EventEmitter<number>();
  @Output() locationCreated = new EventEmitter<DutyLocation>();
  @Output() visibleShiftsChange = new EventEmitter<number[]>();

  // Tính sẵn ca đang chọn (tránh find() trong template)
  selectedShift = computed<Shift | null>(() => {
    const id = this.selectedShiftId;
    if (!id) return null;
    return this.shifts.find((s) => s.id === id) ?? null;
  });

  // ===== Location dropdown helpers =====
  locTouched = false;

  get sortedLocations() {
    const recents: number[] = JSON.parse(
      localStorage.getItem('recentLocations') || '[]'
    );
    const map = new Map<number, number>();
    recents.forEach((id, idx) => map.set(id, idx));
    return [...this.locations].sort((a, b) => {
      const ai = map.has(a.id) ? map.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = map.has(b.id) ? map.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  // client-side filter text for custom header filter
  filterText = '';
  get filteredLocations() {
    const f = (this.filterText || '').trim().toLowerCase();
    if (!f) return this.sortedLocations;
    return this.sortedLocations.filter((x) =>
      (x.name || '').toLowerCase().includes(f)
    );
  }

  onLocationChangeInternal(val: number | null) {
    this.locTouched = true;
    if (val != null) {
      // update recent list
      const key = 'recentLocations';
      const arr: number[] = JSON.parse(localStorage.getItem(key) || '[]');
      const next = [val, ...arr.filter((x) => x !== val)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(next));
      this.locationChange.emit(val);
    } else {
      // still emit null? keep required feedback; don't emit change
    }
  }

  select(s: Shift) {
    this.shiftChange.emit(s.id);
  }

  // ===== Quick add location dialog =====
  dlgOpen = false;
  dlgTitle = 'Thêm địa điểm';
  newLoc = { code: '', name: '', active: true };

  constructor(private dutyApi: DutyApiService) {}

  openAddLocation() {
    this.newLoc = { code: '', name: '', active: true };
    this.dlgOpen = true;
  }

  async saveNewLocation(form: any) {
    if (form?.invalid) return;
    try {
      const created = await firstValueFrom(
        this.dutyApi.createDutyLocation(this.newLoc)
      );
      // notify parent and select it
      const dto: DutyLocation = {
        id: (created as any).id,
        name: (created as any).name,
      };
      this.locationCreated.emit(dto);
      this.onLocationChangeInternal(dto.id);
      this.dlgOpen = false;
    } catch (err) {
      console.error('create duty location failed', err);
    }
  }

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
