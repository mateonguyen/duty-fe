import {
  Component,
  inject,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthApiService } from '../../../core/api/auth-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { DutyApiService } from '../../../core/api/duty-api.service';
import {
  UserRoleDto,
  RoleDto,
  UserSearchDto,
} from '../../../shared/models/auth';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TreeSelectModule } from 'primeng/treeselect';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService, TreeNode } from 'primeng/api';
import type { AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { AutoComplete } from 'primeng/autocomplete';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-user-roles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    DropdownModule,
    AutoCompleteModule,
    TreeSelectModule,
    TooltipModule,
    TableModule,
    ToastModule,
    ConfirmDialogModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './user-roles.component.html',
  styleUrls: ['./user-roles.component.scss'],
})
export class UserRolesComponent implements OnInit {
  private api = inject(AuthApiService);
  private auth = inject(AuthService);
  private dutyApi = inject(DutyApiService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);

  @ViewChild('userAutoComplete') userAutoComplete!: AutoComplete;

  username = '';
  selectedUser: UserSearchDto | null = null;
  filteredUsers: UserSearchDto[] = [];
  roles: RoleDto[] = [];
  roleOptions: { label: string; value: string; code: string; name: string }[] =
    [];
  userRoles: UserRoleDto[] = [];
  selectedRoleCode = '';
  scopeUnitCode = '';
  loading = false;
  includeChildren = true;

  // Org tree for scope selection
  orgTree: TreeNode[] = [];
  selectedOrgNode: TreeNode | null = null;

