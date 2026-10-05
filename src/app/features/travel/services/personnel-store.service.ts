import { Injectable, signal, computed } from '@angular/core';
import { PersonnelApiService, PersonnelDto } from './personnel-api.service';
import { Observable, of, firstValueFrom } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PersonnelStoreService {
  private _scopeCache = new Map<string, PersonnelDto[]>();
  private _selectedScopeKey = signal<'unit' | 'dept' | 'all'>('unit');
  private _selectedOrgCode = signal<string>('');
  private _selectedIncludeChildren = signal<boolean>(false);
  private _scopePersonnel = signal<PersonnelDto[]>([]);
  private _loading = signal<boolean>(false);

  constructor(private api: PersonnelApiService) {}

  // Current selection signals
  selectedScopeKey = computed(() => this._selectedScopeKey());
  selectedOrgCode = computed(() => this._selectedOrgCode());
  selectedIncludeChildren = computed(() => this._selectedIncludeChildren());
  loading = computed(() => this._loading());

  // Personnel for current scope
  getScopePersonnel(): PersonnelDto[] {
    return this._scopePersonnel();
  }

  // Change selection and reload personnel
  setScope(
    scopeKey: 'unit' | 'dept' | 'all',
    orgCode: string,
    includeChildren: boolean = false
  ): Observable<PersonnelDto[]> {
    console.log('[PersonnelStore] setScope to', {
      scopeKey,
      orgCode,
      includeChildren,
    });

    const cacheKey = `${scopeKey}|${orgCode}|${includeChildren}`;
    if (
      this._selectedScopeKey() === scopeKey &&
      this._selectedOrgCode() === orgCode &&
      this._selectedIncludeChildren() === includeChildren &&
      this._scopeCache.has(cacheKey)
    ) {
      const cached = this._scopeCache.get(cacheKey) || [];
      console.log(
        '[PersonnelStore] setScope using cache, count=',
        cached.length
      );
      this._scopePersonnel.set(cached);
      return of(cached);
    }

    this._selectedScopeKey.set(scopeKey);
    this._selectedOrgCode.set(orgCode);
    this._selectedIncludeChildren.set(includeChildren);
    this._scopePersonnel.set([]);

    this._loading.set(true);
    return this.api.getScopePersonnel(scopeKey, orgCode, includeChildren).pipe(
      tap((list) => {
        const count = list?.length || 0;
        console.log('[PersonnelStore] scopePersonnel loaded', {
          scopeKey,
          orgCode,
          includeChildren,
          count,
        });
        this._scopePersonnel.set(list || []);
        this._scopeCache.set(cacheKey, list || []);
        this._loading.set(false);
      }),
      shareReplay(1)
    );
  }

  // Explicit async reload
  async reloadScopePersonnel(): Promise<void> {
    const scopeKey = this._selectedScopeKey();
    const orgCode = this._selectedOrgCode();
    const includeChildren = this._selectedIncludeChildren();
    if (!orgCode) {
      console.warn('[PersonnelStore] orgCode empty, skip');
      this._scopePersonnel.set([]);
      return;
    }
    this._loading.set(true);
    try {
      const data = await firstValueFrom(
        this.api.getScopePersonnel(scopeKey, orgCode, includeChildren)
      );
      this._scopePersonnel.set(data ?? []);
      console.info('[PersonnelStore] scopePersonnel loaded', {
        scopeKey,
        orgCode,
        includeChildren,
        count: this._scopePersonnel().length,
      });
    } finally {
      this._loading.set(false);
    }
  }

  // Preload personnel for given scope (or current if not specified)
  preloadScopePersonnel(
    scopeKey?: 'unit' | 'dept' | 'all',
    orgCode?: string
  ): Observable<PersonnelDto[]> {
    const scope = scopeKey || this._selectedScopeKey();
    const code = orgCode || this._selectedOrgCode();
    const cacheKey = `${scope}|${code}`;
    console.log('[PersonnelStore] preloadScopePersonnel', {
      scopeKey: scope,
      orgCode: code,
    });

    // Check cache first
    if (this._scopeCache.has(cacheKey)) {
      const cached = this._scopeCache.get(cacheKey) || [];
      console.log(
        '[PersonnelStore] preload using cached data, count=',
        cached.length
      );
      this._scopePersonnel.set(cached);
      return of(cached);
    }

    // Load from API
    console.log('[PersonnelStore] preload loading from API', {
      scopeKey: scope,
      orgCode: code,
    });
    return this.api.getScopePersonnel(scope as any, code).pipe(
      tap((list) => {
        const count = list?.length || 0;
        console.log('[PersonnelStore] preload loaded successfully', {
          scopeKey: scope,
          orgCode: code,
          count,
        });
        this._scopePersonnel.set(list || []);
        this._scopeCache.set(cacheKey, list || []);
      }),
      shareReplay(1)
    );
  }

  // Clear all cached data (useful on logout/scope reset)
  clearCache(): void {
    console.log('[PersonnelStore] clearCache called');
    this._scopeCache.clear();
    this._scopePersonnel.set([]);
    this._selectedScopeKey.set('unit');
    this._selectedOrgCode.set('');
  }

  ensureLoaded(scopeKey?: string): Promise<void> {
    const scope = (scopeKey as any) || this._selectedScopeKey();
    const cacheKey = `${scope}|${this._selectedOrgCode()}`;
    if (this._scopeCache.has(cacheKey)) {
      const cached = this._scopeCache.get(cacheKey) || [];
      this._scopePersonnel.set(cached);
      return Promise.resolve();
    }

    return this.api
      .getScopePersonnel(scope as any, this._selectedOrgCode())
      .toPromise()
      .then((list) => {
        const count = list?.length || 0;
        console.log('[PersonnelStore] ensureLoaded', {
          scopeKey: scope,
          orgCode: this._selectedOrgCode(),
          count,
        });
        if (list) {
          this._scopePersonnel.set(list);
          this._scopeCache.set(cacheKey, list);
        }
      });
  }

  scopePersonnel = computed(() => this._scopePersonnel());
}
