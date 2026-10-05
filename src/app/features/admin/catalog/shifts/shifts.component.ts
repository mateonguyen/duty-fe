import { Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ShiftReadDto, ShiftWriteDto } from '../../../../shared/models/shift';
import { DutyApiService } from '../../../../core/api/duty-api.service';
import {
  ScopeService,
  ScopeRef,
} from '../../../../core/services/scope.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ScopePickerComponent } from '../../../../shared/components/scope-picker/scope-picker.component';
import { firstValueFrom } from 'rxjs';

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
    InputNumberModule,
    CalendarModule,
    TooltipModule,
    FormsModule,
    CommonModule,
    ScopePickerComponent,
    ToastModule,
  ],
  providers: [MessageService],
})
export class ShiftsComponent implements OnInit {
  rows: ShiftReadDto[] = [];
  loading = false;
  selected: ShiftReadDto[] = [];

  visible = false;
  editId: number | null = null;
  form: ShiftWriteDto = {
    code: '',
    name: '',
    startTime: '08:00:00',
    endTime: '17:00:00',
    displayOrder: 100,
    active: true,
    scopeCode: null,
  };

  // Form helpers for time picker
  startTimeDate: Date | null = null;
  endTimeDate: Date | null = null;

  // Validation errors
  validationErrors = {
    name: '',
    startTime: '',
    endTime: '',
    code: '',
  };

  // Computed for dialog
  get scopeUnitName(): string {
    if (!this.form.scopeCode) return 'GLOBAL';
    const scope = this.scopes.find((s) => s.orgId === this.form.scopeCode);
    return scope?.displayName || this.form.scopeCode;
  }

  // scope state
  scopes: ScopeRef[] = [];
  activeScope = signal<ScopeRef | null>(null);

  // Permission loading gate
  permissionsLoaded = signal<boolean>(false);

  // Bulk action permissions - show buttons if user has permission in ANY loaded scope
  canBulkDelete = computed(() => {
    if (!this.permissionsLoaded()) return false;
    const currentScopes = this.scopes;
    const activeScope = this.activeScope();
    if (currentScopes.length > 0 && !activeScope) {
      return currentScopes.some((s) =>
        this.scopeService.hasPermissionInScope('catalog.delete', s.orgId)
      );
    }
    if (activeScope) {
      return this.scopeService.hasPermissionInScope(
        'catalog.delete',
        activeScope.orgId
      );
    }
    return false;
  });

  canBulkEdit = computed(() => {
    if (!this.permissionsLoaded()) return false;
    const currentScopes = this.scopes;
    const activeScope = this.activeScope();
    if (currentScopes.length > 0 && !activeScope) {
      return currentScopes.some((s) =>
        this.scopeService.hasPermissionInScope('catalog.edit', s.orgId)
      );
    }
    if (activeScope) {
      return this.scopeService.hasPermissionInScope(
        'catalog.edit',
        activeScope.orgId
      );
    }
    return false;
  });

  canCreate = computed(() => {
    if (!this.permissionsLoaded()) return false;
    const currentScopes = this.scopes;
    const activeScope = this.activeScope();
    // Creating and updating are separate permissions.
    if (currentScopes.length > 0 && !activeScope) {
      return currentScopes.some((s) =>
        this.scopeService.hasPermissionInScope('catalog.create', s.orgId)
      );
    }
    if (activeScope) {
      return this.scopeService.hasPermissionInScope(
        'catalog.create',
        activeScope.orgId
      );
    }
    return false;
  });

  constructor(
    private api: DutyApiService,
    private scopeService: ScopeService,
    private msg: MessageService
  ) {}

