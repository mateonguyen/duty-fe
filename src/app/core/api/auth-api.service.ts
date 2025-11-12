import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  PermissionDto,
  RoleDto,
  RoleDetailDto,
  UserRoleDto,
  UserSearchDto,
} from '../../shared/models/auth';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private base = '/api/auth';
  constructor(private http: HttpClient) {}

  // Current user's permissions
  getMyPermissions() {
    return this.http.get<PermissionDto[]>(`${this.base}/permissions`);
  }

  // Roles
  getRoles() {
    return this.http.get<RoleDto[]>(`${this.base}/roles`);
  }
  getRoleDetail(code: string) {
    return this.http.get<RoleDetailDto>(`${this.base}/roles/${code}`);
  }
  createRole(role: {
    code: string;
    name: string;
    description?: string;
    isSystemRole?: boolean;
    active?: boolean;
  }) {
    return this.http.post<RoleDto>(`${this.base}/roles`, role);
  }
  updateRole(
    code: string,
    role: {
      name: string;
      description?: string;
      isSystemRole?: boolean;
      active?: boolean;
    }
  ) {
    return this.http.put<RoleDto>(`${this.base}/roles/${code}`, role);
  }
  deleteRole(code: string) {
    return this.http.delete(`${this.base}/roles/${code}`);
  }
  updateRolePermissions(code: string, permissionCodes: string[]) {
    return this.http.put(
      `${this.base}/roles/${code}/permissions`,
      permissionCodes
    );
  }

  // Users & roles
  assignRole(
    username: string,
    roleCode: string,
    scopeUnitCode?: string,
    includeChildren: boolean = true
  ) {
    return this.http.post(`${this.base}/assign-role`, {
      username,
      roleCode,
      scopeUnitCode,
      includeChildren,
    });
  }
  revokeRole(userRoleId: number) {
    return this.http.post(`${this.base}/revoke-role`, { userRoleId });
  }
  getUserRoles(username: string) {
    return this.http.get<UserRoleDto[]>(`${this.base}/user-roles`, {
      params: { username },
    });
  }

  getAllPermissions() {
    return this.http.get<PermissionDto[]>(`${this.base}/all-permissions`);
  }

  searchUsers(keyword?: string) {
    return this.http.get<UserSearchDto[]>(`${this.base}/users/search`, {
      params: keyword ? { q: keyword } : {},
    });
  }

  // Lấy danh sách cán bộ từ EOffice (public - không yêu cầu permission)
  getStaff(keyword?: string) {
    return this.http.get<UserSearchDto[]>(`${this.base}/staff`, {
      params: keyword ? { q: keyword } : {},
    });
  }

  // Server-resolved scopes where current user may create rosters
  getMyCreateScopes() {
    return this.http.get<string[]>(`${this.base}/my-create-scopes`);
  }
}
