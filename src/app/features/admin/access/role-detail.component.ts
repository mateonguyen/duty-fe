import { permissionName, permissionGroupName, UNIMPLEMENTED_PERMISSIONS, PERMISSION_DEPENDENCIES } from './permission-display';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { AuthApiService } from '../../../core/api/auth-api.service';
import { finalize } from 'rxjs';
import { PermissionDto, RoleDetailDto } from '../../../shared/models/auth';

@Component({
  selector: 'app-role-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    CardModule,
    CheckboxModule,
    InputTextModule,
  ],
  templateUrl: './role-detail.component.html',
  styleUrls: ['./role-detail.component.scss'],
})
export class RoleDetailComponent implements OnInit {
  isProtectedRole = (code?: string | null): boolean => code?.toUpperCase() === 'DIRECTORY_ADMIN';
  private route = inject(ActivatedRoute);
  private api = inject(AuthApiService);

  role = signal<RoleDetailDto | null>(null);
  allPermissions = signal<PermissionDto[]>([]);
  saving = signal(false);
  saveError = '';
  saveSuccess = false;
  editedPerms: Set<string> | null = null;
  permGroups: { prefix: string; items: PermissionDto[]; open: boolean }[] = [];
  permFilter = '';

  ngOnInit(): void {
    const code = (this.route as ActivatedRoute).snapshot.paramMap.get('code')!;
    this.api.getRoleDetail(code).subscribe((r) => {
      this.role.set(r);
      this.editedPerms = new Set(r.permissions?.map((p) => p.code) ?? []);
    });
    this.api.getAllPermissions().subscribe((p) => {
      this.allPermissions.set(p);
      this.permGroups = this.groupPermissions(p);
    });
  }

  permissionName = permissionName;
  permissionGroupName = permissionGroupName;
  isUnimplemented = (code: string) => UNIMPLEMENTED_PERMISSIONS.has(code);

  groupPermissions(
    perms: PermissionDto[]
  ): { prefix: string; items: PermissionDto[]; open: boolean }[] {
    const map = new Map<
      string,
      { prefix: string; items: PermissionDto[]; open: boolean }
    >();
    for (const p of perms) {
      const prefix = p.code.split('.')[0];
      if (!map.has(prefix)) map.set(prefix, { prefix, items: [], open: true });
      map.get(prefix)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.prefix.localeCompare(b.prefix)
    );
  }

  toggleGroupOpen(g: {
    prefix: string;
    items: PermissionDto[];
    open: boolean;
  }) {
    g.open = !g.open;
  }

  selectAllInGroup(
    g: { prefix: string; items: PermissionDto[]; open: boolean },
    checked: boolean
  ) {
    if (!this.editedPerms) return;
    for (const p of g.items) {
      if (UNIMPLEMENTED_PERMISSIONS.has(p.code)) continue;
      this.togglePermission(p.code, checked);
    }
  }

  isChecked(code: string): boolean {
    return !!this.editedPerms?.has(code);
  }

  isGroupChecked(g: {
    prefix: string;
    items: PermissionDto[];
    open: boolean;
  }): boolean {
    if (!this.editedPerms) return false;
    return g.items.filter(p => !UNIMPLEMENTED_PERMISSIONS.has(p.code)).every((p) => this.editedPerms!.has(p.code));
  }

  togglePermission(code: string, checked: boolean) {
    if (!this.editedPerms || UNIMPLEMENTED_PERMISSIONS.has(code)) return;
    if (checked) {
      this.editedPerms.add(code);
      for (const dependency of PERMISSION_DEPENDENCIES[code] || []) this.editedPerms.add(dependency);
    } else {
      this.editedPerms.delete(code);
      for (const [dependent, prerequisites] of Object.entries(PERMISSION_DEPENDENCIES)) {
        if (prerequisites.includes(code)) this.editedPerms.delete(dependent);
      }
    }
  }

  savePermissions() {
    if (!this.role() || this.isProtectedRole(this.role()?.code) || !this.editedPerms) return;
    this.saving.set(true);
    this.saveError = '';
    this.saveSuccess = false;
    this.api
      .updateRolePermissions(this.role()!.code, Array.from(this.editedPerms))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          const updated = this.allPermissions().filter((p) =>
            this.editedPerms!.has(p.code)
          );
          this.role.update((r) => (r ? { ...r, permissions: updated } : r));
          this.saveSuccess = true;
        },
        error: () => this.saveError = 'Không lưu được quyền của vai trò.',
      });
  }
}