  // Move display order up/down
  moveDisplayOrder(row: ShiftReadDto, direction: number) {
    const idx = this.rows.findIndex((r) => r.id === row.id);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= this.rows.length) return;
    // Swap displayOrder values
    const temp = this.rows[swapIdx].displayOrder;
    this.rows[swapIdx].displayOrder = row.displayOrder;
    row.displayOrder = temp;
    // Persist both rows
    this.api.updateShift(row.id, { ...row } as ShiftWriteDto).subscribe();
    this.api
      .updateShift(this.rows[swapIdx].id, {
        ...this.rows[swapIdx],
      } as ShiftWriteDto)
      .subscribe();
    // Re-sort
    this.rows = [...this.rows].sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.code.localeCompare(b.code)
    );
  }

  isFirstRow(row: ShiftReadDto): boolean {
    return this.rows.length > 0 && this.rows[0].id === row.id;
  }

  isLastRow(row: ShiftReadDto): boolean {
    return (
      this.rows.length > 0 && this.rows[this.rows.length - 1].id === row.id
    );
  }

  async ngOnInit() {
    // Load scopes relevant for viewing shifts (use catalog.view)
    this.scopeService.load('catalog.view').subscribe({
      next: async (items) => {
        this.scopes = items;
        if (!this.activeScope() && items.length > 0) {
          this.activeScope.set(items[0]);
        }
        // Wait for ALL permission scopes to load before enabling permission checks
        forkJoin([
          this.scopeService.load('catalog.create'),
          this.scopeService.load('catalog.edit'),
          this.scopeService.load('catalog.delete'),
        ]).subscribe(() => {
          this.permissionsLoaded.set(true);
        });
        await this.load();
      },
      error: (err) => console.error('[Shifts] Failed to load scopes', err),
    });
  }

  async load() {
    this.loading = true;
    try {
      const scope = this.activeScope();
      if (scope) {
        // orgId is a string scopeCode (e.g., "G01.705.000.002")
        const scopeCode = scope.orgId;
        this.rows = await firstValueFrom(
          this.api.getShiftsByScope(scopeCode, true)
        );
      } else {
        // No scope selected: load all shifts
        this.rows = await firstValueFrom(this.api.getShifts());
      }
    } catch (err) {
      console.error('[Shifts] Failed to load shifts:', err);
      this.msg.add({
        severity: 'error',
        summary: 'Lỗi',
        detail: 'Không tải được dữ liệu ca trực',
      });
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  onScopeSelected(scope: ScopeRef | null) {
    this.activeScope.set(scope);
    this.load();
  }

  // TrackBy function to prevent duplicate rendering
  trackById(index: number, item: ShiftReadDto): number {
    return item.id;
  }

  add() {
    this.editId = null;
    this.form = {
      code: '',
      name: '',
      startTime: '08:00:00',
      endTime: '17:00:00',
      displayOrder: 100,
      active: true,
      // Set scopeCode from active scope when creating new shift
      scopeCode: this.activeScope()?.orgId ?? null,
    };
    this.initTimePickers();
    this.clearValidationErrors();
    this.visible = true;
  }

  edit(r: ShiftReadDto) {
    this.editId = r.id;
    this.form = {
      code: r.code,
      name: r.name,
      startTime: r.startTime,
      endTime: r.endTime,
      displayOrder: r.displayOrder,
      active: r.active,
      scopeCode: r.scopeCode ?? null,
    };
    this.initTimePickers();
    this.clearValidationErrors();
    this.visible = true;
  }

  private capitalCase(input: string): string {
    if (!input) return input;
    return input
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private toScreamingSnake(input: string): string {
    const noAccent = input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
    return noAccent
      .trim()
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .map((x) => x.toUpperCase())
      .join('_');
  }

  private applyAutoFormatAndCode() {
    // Capital case name
    if (this.form.name) {
      this.form.name = this.capitalCase(this.form.name);
    }
    // Auto code: [UnitCode]_[SCREAMING_SNAKE_CASE(name)]
    const unitCode = (this.form.scopeCode || 'GLOBAL').toUpperCase();
    const codePart = this.toScreamingSnake(this.form.name || '');
    this.form.code = `${unitCode}_${codePart}`;
  }

  async save() {
    // Sync time pickers to form
    this.syncTimePickersToForm();

    // Clear previous validation errors
    this.clearValidationErrors();

    // Validate form
    if (!this.validateForm()) {
      return;
    }

    // Apply auto-format and auto-code (only on create)
    if (!this.editId) {
      this.applyAutoFormatAndCode();
    } else {
      // On edit: only apply name capitalization, keep code unchanged
      if (this.form.name) {
        this.form.name = this.capitalCase(this.form.name);
      }
    }

    // Client-side duplicate code check (case-insensitive)
    const code2 = this.form.code?.trim();
    const dup = this.rows.some(
      (r) =>
        r.code.toLowerCase() === code2.toLowerCase() &&
        (this.editId ? r.id !== this.editId : true)
    );
    if (dup) {
      this.validationErrors.code = `Mã "${code2}" đã tồn tại`;
      this.msg.add({
        severity: 'error',
        summary: 'Mã đã tồn tại',
        detail: this.validationErrors.code,
      });
      return;
    }

    // Check for duplicate name in same scope
    const nameDup = this.rows.some(
      (r) =>
        r.name.toLowerCase() === this.form.name.toLowerCase() &&
        r.scopeCode === this.form.scopeCode &&
        (this.editId ? r.id !== this.editId : true)
    );
    if (nameDup) {
      this.validationErrors.name = 'Tên ca trực đã tồn tại trong đơn vị này';
      this.msg.add({
        severity: 'error',
        summary: 'Tên đã tồn tại',
        detail: this.validationErrors.name,
      });
      return;
    }

    try {
      if (this.editId) {
        await firstValueFrom(this.api.updateShift(this.editId, this.form));
      } else {
        await firstValueFrom(this.api.createShift(this.form));
      }
      this.msg.add({ severity: 'success', summary: 'Đã lưu' });
      this.visible = false;
      await this.load();
    } catch (e: any) {
      const backendMsg = e?.error?.message || e?.message;
      if (backendMsg?.toLowerCase().includes('code')) {
        this.validationErrors.code = backendMsg;
        this.msg.add({ severity: 'error', summary: 'Lỗi', detail: backendMsg });
      } else if (backendMsg?.toLowerCase().includes('name')) {
        this.validationErrors.name = backendMsg;
        this.msg.add({ severity: 'error', summary: 'Lỗi', detail: backendMsg });
      } else {
        this.msg.add({
          severity: 'error',
          summary: 'Lỗi lưu dữ liệu',
          detail: backendMsg || 'Vui lòng thử lại',
        });
      }
    }
  }

  async remove(r: ShiftReadDto) {
    if (!confirm(`Xóa "${r.name}"?`)) return;
    try {
      await firstValueFrom(this.api.deleteShift(r.id));
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
        this.selected.map((r) => firstValueFrom(this.api.deleteShift(r.id)))
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
          firstValueFrom(
            this.api.updateShift(r.id, {
              code: r.code,
              name: r.name,
              startTime: r.startTime,
              endTime: r.endTime,
              displayOrder: r.displayOrder ?? 100,
              scopeCode: r.scopeCode ?? null,
              active: !r.active,
            })
          )
        )
      );
      this.msg.add({ severity: 'success', summary: 'Đã cập nhật trạng thái' });
      this.selected = [];
      await this.load();
    } catch {
      this.msg.add({ severity: 'error', summary: 'Lỗi khi cập nhật' });
    }
  }

  // Inline update of display order
  onDisplayOrderBlur(r: ShiftReadDto) {
    // Basic guard
    if (r.displayOrder == null || r.displayOrder < 0) {
      r.displayOrder = 0;
    }
    // Persist immediately; keep other fields unchanged
    this.api
      .updateShift(r.id, {
        code: r.code,
        name: r.name,
        startTime: r.startTime,
        endTime: r.endTime,
        displayOrder: r.displayOrder,
        scopeCode: r.scopeCode ?? null,
        active: r.active,
      })
      .subscribe({
        next: () => {
          // Optimistically re-sort rows by displayOrder
          this.rows = [...this.rows].sort(
            (a, b) =>
              (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
              a.code.localeCompare(b.code)
          );
          this.msg.add({ severity: 'success', summary: 'Đã cập nhật thứ tự' });
        },
        error: () => {
          this.msg.add({
            severity: 'error',
            summary: 'Lỗi khi cập nhật thứ tự',
          });
        },
      });
  }

  // Helper: Initialize time pickers from form string values
  private initTimePickers() {
    this.startTimeDate = this.parseTimeString(this.form.startTime);
    this.endTimeDate = this.parseTimeString(this.form.endTime);
  }

  // Helper: Parse "HH:mm:ss" or "HH:mm" to Date for time picker
  private parseTimeString(timeStr: string): Date | null {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const date = new Date();
    date.setHours(parseInt(parts[0], 10) || 0);
    date.setMinutes(parseInt(parts[1], 10) || 0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  }

  // Helper: Convert Date to "HH:mm:ss" string
  private formatTimeToString(date: Date | null): string {
    if (!date) return '00:00:00';
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}:00`;
  }

  // Helper: Sync time picker values back to form
  private syncTimePickersToForm() {
    if (this.startTimeDate) {
      this.form.startTime = this.formatTimeToString(this.startTimeDate);
    }
    if (this.endTimeDate) {
      this.form.endTime = this.formatTimeToString(this.endTimeDate);
    }
  }

  // Helper: Clear validation errors
  private clearValidationErrors() {
    this.validationErrors = {
      name: '',
      startTime: '',
      endTime: '',
      code: '',
    };
  }

  // Helper: Validate form fields
  private validateForm(): boolean {
    let isValid = true;

    // Validate name
    if (!this.form.name || !this.form.name.trim()) {
      this.validationErrors.name = 'Vui lòng nhập tên ca trực';
      isValid = false;
    }

    // Validate start time
    if (!this.startTimeDate) {
      this.validationErrors.startTime = 'Vui lòng chọn giờ bắt đầu';
      isValid = false;
    }

    // Validate end time
    if (!this.endTimeDate) {
      this.validationErrors.endTime = 'Vui lòng chọn giờ kết thúc';
      isValid = false;
    }

    // Validate time logic (end > start for same-day shifts)
    if (this.startTimeDate && this.endTimeDate) {
      const startMinutes =
        this.startTimeDate.getHours() * 60 + this.startTimeDate.getMinutes();
      const endMinutes =
        this.endTimeDate.getHours() * 60 + this.endTimeDate.getMinutes();

      // Allow overnight shifts (end < start is valid)
      // But warn if they're equal
      if (startMinutes === endMinutes) {
        this.validationErrors.endTime =
          'Giờ kết thúc không thể bằng giờ bắt đầu';
        isValid = false;
      }
    }

    if (!isValid) {
      this.msg.add({
        severity: 'warn',
        summary: 'Thông tin chưa đầy đủ',
        detail: 'Vui lòng kiểm tra các trường bắt buộc',
      });
    }

    return isValid;
  }
}
