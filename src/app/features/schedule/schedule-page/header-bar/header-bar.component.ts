// src/app/features/schedule/header-bar/header-bar.component.ts
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { DropdownModule } from 'primeng/dropdown';

import { RosterMeta } from '../../schedule';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';

interface OrgUnitOption {
  code: string;
  name: string;
}

@Component({
  standalone: true,
  selector: 'app-header-bar',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    RadioButtonModule,
    DropdownModule,
    DatePickerModule,
    TooltipModule,
  ],
  templateUrl: './header-bar.component.html',
})
export class HeaderBarComponent implements OnInit, OnChanges {
  @Input() meta!: RosterMeta;
  @Input() orgUnits: OrgUnitOption[] = []; // Danh sách phòng ban
  @Input() showScopeSelector = true; // Hiện selector loại lịch (nếu có cả 2 quyền)

  @Output() metaChange = new EventEmitter<Partial<RosterMeta>>();
  @Output() unitChange = new EventEmitter<OrgUnitOption>();

  // two-way helpers (không đụng model gốc)
  title = '';
  range: [Date | null, Date | null] | null = null;
  selectedUnit: OrgUnitOption | null = null;

  ngOnInit(): void {
    this.syncFromMeta();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['meta']) {
      this.syncFromMeta();
    }
  }

  private syncFromMeta() {
    if (!this.meta) return;
    
    this.title = (this.meta as any).name ?? '';
    
    // Convert YYYY-MM-DD -> Date for p-datepicker
    if (this.meta.from && this.meta.to) {
      const [y1, m1, d1] = this.meta.from.split('-').map(Number);
      const [y2, m2, d2] = this.meta.to.split('-').map(Number);
      this.range = [new Date(y1, m1 - 1, d1), new Date(y2, m2 - 1, d2)];
    }
    
    // Set selected unit
    if (this.orgUnits.length > 0 && !this.selectedUnit) {
      this.selectedUnit =
        this.orgUnits.find((u) => this.meta.unitName?.includes(u.name)) ||
        this.orgUnits[0];
    }
  }

  onUnitChange(unit: OrgUnitOption) {
    this.unitChange.emit(unit);
  }

  onRangeChange(val: any) {
    console.log('onRangeChange', val);
    const [s, e] = val || [];
    if (!s || !e) return;
    const toKey = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1 + '').padStart(2, '0')}-${(
        d.getDate() + ''
      ).padStart(2, '0')}`;
    this.metaChange.emit({ from: toKey(s), to: toKey(e) });
  }

  onTitleBlur() {
    this.metaChange.emit({ name: this.title });
  }

  // ===== Validation helpers =====
  titleTouched = false;
  rangeTouched = false;

  get invalidTitle() {
    const t = (this.title || '').trim();
    return t.length === 0 || t.length > 200;
  }
  get invalidRange() {
    const r = this.range as any;
    return !r || !r[0] || !r[1];
  }
}