  ngOnInit() {
    // Load danh sách roles khi component khởi tạo
    this.api.getRoles().subscribe((rs) => {
      this.roles = rs;
      this.roleOptions = rs.map((r) => ({
        label: `${r.name}`,
        value: r.code,
        code: r.code,
        name: r.name,
      }));
    });

    // Load org tree for scope selection
    this.dutyApi.getOrgTree().subscribe((nodes) => {
      console.log('Org tree response:', nodes); // Log API response for debugging

      const toTree = (n: any): TreeNode => ({
        key: n.code || 'UNKNOWN', // Fallback key
        label: `${n.name || 'Unknown'} (${n.code || 'N/A'})`, // Fallback label
        data: {
          code: n.code || 'UNKNOWN',
          id: n.id || 0,
          name: n.name || 'Unknown',
        },
        children: (n.children || []).map(toTree),
      });

      // Fallback logic if nodes are empty
      if (!nodes || nodes.length === 0) {
        this.orgTree = [
          {
            key: 'DEFAULT',
            label: 'Default Unit (DEFAULT)',
            data: { code: 'DEFAULT', id: 0, name: 'Default Unit' },
            children: [],
          },
        ];
        return;
      }

      // If backend returned a flat list (no children arrays populated), render as flat tree
      const looksFlat = nodes.every(
        (n: any) => !n.children || n.children.length === 0
      );
      if (looksFlat) {
        this.orgTree = nodes.map((n: any) => ({
          key: n.code || (n.id != null ? n.id.toString() : 'UNKNOWN'),
          label: `${n.name ?? n.code} (${n.code ?? 'N/A'})`,
          data: {
            code: n.code || 'UNKNOWN',
            id: n.id || 0,
            name: n.name || 'Unknown',
          },
          children: [],
        }));
      } else {
        this.orgTree = nodes.map(toTree);
      }
    });

    // Setup keyboard listener for Enter on AutoComplete
    setTimeout(() => {
      const inputEl =
        this.userAutoComplete?.el?.nativeElement?.querySelector('input');
      if (inputEl) {
        inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (
            e.key === 'Enter' &&
            this.filteredUsers.length > 0 &&
            !this.selectedUser
          ) {
            e.preventDefault();
            e.stopPropagation();
            const firstUser = this.filteredUsers[0];
            this.selectedUser = firstUser;
            this.username = firstUser.username;

            // Trigger same logic as onUserSelect
            this.loading = true;
            this.auth.ensureUserRole(firstUser.username).subscribe({
              next: (result) => {
                this.userRoles = result.roles;
                this.loading = false;
              },
              error: (err) => {
                this.loading = false;
                this.toast.add({
                  severity: 'error',
                  summary: 'Lỗi',
                  detail:
                    err?.error?.message || 'Không thể tải vai trò người dùng',
                });
              },
            });
          }
        });
      }
    }, 500);
  }

  searchUser(event: { query: string }) {
    this.api.searchUsers(event.query || undefined).subscribe((users) => {
      this.filteredUsers = users;

      // Auto-highlight first item when dropdown opens
      setTimeout(() => {
        const list = document.querySelector('ul.p-autocomplete-list');
        if (list) {
          const firstItem = list.querySelector('li:first-child');
          if (firstItem) {
            // Remove p-highlight from all items first
            list.querySelectorAll('li').forEach((item) => {
              item.classList.remove('p-highlight');
            });
            // Add p-highlight to first item
            firstItem.classList.add('p-highlight');
          }
        }
      }, 100);
    });
  }

  onUserSelect(event: AutoCompleteSelectEvent) {
    const user = event.value as UserSearchDto;
    console.log('🔵 onUserSelect triggered:', user);

    if (user && user.username) {
      this.username = user.username;
      this.selectedUser = user; // Ensure selectedUser is set

      this.loading = true;

      console.log('🚀 Calling ensureUserRole for:', user.username);

      // Auto-assign viewer role if user doesn't have any role (silent/background)
      // API sẽ tự động check, insert nếu cần, và trả về TOÀN BỘ roles của user
      this.auth.ensureUserRole(user.username).subscribe({
        next: (result) => {
          console.log('✅ ensureUserRole response:', result);
          console.log('   - Username:', result.username);
          console.log('   - NewlyAssigned:', result.newlyAssigned);
          console.log('   - Roles:', result.roles);
          console.log('   - Message:', result.message);

          // Nhận danh sách roles từ API luôn, không cần gọi getUserRoles nữa
          this.userRoles = result.roles;
          this.loading = false;
        },
        error: (err) => {
          console.error('❌ ensureUserRole error:', err);
          this.loading = false;
          this.toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err?.error?.message || 'Không thể tải vai trò người dùng',
          });
        },
      });
    }
  }

  lookup() {
    const usernameToLookup = this.selectedUser?.username || this.username;

    if (!usernameToLookup.trim()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Cảnh báo',
        detail: 'Vui lòng nhập hoặc chọn username',
      });
      return;
    }

    this.loading = true;

    // Simply load user roles
    this.api.getUserRoles(usernameToLookup).subscribe({
      next: (urs) => {
        this.userRoles = urs;
      },
      error: () => {
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không thể tải danh sách vai trò',
        });
      },
      complete: () => (this.loading = false),
    });
  }

  assign() {
    const usernameToAssign = this.selectedUser?.username || this.username;

    if (!usernameToAssign.trim()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Cảnh báo',
        detail: 'Vui lòng nhập hoặc chọn username',
      });
      return;
    }

    if (!this.selectedRoleCode) {
      this.toast.add({
        severity: 'warn',
        summary: 'Cảnh báo',
        detail: 'Vui lòng chọn vai trò',
      });
      return;
    }

    this.api
      .assignRole(
        usernameToAssign,
        this.selectedRoleCode,
        this.scopeUnitCode?.trim() || undefined,
        this.includeChildren
      )
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã gán vai trò',
          });
          this.selectedRoleCode = '';
          this.scopeUnitCode = '';
          this.selectedOrgNode = null;
          this.lookup();
        },
        error: (err) => {
          this.toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err?.error?.message || 'Không thể gán vai trò',
          });
        },
      });
  }

  assignViewer() {
    const usernameToAssign = this.selectedUser?.username || this.username;

    if (!usernameToAssign.trim()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Cảnh báo',
        detail: 'Vui lòng nhập hoặc chọn username',
      });
      return;
    }

    this.loading = true;

    // Call ensure-user-role endpoint to assign viewer role
    this.auth.ensureUserRole(usernameToAssign).subscribe({
      next: (result) => {
        if (result.newlyAssigned) {
          // User was assigned viewer role
          this.toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: `Đã gán vai trò Viewer cho ${usernameToAssign}`,
          });
        } else {
          // User already has roles
          this.toast.add({
            severity: 'info',
            summary: 'Thông báo',
            detail: `${usernameToAssign} đã có vai trò`,
          });
        }
        // Display all roles from API response
        this.userRoles = result.roles;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: err?.error?.message || 'Không thể gán vai trò Viewer',
        });
      },
    });
  }

  revoke(ur: UserRoleDto) {
    this.confirm.confirm({
      message: `Thu hồi vai trò "${ur.roleName}" (${ur.roleCode})?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Thu hồi',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.revokeRole(ur.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã thu hồi vai trò',
            });
            this.lookup();
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: err?.error?.message || 'Không thể thu hồi vai trò',
            });
          },
        });
      },
    });
  }

  onScopeNodeChange() {
    // Update scopeUnitCode when user picks a node in TreeSelect
    const node = this.selectedOrgNode as any;
    this.scopeUnitCode = node?.key || node?.data?.code || '';
  }

  clearScope() {
    this.selectedOrgNode = null;
    this.scopeUnitCode = '';
  }

  // AutoComplete clear handler: reset selection and table
  onUserCleared() {
    this.selectedUser = null;
    this.username = '';
    this.userRoles = [];
    this.selectedRoleCode = '';
    // keep scope selection as-is; comment out to also reset scope
    // this.clearScope();
  }

  // When the model changes to a falsy value (manual typing cleared), also clear table
  onUserModelChange(val: UserSearchDto | string | null) {
    if (!val || (typeof val === 'string' && !val.trim())) {
      this.onUserCleared();
    }
  }
}
