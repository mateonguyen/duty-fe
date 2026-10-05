import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { DutyApiService } from '../../../../core/api/duty-api.service';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  FormsModule,
  ReactiveFormsModule,
  FormGroup,
  FormBuilder,
  Validators,
} from '@angular/forms';
import {
  DutyLocationReadDto,
  DutyLocationWriteDto,
} from '../../../../shared/models/duty-location';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { firstValueFrom } from 'rxjs';
import { ScopePickerComponent } from '../../../../shared/components/scope-picker/scope-picker.component';
import {
  ScopeRef,
  ScopeService,
} from '../../../../core/services/scope.service';
import { InputNumberModule } from 'primeng/inputnumber';
import { Table } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-duty-locations',
  templateUrl: './duty-locations.component.html',
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputSwitchModule,
    InputNumberModule,
    FormsModule,
    ReactiveFormsModule,
    ToastModule,
    ConfirmDialogModule,
    ScopePickerComponent,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
})
export class DutyLocationsComponent implements OnInit, OnDestroy {
  rows: DutyLocationReadDto[] = [];
  loading = false;
  selected: DutyLocationReadDto[] = [];
  // dialog & form state
  visible = false;
  dialogHeader = 'THÊM ĐỊA ĐIỂM TRỰC';
  editId: number | null = null;
  // Flag to track auto-code behavior in create mode only
  isAutoCode = true;
  fg!: FormGroup;

  // scope state
  scopes = signal<ScopeRef[]>([]);
  activeScope = signal<ScopeRef | null>(null);
  permissionsLoaded = signal<boolean>(false);

  // Permission checks for current scope
  canCreate = computed(() => {
    const scope = this.activeScope();
    if (!scope) return false;
    return this.scopeService.hasPermissionInScope(
      'catalog.create',
      scope.orgId
    );
  });

  canEdit = computed(() => {
    const scope = this.activeScope();
    if (!scope) return false;
    return this.scopeService.hasPermissionInScope('catalog.edit', scope.orgId);
  });

  canDelete = computed(() => {
    const scope = this.activeScope();
    if (!scope) return false;
    return this.scopeService.hasPermissionInScope(
      'catalog.delete',
      scope.orgId
    );
  });

  // Bulk action permissions - show buttons if user has permission in ANY loaded scope
  canBulkDelete = computed(() => {
    // Wait for permissions to load first
    if (!this.permissionsLoaded()) return false;

    const currentScopes = this.scopes();
    const activeScope = this.activeScope();

    // If scopes loaded but no active scope, check all scopes
    if (currentScopes.length > 0 && !activeScope) {
      return currentScopes.some((s) =>
        this.scopeService.hasPermissionInScope('catalog.delete', s.orgId)
      );
    }

    // If active scope selected, check that scope
    if (activeScope) {
      return this.scopeService.hasPermissionInScope(
        'catalog.delete',
        activeScope.orgId
      );
    }

    return false;
  });

  canBulkEdit = computed(() => {
    // Wait for permissions to load first
    if (!this.permissionsLoaded()) return false;

    const currentScopes = this.scopes();
    const activeScope = this.activeScope();

    // If scopes loaded but no active scope, check all scopes
    if (currentScopes.length > 0 && !activeScope) {
      return currentScopes.some((s) =>
        this.scopeService.hasPermissionInScope('catalog.edit', s.orgId)
      );
    }

    // If active scope selected, check that scope
    if (activeScope) {
      return this.scopeService.hasPermissionInScope(
        'catalog.edit',
        activeScope.orgId
      );
    }

    return false;
  });

  @ViewChild('dt') dt: Table | any;
  highlightedId: number | null = null; // highlight new row

  validationErrors = { name: '', code: '', displayOrder: '', scopeCode: '' };
  private subs: Subscription[] = [];

  constructor(
    private api: DutyApiService,
    private msg: MessageService,
    private confirm: ConfirmationService,
    private scopeService: ScopeService,
    private fb: FormBuilder
  ) {}

