import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TokenService } from './token.service';
import { UserRoleDto, RoleDetailDto } from '../../shared/models/auth';
import { AuthApiService } from '../api/auth-api.service';

export interface LoginRequest {
  username: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  token = signal<string | null>(null);
  username = signal<string | null>(null);
  displayName = signal<string | null>(null);
  myClaims = signal<Array<{ type: string; value: string }>>([]);
  permissions = signal<string[]>([]);
  userRoles = signal<UserRoleDto[]>([]);

  roleDetails = signal<Record<string, RoleDetailDto | null>>({});
  rolesGrantingRosterCreate = signal<string[]>([]);

  constructor(
    private http: HttpClient,
    private router: Router,
    private tokens: TokenService,
    private authApi: AuthApiService
  ) {
    const t = this.tokens.getToken();
    if (t) {
      this.token.set(t);
      this.fetchWhoAmI().subscribe({
        next: (info: any) => {
          this.username.set(info.username);
          this.displayName.set(info.displayName || info.username);
          this.myClaims.set(info.claims || []);
          if (info.username) {
            this.fetchPermissions(info.username);
            this.fetchUserRoles(info.username);
          }
        },
        error: () => {},
      });
    }
  }

  login(req: LoginRequest) {
    return this.http.post<LoginResponse>('/api/authtest/login', req);
  }

  storeToken(token: string) {
    this.tokens.setToken(token);
    this.token.set(token);
  }

  fetchPermissions(username: string) {
    this.http
      .get<string[]>(`/api/auth/permissions?username=${username}`)
      .subscribe({
        next: (perms) => this.permissions.set(perms || []),
        error: () => this.permissions.set([]),
      });
  }

  fetchUserRoles(username: string) {
    this.http
      .get<UserRoleDto[]>(`/api/auth/user-roles?username=${username}`)
      .subscribe({
        next: (roles: UserRoleDto[]) => {
          console.debug('AuthServiceFixed.fetchUserRoles: received', roles);
          const safeRoles = roles || [];
          this.userRoles.set(safeRoles);

          const distinct = Array.from(
            new Set(safeRoles.map((r: UserRoleDto) => r.roleCode))
          ).filter(Boolean) as string[];
          distinct.forEach((code) => {
            const cache = this.roleDetails() || {};
            if (cache[code]) return;
            this.authApi.getRoleDetail(code).subscribe({
              next: (detail: RoleDetailDto) => {
                console.debug(
                  `AuthServiceFixed: fetched roleDetail ${code}`,
                  detail
                );
                const cur = this.roleDetails() || {};
                this.roleDetails.set({ ...cur, [code]: detail });
                this.recomputeRolesGrantingRosterCreate();
              },
              error: (err) => {
                console.warn(
                  `AuthServiceFixed: failed to fetch roleDetail ${code}`,
                  err && (err as any).status
                    ? `status=${(err as any).status}`
                    : err
                );
                const cur = this.roleDetails() || {};
                this.roleDetails.set({ ...cur, [code]: null });
                this.recomputeRolesGrantingRosterCreate();
              },
            });
          });

          this.recomputeRolesGrantingRosterCreate();
        },
        error: () => this.userRoles.set([]),
      });
  }

  private recomputeRolesGrantingRosterCreate() {
    const details = this.roleDetails() || {};
    const roles = (this.userRoles() || [])
      .map((r: UserRoleDto) => r.roleCode)
      .filter(Boolean) as string[];

    const granting: string[] = [];
    roles.forEach((rc) => {
      const d = details[rc];
      if (
        d &&
        d.permissions &&
        d.permissions.some((p) => p.code === 'roster.create')
      ) {
        granting.push(rc);
      }
    });

    this.rolesGrantingRosterCreate.set(granting);
  }

  getRosterCreateScopes(): string[] {
    const staticFallback = [
      'ADMIN',
      'ROSTER_MANAGER',
      'PHONG_MANAGER',
      'EDITOR',
      'ROSTER_EDITOR',
      'PHONG_EDITOR',
      'DEPT_MANAGER',
    ];
    const roles = this.userRoles() || [];
    const grantingRoleCodes = this.rolesGrantingRosterCreate() || [];

    return roles
      .filter((role: UserRoleDto) => {
        if (grantingRoleCodes.length > 0)
          return grantingRoleCodes.includes(role.roleCode);
        return staticFallback.includes(role.roleCode);
      })
      .map((role: UserRoleDto) =>
        role.scopeUnitCode && role.scopeUnitCode.trim() !== ''
          ? role.scopeUnitCode
          : 'CUC'
      )
      .filter(
        (code: string, index: number, self: string[]) =>
          self.indexOf(code) === index
      );
  }

  canCreateRosterCuc(): boolean {
    return this.getRosterCreateScopes().includes('CUC');
  }

  canCreateRosterPhong(): boolean {
    const scopes = this.getRosterCreateScopes();
    return scopes.some((s) => s !== 'CUC');
  }

  getRosterPhongScopes(): string[] {
    return this.getRosterCreateScopes().filter((s) => s !== 'CUC');
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAnyPermission(...permissions: string[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  getToken(): string | null {
    return this.tokens.getToken();
  }

  logout(navigate = true) {
    this.tokens.clear();
    this.token.set(null);
    this.username.set(null);
    this.displayName.set(null);
    this.myClaims.set([]);
    this.permissions.set([]);
    if (navigate) this.router.navigateByUrl('/login');
  }

  fetchWhoAmI() {
    return this.http.get<{
      username: string;
      displayName?: string;
      claims: { type: string; value: string }[];
    }>('/api/authtest/whoami');
  }

  ensureUserRole(username: string) {
    return this.http.post<{
      username: string;
      newlyAssigned: boolean;
      roles: UserRoleDto[];
      message: string;
    }>(
      `/api/auth/ensure-user-role?username=${encodeURIComponent(username)}`,
      {}
    );
  }
}
