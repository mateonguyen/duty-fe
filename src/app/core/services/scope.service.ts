import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ScopeRef {
  orgId: string; // keep as string (may contain dots/leading zeros)
  displayName: string;
  includeChildren?: boolean; // true if scope includes child org units
}

export type FeatureKey =
  | 'roster.create'
  | 'roster.view'
  | 'roster.edit'
  | string;

// Phase 1: Stateless service for create page. Legacy state methods are disabled/no-op.

@Injectable({ providedIn: 'root' })
export class ScopeService {
  constructor(private http: HttpClient) {
    // Removed diagnostics injection and window helper
  }

  // Minimal per-feature in-memory state to support legacy consumers
  private featureState = new Map<
    FeatureKey,
    { items: ScopeRef[]; active?: ScopeRef; loading: boolean; error?: string }
  >();

  /**
   * Initialize scopes from JWT/decoded data (called after login or app reload)
   */
  // Deprecated: removed stateful init
  setInitial(_: Record<FeatureKey | string, ScopeRef[]>) {}

  /**
   * Load scopes for a given feature from local state (no HTTP).
   * Returns observable that emits scope list and ensures activeScope is set appropriately.
   */
  /**
   * Load scopes from backend (no caching in JWT). Minimal in-memory cache per feature.
   */
  load(feature: FeatureKey): Observable<ScopeRef[]> {
    const params = new HttpParams().set('feature', feature);

    // Initialize state
    if (!this.featureState.has(feature)) {
      this.featureState.set(feature, { items: [], loading: true });
    } else {
      const st = this.featureState.get(feature)!;
      st.loading = true;
      st.error = undefined;
    }

    return this.http
      .get<{ items: ScopeRef[] }>(`/api/scopes/effective`, { params })
      .pipe(
        map((res) => res.items ?? []),
        map((items) => {
          // Update in-memory state
          const st = this.featureState.get(feature)!;
          st.items = items;
          st.loading = false;
          if (!st.active && items.length > 0) st.active = items[0];
          return items;
        })
      );
  }

  /**
   * Get list of scopes for a feature (already loaded)
   */
  // Disabled stateful methods (Phase 1): return safe defaults
  getScopes(_: FeatureKey): ScopeRef[] {
    const st = this.featureState.get(_);
    return st ? st.items : [];
  }

  /**
   * Get currently active scope for a feature
   */
  getActiveScope(_: FeatureKey): ScopeRef | null {
    const st = this.featureState.get(_);
    return st?.active ?? null;
  }

  /**
   * Set active scope for a feature
   */
  setActiveScope(_: FeatureKey, __: ScopeRef) {}

  /**
   * Ensure there is an active scope for a feature; if none, pick the first.
   */
  ensureActive(_: FeatureKey) {}

  /**
   * Check if scopes are loaded and ready for a feature
   */
  isReady(_: FeatureKey): boolean {
    const st = this.featureState.get(_);
    return !!st && !st.loading;
  }

  /**
   * Check if loading scopes for a feature
   */
  isLoading(_: FeatureKey): boolean {
    const st = this.featureState.get(_);
    return !!st && st.loading;
  }

  /**
   * Get error message if scope loading failed
   */
  getError(_: FeatureKey): string | null {
    const st = this.featureState.get(_);
    return st?.error ?? null;
  }

  /**
   * Clear state for a feature (useful on logout or feature exit)
   */
  clearFeature(_: FeatureKey) {}

  /**
   * Clear all scope state
   */
  clearAll() {}

  // --- Private helpers ---
  // --- Private helpers ---
  private getFeatureState(feature: FeatureKey) {
    return this.featureState.get(feature);
  }

  private updateFeatureState(
    feature: FeatureKey,
    payload: Partial<{
      items: ScopeRef[];
      active?: ScopeRef;
      loading: boolean;
      error?: string;
    }>
  ) {
    const cur = this.featureState.get(feature) || { items: [], loading: false };
    const merged = { ...cur, ...payload } as {
      items: ScopeRef[];
      active?: ScopeRef;
      loading: boolean;
      error?: string;
    };
    this.featureState.set(feature, merged);
  }

  private saveLastUsedScope(feature: FeatureKey, scope: ScopeRef) {
    try {
      localStorage.setItem(`scope.last.${feature}`, JSON.stringify(scope));
    } catch {}
  }

  private getLastUsedScope(feature: FeatureKey): ScopeRef | null {
    try {
      const raw = localStorage.getItem(`scope.last.${feature}`);
      if (!raw) return null;
      return JSON.parse(raw) as ScopeRef;
    } catch {
      return null;
    }
  }
  private restoreLastUsedScopes() {
    // No-op for now
  }

  /**
   * Check if user has a specific permission at a given scope.
   * Returns true if the scope is in the list of effective scopes for that permission.
   */
  hasPermissionInScope(permission: string, scopeCode: string | null): boolean {
    if (!scopeCode) return false; // catalog.* permissions are scoped
    const scopes = this.getScopes(permission);
    return scopes.some((s) => s.orgId === scopeCode);
  }

  /** Dev-only: dump current scope state to console */
  dump() {
    console.debug('[ScopeService] dump (stateless phase): none');
    return {};
  }

  // Expose quick dev helper on window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _attachWindowHelper() {}
}