  async ngOnInit() {
    this.scopeService.load('catalog.view').subscribe({
      next: async (items) => {
        this.scopes.set(items);
        if (!this.activeScope() && items.length > 0)
          this.activeScope.set(items[0]);

        // Load permission scopes and wait for all to complete
        forkJoin([
          this.scopeService.load('catalog.create'),
          this.scopeService.load('catalog.edit'),
          this.scopeService.load('catalog.delete'),
        ]).subscribe(() => {
          this.permissionsLoaded.set(true);
        });

        await this.load();
      },
      error: () => this.load(),
    });
    this.initForm();
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private initForm() {
    this.fg = this.fb.group({
      scopeCode: [null, [Validators.required]],
      code: [{ value: '', disabled: true }],
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(200),
        ],
      ],
      address: ['', [Validators.maxLength(500)]],
      displayOrder: [100, [Validators.required]],
      isActive: [true],
    });

    // Debounced name formatting & code regen
    this.subs.push(
      this.fg
        .get('name')!
        .valueChanges.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe((val) => {
          const formatted = this.formatNameForDisplay(val || '');
          this.fg.get('name')!.patchValue(formatted, { emitEvent: false });
          this.regenerateCode();
        })
    );

    // Scope change regen code
    this.subs.push(
      this.fg
        .get('scopeCode')!
        .valueChanges.pipe(distinctUntilChanged())
        .subscribe(() => this.regenerateCode())
    );
  }

  async load() {
    this.loading = true;
    try {
      const scopeCode = this.activeScope()?.orgId ?? null;
      this.rows =
        (await firstValueFrom(this.api.getDutyLocations(scopeCode, true))) ??
        [];
      this.rows = [...this.rows].sort(
        (a, b) =>
          (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
          a.name.localeCompare(b.name)
      );
    } finally {
      this.loading = false;
    }
  }

  onScopeSelected(scope: ScopeRef | null) {
    this.activeScope.set(scope);
    this.load();
  }

  scopeDisplayNameFor(code?: string | null): string {
    if (!code) return 'GLOBAL';
    const s = this.scopes().find((x) => x.orgId === code);
    return s?.displayName || code;
  }

  get dialogSelectedScope(): ScopeRef | null {
    const sc = this.fg?.get('scopeCode')?.value;
    return this.scopes().find((s) => s.orgId === sc) ?? null;
  }

  // --- Helpers for formatting/code generation (same logic as Shifts) ---
  private capitalCase(input: string): string {
    if (!input) return input;
    return input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private toScreamingSnake(input: string): string {
    if (!input) return '';
    let s = input
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!s) s = 'LOCATION';
    return s;
  }

  private formatNameForDisplay(name?: string): string {
    if (!name) return '';
    let s = name.trim();
    // normalize spaces
    s = s.replace(/\s+/g, ' ');
    // replace hyphens with spaced en-dash
    s = s.replace(/\s*[-–—]+\s*/g, ' – ');
    // Capitalize words
    s = this.capitalCase(s);
    return s;
  }

  private generateCode(name: string, scopeCode?: string | null): string {
    const unit = (scopeCode || 'GLOBAL').toUpperCase();
    const slug = this.toScreamingSnake(name || '');
    return `${unit}_${slug}`;
  }

  private regenerateCode() {
    // Only auto-generate in create mode when code is empty and flagged auto
    if (this.editId) return;
    if (!this.isAutoCode) return;
    const currentCode = this.fg.get('code')!.value || '';
    if (currentCode) return; // do not overwrite existing code
    const nameRaw = this.fg.get('name')!.value || '';
    const nameTrim = nameRaw.trim();
    if (!nameTrim) return; // wait until user enters a name
    const scopeCode = this.fg.get('scopeCode')!.value;
    const code = this.generateCode(nameTrim, scopeCode);
    this.fg.get('code')!.setValue(code, { emitEvent: false });
  }

  onDialogScopeChanged(scope: ScopeRef | null) {
    this.fg.get('scopeCode')!.setValue(scope?.orgId ?? null);
  }

  add() {
    this.editId = null;
    this.isAutoCode = true;
    const scopeCode = this.activeScope()?.orgId ?? null;
    const max = this.rows
      .filter((r) => (r.scopeCode ?? null) === scopeCode)
      .reduce((acc, r) => Math.max(acc, r.displayOrder ?? 0), 0);
    this.dialogHeader = 'THÊM ĐỊA ĐIỂM TRỰC';
    this.fg.reset({
      scopeCode: scopeCode,
      code: '',
      name: '',
      address: '',
      displayOrder: (max || 0) + 1,
      isActive: true,
    });
    this.regenerateCode();
    this.clearValidationErrors();
    this.visible = true;
  }

  edit(r: DutyLocationReadDto) {
    this.editId = r.id;
    this.isAutoCode = false; // disable auto-generation in edit mode
    this.dialogHeader = 'SỬA ĐỊA ĐIỂM TRỰC';
    this.fg.reset({
      scopeCode: r.scopeCode ?? null,
      code: r.code,
      name: r.name,
      address: r.address ?? '',
      displayOrder: r.displayOrder ?? 100,
      isActive: r.active,
    });
    this.clearValidationErrors();
    this.visible = true;
  }

  async save() {
    this.clearValidationErrors();
    if (this.fg.invalid) {
      if (this.fg.get('name')!.invalid)
        this.validationErrors.name = 'Vui lòng nhập tên địa điểm';
      if (this.fg.get('scopeCode')!.invalid)
        this.validationErrors.scopeCode = 'Vui lòng chọn phạm vi áp dụng';
      return;
    }
    // Final format
    const formattedName = this.formatNameForDisplay(
      this.fg.get('name')!.value || ''
    );
    this.fg.get('name')!.setValue(formattedName, { emitEvent: false });
    // If create mode and code still empty, generate once more before validation
    if (
      !this.editId &&
      this.isAutoCode &&
      !(this.fg.get('code')!.value || '').trim()
    ) {
      this.regenerateCode();
    }

    // DisplayOrder integer
    let disp = this.fg.get('displayOrder')!.value;
    if (disp == null || isNaN(disp)) {
      this.validationErrors.displayOrder = 'Thứ tự phải là số nguyên';
      return;
    }
    this.fg
      .get('displayOrder')!
      .setValue(Math.trunc(disp), { emitEvent: false });

    // Trim address
    if (this.fg.get('address')!.value) {
      this.fg
        .get('address')!
        .setValue(this.fg.get('address')!.value.trim(), { emitEvent: false });
    }

    const scopeCode = this.fg.get('scopeCode')!.value ?? null;
    const codeLower = (this.fg.get('code')!.value || '').toLowerCase();
    const nameLower = (this.fg.get('name')!.value || '').toLowerCase();
    const dupCode = this.rows.some(
      (r) =>
        r.code.toLowerCase() === codeLower &&
        (r.scopeCode ?? null) === scopeCode &&
        (this.editId ? r.id !== this.editId : true)
    );
    if (dupCode) {
      this.validationErrors.code = 'Mã địa điểm đã tồn tại trong phạm vi này.';
      return;
    }
    const dupName = this.rows.some(
      (r) =>
        (r.name || '').toLowerCase() === nameLower &&
        (r.scopeCode ?? null) === scopeCode &&
        (this.editId ? r.id !== this.editId : true)
    );
    if (dupName) {
      this.validationErrors.name = 'Tên đã tồn tại trong phạm vi này';
      return;
    }

    const payload: DutyLocationWriteDto = {
      scopeCode: scopeCode,
      code: this.fg.get('code')!.value,
      name: this.fg.get('name')!.value,
      address: this.fg.get('address')!.value || '',
      displayOrder: this.fg.get('displayOrder')!.value,
      active: !!this.fg.get('isActive')!.value,
    };

    try {
      let saved: any;
      if (this.editId) {
        await firstValueFrom(this.api.updateDutyLocation(this.editId, payload));
        saved = { id: this.editId };
      } else {
        saved = await firstValueFrom(this.api.createDutyLocation(payload));
      }
      this.msg.add({
        severity: 'success',
        summary: 'Thành công',
        detail: 'Đã lưu',
      });
      this.visible = false;
      await this.load();
      const newId = saved?.id ?? null;
      if (newId) {
        this.highlightedId = newId;
        const idx = this.rows.findIndex((r) => r.id === newId);
        if (idx >= 0 && this.dt) {
          const rowsPerPage = this.dt.rows || 10;
          this.dt.first = Math.floor(idx / rowsPerPage) * rowsPerPage;
        }
        setTimeout(() => (this.highlightedId = null), 800);
      }
    } catch (e: any) {
      const backendMsg = e?.error?.message || e?.message;
      if (backendMsg?.toLowerCase().includes('code'))
        this.validationErrors.code = backendMsg;
      else if (backendMsg?.toLowerCase().includes('name'))
        this.validationErrors.name = backendMsg;
      this.msg.add({
        severity: 'error',
        summary: 'Lỗi',
        detail: backendMsg ?? 'Không lưu được',
      });
    }
  }

  // ===== Inline DisplayOrder handling (parity with Shifts) =====
  moveDisplayOrder(row: DutyLocationReadDto, direction: number) {
    const idx = this.rows.findIndex((r) => r.id === row.id);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= this.rows.length) return;
    const swapRow = this.rows[swapIdx];
    // Swap displayOrder values
    const temp = swapRow.displayOrder;
    swapRow.displayOrder = row.displayOrder;
    row.displayOrder = temp;
    // Persist both optimistically
    this.api
      .updateDutyLocation(row.id, {
        code: row.code,
        name: row.name,
        address: row.address ?? '',
        displayOrder: row.displayOrder,
        scopeCode: row.scopeCode ?? null,
        active: row.active,
      })
      .subscribe();
    this.api
      .updateDutyLocation(swapRow.id, {
        code: swapRow.code,
        name: swapRow.name,
        address: swapRow.address ?? '',
        displayOrder: swapRow.displayOrder,
        scopeCode: swapRow.scopeCode ?? null,
        active: swapRow.active,
      })
      .subscribe();
    this.rows = [...this.rows].sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.name.localeCompare(b.name)
    );
  }

  isFirstRow(row: DutyLocationReadDto): boolean {
    return this.rows.length > 0 && this.rows[0].id === row.id;
  }

  isLastRow(row: DutyLocationReadDto): boolean {
    return (
      this.rows.length > 0 && this.rows[this.rows.length - 1].id === row.id
    );
  }

  onDisplayOrderBlur(r: DutyLocationReadDto) {
    if (r.displayOrder == null || r.displayOrder < 0) r.displayOrder = 0;
    this.api
      .updateDutyLocation(r.id, {
        code: r.code,
        name: r.name,
        address: r.address ?? '',
        displayOrder: r.displayOrder,
        scopeCode: r.scopeCode ?? null,
        active: r.active,
      })
      .subscribe({
        next: () => {
          this.rows = [...this.rows].sort(
            (a, b) =>
              (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
              a.name.localeCompare(b.name)
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

  remove(r: DutyLocationReadDto) {
    this.confirm.confirm({
      message: `Xóa “${r.name}”?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await firstValueFrom(this.api.deleteDutyLocation(r.id));
        this.msg.add({ severity: 'success', summary: 'Đã xóa' });
        await this.load();
      },
    });
  }

  removeMany() {
    if (!this.selected?.length) return;
    this.confirm.confirm({
      message: `Xóa ${this.selected.length} mục đã chọn?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          await Promise.all(
            this.selected.map((r) =>
              firstValueFrom(this.api.deleteDutyLocation(r.id))
            )
          );
          this.msg.add({ severity: 'success', summary: 'Đã xóa' });
          this.selected = [];
          await this.load();
        } catch (e) {
          this.msg.add({ severity: 'error', summary: 'Lỗi khi xóa' });
        }
      },
    });
  }

  async toggleMany() {
    if (!this.selected.length) return;
    try {
      await Promise.all(
        this.selected.map((r) =>
          firstValueFrom(
            this.api.updateDutyLocation(r.id, {
              code: r.code,
              name: r.name,
              active: !r.active,
            })
          )
        )
      );
      this.msg.add({ severity: 'success', summary: 'Đã cập nhật trạng thái' });
      this.selected = [];
      await this.load();
    } catch (e) {
      this.msg.add({ severity: 'error', summary: 'Lỗi khi cập nhật' });
    }
  }

  private clearValidationErrors() {
    this.validationErrors = {
      name: '',
      code: '',
      displayOrder: '',
      scopeCode: '',
    };
  }
}
