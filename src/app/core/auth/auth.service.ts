import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MeResponse {
  username?: string;
  fullName?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // BFF Pure Mode: Only use cookies (no token storage)
  user = signal<MeResponse | null>(null);
  isAuthenticated = signal<boolean>(false);
  loading = signal<boolean>(false);
  sessionState = signal<'unknown' | 'authenticated' | 'unauthenticated' | 'forbidden' | 'error'>('unknown');
  sessionError = signal('');
  private pendingMe?: Promise<void>;
  private readonly loginAttemptKey = 'duty.bff.loginAttempted';

  // Derived signals for backward compatibility
  isLoggedIn = computed(() => this.isAuthenticated());
  username = computed(() => this.user()?.username || null);
  fullName = computed(() => this.user()?.fullName || null);
  displayName = computed(
    () => this.user()?.fullName || this.user()?.username || null,
  );
  email = computed(() => this.user()?.email || null);
  roles = computed(() => this.user()?.roles || []);
  permissions = computed(() => this.user()?.permissions || []);

  constructor(private http: HttpClient) {}

  /**
   * Load user identity from BFF /auth/me endpoint.
   * Non-blocking: resolves when response arrives (or fails).
   */
  loadMe(force = false): Promise<void> {
    if (this.pendingMe) return this.pendingMe;
    if (!force && this.sessionState() !== 'unknown') return Promise.resolve();
    this.pendingMe = this.fetchMe().finally(() => { this.pendingMe = undefined; });
    return this.pendingMe;
  }

  private async fetchMe(): Promise<void> {
    const apiBase = environment.apiBaseUrl;
    this.loading.set(true);
    try {
      const me = await firstValueFrom(
        this.http.get<MeResponse>(`${apiBase}/auth/me`, {
          withCredentials: true,
        }),
      );
      this.user.set(me);
      this.isAuthenticated.set(true);
      this.sessionState.set('authenticated');
      this.sessionError.set('');
      sessionStorage.removeItem(this.loginAttemptKey);
    } catch (err: any) {
      this.user.set(null);
      this.isAuthenticated.set(false);
      this.sessionState.set(err.status === 403 ? 'forbidden' : err.status === 401 ? 'unauthenticated' : 'error');
      this.sessionError.set(err.error?.error || (err.status === 403
        ? 'Tài khoản chưa được cấp quyền truy cập hệ thống.'
        : err.status === 401 ? 'Không nhận được phiên đăng nhập. Hãy kiểm tra cookie hoặc đăng nhập lại.'
        : 'Không kiểm tra được phiên đăng nhập. Kiểm tra kết nối backend rồi thử lại.'));
    } finally {
      this.loading.set(false);
    }
  }

  login(returnUrl?: string): void {
    const apiBase = environment.apiBaseUrl;
    const ret = returnUrl
      ? returnUrl
      : window.location.pathname.startsWith('/auth')
        ? window.location.origin
        : window.location.href;
    sessionStorage.setItem(this.loginAttemptKey, '1');
    window.location.href = `${apiBase}/auth/login?returnUrl=${encodeURIComponent(ret)}`;
  }

  /** One automatic SSO navigation per tab until a BFF session is confirmed. */
  tryAutomaticLogin(returnUrl: string): boolean {
    if (sessionStorage.getItem(this.loginAttemptKey) === '1') return false;
    this.login(returnUrl);
    return true;
  }

  logout(): void {
    const apiBase = environment.apiBaseUrl;
    const returnUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${apiBase}/auth/logout?returnUrl=${returnUrl}`;
  }

  clear(): void {
    this.user.set(null);
    this.isAuthenticated.set(false);
    this.sessionState.set('unknown');
    this.sessionError.set('');
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: string[] | string): boolean {
    const myRoles = this.roles();
    if (Array.isArray(roles)) return roles.some((r) => myRoles.includes(r));
    return myRoles.includes(roles as string);
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAnyPermission(permissions: string[] | string): boolean {
    const myPerms = this.permissions();
    if (Array.isArray(permissions))
      return permissions.some((p) => myPerms.includes(p));
    return myPerms.includes(permissions as string);
  }

  whoamiSnapshot() {
    return {
      username: this.username() || '',
      displayName: this.displayName(),
      permissions: this.permissions(),
    };
  }

  ensureUserRole(username: string): Observable<any> {
    return this.http.post(
      `/api/auth/ensure-user-role?username=${encodeURIComponent(username)}`,
      {},
    );
  }
}
