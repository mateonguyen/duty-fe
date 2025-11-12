import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ScopeRef {
  orgId: string; // keep as string (may contain dots/leading zeros)
  displayName: string;
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
    return this.http
      .get<{ items: ScopeRef[] }>(`/api/scopes/effective`, { params })
      .pipe(map((res) => res.items ?? []));
  }

  /**
   * Get list of scopes for a feature (already loaded)
   */
  // Disabled stateful methods (Phase 1): return safe defaults
  getScopes(_: FeatureKey): ScopeRef[] {
    return [];
  }

  /**
   * Get currently active scope for a feature
   */
  getActiveScope(_: FeatureKey): ScopeRef | null {
    return null;
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
    return false;
  }

  /**
   * Check if loading scopes for a feature
   */
  isLoading(_: FeatureKey): boolean {
    return false;
  }

  /**
   * Get error message if scope loading failed
   */
  getError(_: FeatureKey): string | null {
    return null;
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
  // Removed feature state map
  private getFeatureState(_: FeatureKey): any {
    return undefined;
  }

  private updateFeatureState(_: FeatureKey, __: any) {}

  private saveLastUsedScope(_: FeatureKey, __: ScopeRef) {}
  private getLastUsedScope(_: FeatureKey): ScopeRef | null {
    return null;
  }
  private restoreLastUsedScopes() {}

  /** Dev-only: dump current scope state to console */
  dump() {
    console.debug('[ScopeService] dump (stateless phase): none');
    return {};
  }

  // Expose quick dev helper on window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _attachWindowHelper() {}
}
