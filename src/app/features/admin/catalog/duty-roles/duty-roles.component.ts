import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CommonModule } from '@angular/common';
import {
  DutyRoleReadDto,
  DutyRoleScope,
  DutyRoleWriteDto,
} from '../../../../shared/models/duty-role';
import { DutyApiService } from '../../../../core/api/duty-api.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-duty-roles',
  templateUrl: './duty-roles.component.html',
  imports: [
    TableModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    InputSwitchModule,
    FormsModule,
    CommonModule,
    HasPermissionDirective,
    ToastModule,
  ],
  providers: [MessageService],
})
export class DutyRolesComponent implements OnInit {
  rows: DutyRoleReadDto[] = [];
  loading = false;
  selected: DutyRoleReadDto[] = [];

  // Reactive permission checks for bulk actions
  // These will update when auth state changes
  get canBulkDelete(): boolean {
    return this.hasPermission('catalog.delete');
  }

  get canBulkEdit(): boolean {
    return this.hasPermission('catalog.edit');
  }

  visible = false;
  editId: number | null = null;
  scopes: { label: string; value: DutyRoleScope }[] = [
    { label: 'GLOBAL', value: 'GLOBAL' },
    { label: 'PHONG', value: 'PHONG' },
    { label: 'CUC', value: 'CUC' },
  ];
  form: DutyRoleWriteDto = {
    code: '',
    name: '',
    forLeaderOnly: false,
    scope: 'GLOBAL',
    active: true,
  };

  constructor(
    private api: DutyApiService,
    private msg: MessageService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  private hasPermission(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  async ngOnInit() {
    await this.load();
  }
  async load() {
    this.loading = true;
    this.rows = (await firstValueFrom(this.api.getDutyRoles())) || [];
    this.loading = false;
  }

  add() {
    this.editId = null;
    this.form = {
      code: '',
      name: '',
      forLeaderOnly: false,
      scope: 'GLOBAL',
      active: true,
    };
    this.visible = true;
  }
  edit(r: DutyRoleReadDto) {
    this.editId = r.id;
    this.form = {
      code: r.code,
      name: r.name,
      forLeaderOnly: r.forLeaderOnly,
      scope: r.scope,
      active: r.active,
    };
    this.visible = true;
  }

  async save() {
    const code = this.form.code?.trim();
    const name = this.form.name?.trim();
    if (!code || !name) return;
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
        await firstValueFrom(this.api.updateDutyRole(this.editId, this.form));
      else await firstValueFrom(this.api.createDutyRole(this.form));
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

  async remove(r: DutyRoleReadDto) {
    if (!confirm(`Xóa "${r.name}"?`)) return;
    await firstValueFrom(this.api.deleteDutyRole(r.id));
    await this.load();
  }

  async removeMany() {
    if (!this.selected?.length) return;
    if (!confirm(`Xóa ${this.selected.length} mục đã chọn?`)) return;
    await Promise.all(
      this.selected.map((r) => firstValueFrom(this.api.deleteDutyRole(r.id)))
    );
    this.selected = [];
    await this.load();
  }

  async toggleMany() {
    if (!this.selected.length) return;
    await Promise.all(
      this.selected.map((r) =>
        firstValueFrom(
          this.api.updateDutyRole(r.id, {
            code: r.code,
            name: r.name,
            forLeaderOnly: r.forLeaderOnly,
            scope: r.scope,
            active: !r.active,
          })
        )
      )
    );
    this.selected = [];
    await this.load();
  }
}
