import { Component, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ShiftReadDto, ShiftWriteDto } from '../../../../shared/models/shift';
import { DutyApiService } from '../../../../core/api/duty-api.service';
import {
  ScopeService,
  ScopeRef,
} from '../../../../core/services/scope.service';
import { ScopePickerComponent } from '../../../schedule/schedule-page/scope-picker/scope-picker.component';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

@Component({
  standalone: true,
  selector: 'app-shifts',
  templateUrl: './shifts.component.html',
  imports: [
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputSwitchModule,
    FormsModule,
    CommonModule,
    HasPermissionDirective,
    ScopePickerComponent,
    ToastModule,
  ],
  providers: [MessageService],
})
export class ShiftsComponent implements OnInit {
  rows: ShiftReadDto[] = [];
  loading = false;
  selected: ShiftReadDto[] = [];
  // Sorting is handled via column headers; no default multi-sort applied

  visible = false;
  editId: number | null = null;
  form: ShiftWriteDto = {
    code: '',
    name: '',
    startTime: '08:00:00',
    endTime: '17:00:00',
    active: true,
    scopeUnitId: null,
  };

  // scope state
  scopes: ScopeRef[] = [];
  activeScope: ScopeRef | null = null;

  constructor(
    private api: DutyApiService,
    private scopeService: ScopeService,
    private msg: MessageService
  ) {}

  async ngOnInit() {
    // Load scopes relevant for viewing shifts (reuse roster.view resolver)
    this.scopeService.load('roster.view').subscribe({
      next: async (items) => {
        this.scopes = items;
        if (!this.activeScope && items.length > 0) {
          this.activeScope = items[0];
        }
        await this.load();
      },
      error: (err) => console.error('[Shifts] Failed to load scopes', err),
    });
  }

  async load() {
    this.loading = true;
    try {
      if (this.activeScope) {
        // orgId from scope is a string; attempt parse to number
        const numericId = Number(this.activeScope.orgId);
        if (!Number.isNaN(numericId)) {
          this.rows =
            (await this.api.getShiftsByUnit(numericId).toPromise()) ?? [];
        } else {
          // fallback: load all then filter client-side by matching scopeUnitId? cannot map string -> id, show global only
          const all = (await this.api.getShifts().toPromise()) ?? [];
          this.rows = all.filter((r) => r.scopeUnitId == null);
        }
      } else {
        this.rows = (await this.api.getShifts().toPromise()) ?? [];
      }
    } finally {
      this.loading = false;
    }
  }

  onScopeSelected(scope: ScopeRef | null) {
    this.activeScope = scope;
    this.load();
  }

  add() {
    this.editId = null;
    this.form = {
      code: '',
      name: '',
      startTime: '08:00:00',
      endTime: '17:00:00',
      active: true,
      scopeUnitId: null,
    };
    this.visible = true;
  }
  edit(r: ShiftReadDto) {
    this.editId = r.id;
    this.form = {
      code: r.code,
      name: r.name,
      startTime: r.startTime,
      endTime: r.endTime,
      active: r.active,
      scopeUnitId: r.scopeUnitId ?? null,
    };
    this.visible = true;
  }

  async save() {
    const code = this.form.code?.trim();
    const name = this.form.name?.trim();
    if (!code || !name) return;
    // Client-side duplicate code check (case-insensitive)
    const dup = this.rows.some(
      (r) =>
        r.code.toLowerCase() === code.toLowerCase() &&
        (this.editId ? r.id !== this.editId : true)
    );
    if (dup) {
      this.msg.add({
        severity: 'error',
        summary: 'Mã đã tồn tại',
        detail: `Code "${code}" đã tồn tại.`,
      });
      return;
    }
    try {
      if (this.editId)
        await this.api.updateShift(this.editId, this.form).toPromise();
      else await this.api.createShift(this.form).toPromise();
      this.msg.add({ severity: 'success', summary: 'Đã lưu' });
      this.visible = false;
      await this.load();
    } catch (e: any) {
      const backendMsg = e?.error?.message || e?.message;
      if (backendMsg?.toLowerCase().includes('code')) {
        this.msg.add({ severity: 'error', summary: 'Lỗi', detail: backendMsg });
      } else {
        this.msg.add({ severity: 'error', summary: 'Lỗi lưu dữ liệu' });
      }
    }
  }

  async remove(r: ShiftReadDto) {
    if (!confirm(`Xóa "${r.name}"?`)) return;
    try {
      await this.api.deleteShift(r.id).toPromise();
      this.msg.add({ severity: 'success', summary: 'Đã xóa' });
      await this.load();
    } catch {
      this.msg.add({ severity: 'error', summary: 'Lỗi khi xóa' });
    }
  }

  async removeMany() {
    if (!this.selected?.length) return;
    if (!confirm(`Xóa ${this.selected.length} mục đã chọn?`)) return;
    try {
      await Promise.all(
        this.selected.map((r) => this.api.deleteShift(r.id).toPromise())
      );
      this.msg.add({ severity: 'success', summary: 'Đã xóa' });
      this.selected = [];
      await this.load();
    } catch {
      this.msg.add({ severity: 'error', summary: 'Lỗi khi xóa' });
    }
  }

  async toggleMany() {
    if (!this.selected.length) return;
    try {
      await Promise.all(
        this.selected.map((r) =>
          this.api
            .updateShift(r.id, {
              code: r.code,
              name: r.name,
              startTime: r.startTime,
              endTime: r.endTime,
              scopeUnitId: r.scopeUnitId ?? null,
              active: !r.active,
            })
            .toPromise()
        )
      );
      this.msg.add({ severity: 'success', summary: 'Đã cập nhật trạng thái' });
      this.selected = [];
      await this.load();
    } catch {
      this.msg.add({ severity: 'error', summary: 'Lỗi khi cập nhật' });
    }
  }
}
