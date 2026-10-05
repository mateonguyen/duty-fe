import {
  Component,
  inject,
  OnInit,
  ViewChild,
  ElementRef,
  computed,
  signal,
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
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { ChipModule } from 'primeng/chip';
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
    CheckboxModule,
    AccordionModule,
    ChipModule,
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
  userRoles = signal<UserRoleDto[]>([]);
  selectedRoleCode = '';
  scopeUnitCode = '';
  loading = false;
  includeChildren = true;

  // Role priority mapping for sorting
  private rolePriorityMap: Record<string, number> = {
    admin: 1,
    manager: 2,
    editor: 3,
    viewer: 4,
  };

  // Grouped roles for display
  groupedRoles = computed(() => {
    const roles = this.userRoles();
    if (!roles.length) return [];

    // Sort by role priority first
    const sorted = [...roles].sort((a, b) => {
      const priorityA = this.rolePriorityMap[a.roleCode.toLowerCase()] || 99;
      const priorityB = this.rolePriorityMap[b.roleCode.toLowerCase()] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      // If same priority, sort by role name
      return a.roleName.localeCompare(b.roleName);
    });

    // Group by roleCode
    const grouped = new Map<
      string,
      { roleName: string; roleCode: string; scopes: UserRoleDto[] }
    >();
    sorted.forEach((role) => {
      if (!grouped.has(role.roleCode)) {
        grouped.set(role.roleCode, {
          roleName: role.roleName,
          roleCode: role.roleCode,
          scopes: [],
        });
      }
      grouped.get(role.roleCode)!.scopes.push(role);
    });

    return Array.from(grouped.values());
  });

  // Org tree for scope selection
  orgTree: TreeNode[] = [];
  selectedOrgNode: TreeNode | null = null;
  // Map org code -> display name for quick lookup when rendering scopes
  orgNameMap: Record<string, string> = {};

  // Helper: Get scope display name for chip
  getScopeChipLabel(scope: UserRoleDto): string {
    if (!scope.scopeUnitCode) {
      return 'Toàn cục';
    }
    const name = this.orgNameMap[scope.scopeUnitCode] || scope.scopeUnitCode;
    return `${name} (${scope.scopeUnitCode})`;
  }

  // Helper: Get visible scopes (max 2 rows worth of chips)
  getVisibleScopes(scopes: UserRoleDto[]): UserRoleDto[] {
    return scopes.slice(0, 6); // Show max ~6 chips (2 rows)
  }

  // Helper: Get hidden count
  getHiddenCount(scopes: UserRoleDto[]): number {
    return Math.max(0, scopes.length - 6);
  }

  // Helper: Get full scope list for tooltip
  getFullScopeTooltip(scopes: UserRoleDto[]): string {
    return scopes.map((s) => this.getScopeChipLabel(s)).join('\n');
  }

  // Helper: Get role icon class
  getRoleIconClass(roleCode: string): string {
    const code = roleCode.toLowerCase();
    if (code === 'admin') return 'pi-shield text-red-600';
    if (code === 'manager') return 'pi-users text-blue-600';
    if (code === 'editor') return 'pi-pencil text-amber-600';
    if (code === 'viewer') return 'pi-eye text-green-600';
    return 'pi-tag text-slate-600';
  }

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
        expanded: true, // Auto-expand all nodes
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
          expanded: true,
        }));
        // Build quick lookup map
        this.orgNameMap = {};
        this.orgTree.forEach((nd) => {
          const code = (nd.data as any)?.code;
          const name = (nd.data as any)?.name || nd.label || code;
          if (code) this.orgNameMap[code] = name;
        });
      } else {
        this.orgTree = nodes.map(toTree);
        // Build lookup map recursively
        this.orgNameMap = {};
        const walk = (n: any) => {
          const code = n.code || (n.data && n.data.code) || null;
          const name = n.name || (n.data && n.data.name) || n.label || code;
          if (code) this.orgNameMap[code] = name;
          (n.children || []).forEach(walk);
        };
        nodes.forEach(walk);
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
            this.lookup();
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
    if (user && user.username) {
      this.username = user.username;
      this.selectedUser = user;
      this.lookup();
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

    console.log('[UserRoles] Looking up roles for user:', usernameToLookup);
    this.loading = true;

    // Simply load user roles
    this.api.getUserRoles(usernameToLookup).subscribe({
      next: (urs) => {
        console.log('[UserRoles] Roles loaded, count:', urs.length);
        this.userRoles.set(urs);
      },
      error: (err) => {
        console.error('[UserRoles] Lookup failed:', err);
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

    console.log('[UserRoles] Assign payload:', {
      username: usernameToAssign,
      roleCode: this.selectedRoleCode,
      scopeUnitCode: this.scopeUnitCode,
      includeChildren: this.includeChildren,
    });

    this.loading = true;

    this.api
      .assignRole(
        usernameToAssign,
        this.selectedRoleCode,
        this.scopeUnitCode?.trim() || undefined,
        this.includeChildren
      )
      .subscribe({
        next: () => {
          console.log(
            '[UserRoles] Assign success, reloading roles for user:',
            usernameToAssign
          );

          this.toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã gán vai trò',
          });

          // Reset form fields
          this.selectedRoleCode = '';
          this.scopeUnitCode = '';
          this.selectedOrgNode = null;

          // CRITICAL FIX: Load roles for the SPECIFIC user we just assigned
          // Don't rely on lookup() which may use stale selectedUser
          this.api.getUserRoles(usernameToAssign).subscribe({
            next: (urs) => {
              console.log('[UserRoles] Roles loaded, count:', urs.length);
              this.userRoles.set(urs);
              this.loading = false;
            },
            error: (err) => {
              console.error('[UserRoles] Failed to reload roles:', err);
              this.loading = false;
              this.toast.add({
                severity: 'error',
                summary: 'Lỗi',
                detail: 'Không thể tải lại danh sách vai trò',
              });
            },
          });
        },
        error: (err) => {
          console.error('[UserRoles] Assign failed:', err);
          this.loading = false;
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
        this.userRoles.set(result.roles);
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
    const usernameToRevoke = this.selectedUser?.username || this.username;

    this.confirm.confirm({
      message: `Thu hồi vai trò "${ur.roleName}" (${ur.roleCode})?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Thu hồi',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        console.log(
          '[UserRoles] Revoking role:',
          ur.roleName,
          'from user:',
          usernameToRevoke
        );
        this.loading = true;

        this.api.revokeRole(ur.id).subscribe({
          next: () => {
            console.log('[UserRoles] Revoke success, reloading roles');
            this.toast.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã thu hồi vai trò',
            });

            // Reload roles for the specific user whose role was revoked
            this.api.getUserRoles(usernameToRevoke).subscribe({
              next: (urs) => {
                console.log(
                  '[UserRoles] Roles loaded after revoke, count:',
                  urs.length
                );
                this.userRoles.set(urs);
                this.loading = false;
              },
              error: (err) => {
                console.error(
                  '[UserRoles] Failed to reload roles after revoke:',
                  err
                );
                this.loading = false;
              },
            });
          },
          error: (err) => {
            console.error('[UserRoles] Revoke failed:', err);
            this.toast.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: err?.error?.message || 'Không thể thu hồi vai trò',
            });
            this.loading = false;
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
    this.userRoles.set([]);
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
