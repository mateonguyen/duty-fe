import { Injectable, Injector, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { TokenService } from './token.service';
import { UserRoleDto, RoleDetailDto } from '../../shared/models/auth';
import { AuthApiService } from '../api/auth-api.service';
import { decodeToken } from './jwt-util';
import { ScopeService } from '../services/scope.service';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  permissions?: string[];
  scopes?: string[];
}

export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  email?: string;
}

export interface ScopeRef {
  orgId: string; // keep as string, may contain dots/leading zeros
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  token = signal<string | null>(null);
  username = signal<string | null>(null);
  displayName = signal<string | null>(null);
  email = signal<string | null>(null);
  myClaims = signal<Array<{ type: string; value: string }>>([]);
  isAuthenticated = signal<boolean>(false);

  myRoles = signal<string[]>([]);
  myPermissions = signal<string[]>([]);

  // Legacy snapshot (kept minimal for existing directives); will be removed later
  whoamiSnapshot = signal<{
    username: string;
    displayName?: string;
    permissions?: string[];
  } | null>(null);

  userRoles = signal<UserRoleDto[]>([]);
  roleDetails = signal<Record<string, RoleDetailDto | null>>({});
  rolesGrantingRosterCreate = signal<string[]>([]);
  rosterCreateScopes = signal<string[] | null>(null);

  private logoutInProgress = false;
  private authReadyResolve: (() => void) | null = null;
  private authReadyPromise: Promise<void> = new Promise(
    (res) => (this.authReadyResolve = res)
  );
  private _authReady = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private tokens: TokenService,
    private authApi: AuthApiService,
    private injector: Injector
  ) {
    const t = this.tokens.getToken();
    if (t) {
      this.token.set(t);
      this.loadFromStorageOnStart();
      this.resolveAuthReady();
    }
  }

  private loadFromStorageOnStart() {
    const token = this.tokens.getToken();
    if (!token) {
      this.clearState(false);
      return;
    }
    const decoded = decodeToken(token);
    const now = Math.floor(Date.now() / 1000);
    const exp =
      decoded && (decoded as any)['exp'] ? (decoded as any)['exp'] : 0;
    if (exp && exp < now + 15) {
      this.clearState(true);
      return;
    }
    this.applyToken(token, decoded);
  }

  storeToken(token: string) {
    this.tokens.setToken(token);
    this.token.set(token);
    const decoded = decodeToken(token);
    this.applyToken(token, decoded);
  }

  private applyToken(token: string, decoded: any) {
    const username = decoded?.sub || decoded?.username || decoded?.name;
    this.username.set(username || null);
    this.displayName.set(
      decoded?.name || decoded?.displayName || username || null
    );
    this.email.set(decoded?.email || null);

    const perms = Array.isArray(decoded?.permissions)
      ? decoded.permissions
      : decoded?.permissions || [];
    this.myPermissions.set(perms);

    this.whoamiSnapshot.set({
      username: this.username() || '',
      displayName: this.displayName() || undefined,
      permissions: perms,
    });

    this.isAuthenticated.set(true); // scopes removed from JWT; no initialization here
    this.resolveAuthReady();
  }

  private resolveAuthReady() {
    if (!this._authReady) {
      this._authReady = true;
      this.authReadyResolve?.();
    }
  }

  // Compatibility helpers for existing code
  get authReady$(): Promise<void> {
    return this.authReadyPromise;
  }

  isAuthReady(): boolean {
    return this._authReady;
  }

  login(req: { username: string; password: string }) {
    return this.http.post<{ token: string }>('/api/authtest/login', req).pipe(
      tap((res) => {
        if (res?.token) {
          this.storeToken(res.token);
        }
      })
    );
  }

  private clearState(navigate = true) {
    this.tokens.clear();
    this.token.set(null);
    this.username.set(null);
    this.displayName.set(null);
    this.email.set(null);
    this.myClaims.set([]);
    this.myRoles.set([]);
    this.myPermissions.set([]);
    this.whoamiSnapshot.set(null);
    this.isAuthenticated.set(false);
    this.userRoles.set([]);
    this.roleDetails.set({});
    this.rolesGrantingRosterCreate.set([]);
    this.rosterCreateScopes.set([]);
    localStorage.removeItem('rosterCreateScopes');
    try {
      const scopeService = this.injector.get(ScopeService as any, null);
      scopeService?.clearAll?.();
    } catch {}
    if (navigate) this.router.navigateByUrl('/login');
  }

  private getJwtPermissions(): string[] {
    const token = this.getToken();
    const decoded = decodeToken(token);
    if (decoded && Array.isArray(decoded.permissions))
      return decoded.permissions;
    return [];
  }

  getAllPermissions(): string[] {
    const myPerms = this.myPermissions();
    if (myPerms.length > 0) return myPerms;
    const snap = this.whoamiSnapshot();
    if (snap?.permissions) return snap.permissions;
    return this.getJwtPermissions();
  }

  hasPermission(permission: string): boolean {
    if (!this.isAuthenticated()) return false;
    return this.getAllPermissions().includes(permission);
  }

  hasAnyPermission(perms: string[] | string): boolean {
    if (!this.isAuthenticated()) return false;
    const all = this.getAllPermissions();
    if (Array.isArray(perms)) return perms.some((p) => all.includes(p));
    return all.includes(perms as string);
  }

  getToken(): string | null {
    return this.tokens.getToken();
  }

  async logout(navigate = true) {
    if (this.logoutInProgress) return;
    this.logoutInProgress = true;
    this.clearState(navigate);
    setTimeout(() => (this.logoutInProgress = false), 0);
  }

  reloadMyPermissions() {
    // No-op: permissions are now in JWT, so must re-login to refresh
  }

  // Removed fetchWhoAmI(): JWT-only, no whoami endpoint usage

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
