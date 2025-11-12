type PermissionGroup = {
  prefix: string;
  items: PermissionDto[];
  open: boolean;
};
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthApiService } from '../../../core/api/auth-api.service';
import {
  PermissionDto,
  RoleDetailDto,
  RoleDto,
} from '../../../shared/models/auth';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputTextarea,
    TooltipModule,
    DialogModule,
    CheckboxModule,
    InputSwitchModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './roles-list.component.html',
  styleUrls: ['./roles-list.component.scss'],
})
export class RolesListComponent implements OnInit {
  private api = inject(AuthApiService);
  private msg = inject(MessageService);
  private confirm = inject(ConfirmationService);

  roles: RoleDto[] = [];
  loading = false;
  selected: RoleDto[] = [];

  // Permissions dialog state
  showPerms = false;
  currentRole: RoleDetailDto | null = null;
  allPermissions: PermissionDto[] = [];
  saving = false;
  permFilter = '';

  permGroups: PermissionGroup[] = [];
  editedPerms: Set<string> | null = null;

  // Create/Edit role dialog state
  showEditDialog = false;
  dialogTitle = 'Thêm vai trò mới';
  editCode: string | null = null;
  submitted = false;
  roleForm = {
    code: '',
    name: '',
    description: '',
    isSystemRole: false,
    active: true,
  };

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.api.getRoles().subscribe({
      next: (res) => (this.roles = res),
      complete: () => (this.loading = false),
    });
  }

  openPermissions(r: RoleDto) {
    this.showPerms = true;
    this.currentRole = null;
    this.permFilter = '';
    this.api.getRoleDetail(r.code).subscribe((detail) => {
      this.currentRole = detail;
      this.editedPerms = new Set(detail.permissions?.map((p) => p.code) ?? []);
    });
    this.api.getAllPermissions().subscribe((all) => {
      this.allPermissions = all;
      this.permGroups = this.groupPermissions(all);
    });
  }

  isChecked(code: string): boolean {
    return !!this.editedPerms?.has(code);
  }

  isGroupChecked(g: PermissionGroup): boolean {
    if (!this.editedPerms) return false;
    return g.items.every((p) => this.editedPerms!.has(p.code));
  }

  togglePermission(code: string, checked: boolean) {
    if (!this.editedPerms) return;
    if (checked) this.editedPerms.add(code);
    else this.editedPerms.delete(code);
  }

  groupPermissions(perms: PermissionDto[]): PermissionGroup[] {
    const map = new Map<string, PermissionGroup>();
    for (const p of perms) {
      const prefix = p.code.split('.')[0];
      if (!map.has(prefix)) map.set(prefix, { prefix, items: [], open: true });
      map.get(prefix)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.prefix.localeCompare(b.prefix)
    );
  }

  toggleGroupOpen(g: PermissionGroup) {
    g.open = !g.open;
  }

  selectAllInGroup(g: PermissionGroup, checked: boolean) {
    if (!this.editedPerms) return;
    for (const p of g.items) {
      if (checked) this.editedPerms.add(p.code);
      else this.editedPerms.delete(p.code);
    }
  }

  savePermissions() {
    if (!this.currentRole || !this.editedPerms) return;
    this.saving = true;
    this.api
      .updateRolePermissions(
        this.currentRole.code,
        Array.from(this.editedPerms)
      )
      .subscribe({
        next: () => {
          const updated = this.allPermissions.filter((p) =>
            this.editedPerms!.has(p.code)
          );
          this.currentRole = { ...this.currentRole!, permissions: updated };
        },
        complete: () => {
          this.saving = false;
          this.showPerms = false;
        },
      });
  }

  cancelPermissions() {
    this.showPerms = false;
    this.currentRole = null;
    this.editedPerms = null;
  }

  openCreateDialog() {
    this.editCode = null;
    this.dialogTitle = 'Thêm vai trò mới';
    this.roleForm = {
      code: '',
      name: '',
      description: '',
      isSystemRole: false,
      active: true,
    };
    this.submitted = false;
    this.showEditDialog = true;
  }

  openEditDialog(role: RoleDto) {
    this.editCode = role.code;
    this.dialogTitle = 'Sửa vai trò';
    this.roleForm = {
      code: role.code,
      name: role.name,
      description: role.description || '',
      isSystemRole: role.isSystemRole || false,
      active: role.active !== false,
    };
    this.submitted = false;
    this.showEditDialog = true;
  }

  closeEditDialog() {
    this.showEditDialog = false;
    this.submitted = false;
    this.editCode = null;
  }

  saveRole() {
    this.submitted = true;

    if (!this.roleForm.code || !this.roleForm.name) {
      return;
    }

    this.saving = true;

    if (this.editCode) {
      // Update existing role
      const { code, ...updateData } = this.roleForm;
      this.api.updateRole(this.editCode, updateData).subscribe({
        next: (updated: RoleDto) => {
          this.roles = this.roles.map((r) =>
            r.code === this.editCode ? updated : r
          );
          this.msg.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã cập nhật vai trò',
          });
          this.showEditDialog = false;
        },
        error: (err) => {
          this.msg.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err?.error?.message || 'Không thể cập nhật vai trò',
          });
        },
        complete: () => {
          this.saving = false;
        },
      });
    } else {
      // Create new role
      this.api.createRole(this.roleForm).subscribe({
        next: (created: RoleDto) => {
          this.roles = [...this.roles, created];
          this.msg.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã tạo vai trò mới',
          });
          this.showEditDialog = false;
        },
        error: (err) => {
          this.msg.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err?.error?.message || 'Không thể tạo vai trò',
          });
        },
        complete: () => {
          this.saving = false;
        },
      });
    }
  }

  deleteRole(role: RoleDto) {
    if (role.isSystemRole) {
      this.msg.add({
        severity: 'warn',
        summary: 'Cảnh báo',
        detail: 'Không thể xóa vai trò hệ thống',
      });
      return;
    }

    this.confirm.confirm({
      message: `Xóa vai trò "${role.name}" (${role.code})?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteRole(role.code).subscribe({
          next: () => {
            this.roles = this.roles.filter((r) => r.code !== role.code);
            this.msg.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã xóa vai trò',
            });
          },
          error: (err) => {
            this.msg.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: err?.error?.message || 'Không thể xóa vai trò',
            });
          },
        });
      },
    });
  }

  deleteManyRoles() {
    if (!this.selected?.length) return;

    const systemRoles = this.selected.filter((r) => r.isSystemRole);
    if (systemRoles.length > 0) {
      this.msg.add({
        severity: 'warn',
        summary: 'Cảnh báo',
        detail: 'Không thể xóa vai trò hệ thống',
      });
      return;
    }

    this.confirm.confirm({
      message: `Xóa ${this.selected.length} vai trò đã chọn?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const deleteOps = this.selected.map((r) =>
          this.api.deleteRole(r.code).toPromise()
        );
        Promise.all(deleteOps).then(
          () => {
            const deletedCodes = new Set(this.selected.map((r) => r.code));
            this.roles = this.roles.filter((r) => !deletedCodes.has(r.code));
            this.selected = [];
            this.msg.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã xóa các vai trò',
            });
          },
          (err) => {
            this.msg.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: 'Không thể xóa một số vai trò',
            });
          }
        );
      },
    });
  }

  toggleManyStatus() {
    if (!this.selected?.length) return;

    const updateOps = this.selected.map((r) =>
      this.api
        .updateRole(r.code, {
          name: r.name,
          description: r.description,
          isSystemRole: r.isSystemRole,
          active: !r.active,
        })
        .toPromise()
    );

    Promise.all(updateOps).then(
      () => {
        this.loadRoles();
        this.selected = [];
        this.msg.add({
          severity: 'success',
          summary: 'Thành công',
          detail: 'Đã đổi trạng thái',
        });
      },
      (err) => {
        this.msg.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không thể đổi trạng thái',
        });
      }
    );
  }
}
