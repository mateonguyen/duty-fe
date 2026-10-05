import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { OrganizationService } from '../../admin/system-config/organization.service';
import { SimpleUser } from '../../schedule/schedule';

/**
 * OrgUnitNodeWithStaff - Tree node structure
 * Same as schedule-page for consistency
 */
export interface OrgUnitNodeWithStaff {
  id: number;
  code: string;
  name: string;
  parentCode?: string;
  staff?: SimpleUser[];
  children: OrgUnitNodeWithStaff[];
}

/**
 * TravelStaffTreeService
 * Loads staff tree structure for Travel Order form.
 * Reuses OrganizationService.fetchAllWithStaff() same as schedule-page.
 */
@Injectable({ providedIn: 'root' })
export class TravelStaffTreeService {
  private orgService = inject(OrganizationService);

  private _staffTree = signal<OrgUnitNodeWithStaff[]>([]);
  private _loadedScopeKey = signal<string | null>(null);
  private _loading = signal(false);

  staffTree = computed(() => this._staffTree());
  loading = computed(() => this._loading());
  loadedScopeKey = computed(() => this._loadedScopeKey());

  /**
   * Load staff tree for given scope (orgId).
   * Mirrors schedule-page logic.
   */
  loadForScope(
    scopeKey: string,
    includeChildren = false
  ): Observable<OrgUnitNodeWithStaff[]> {
    console.log(
      '[TravelStaffTree] loadForScope scopeKey=',
      scopeKey,
      'includeChildren=',
      includeChildren
    );

    // Check cache
    if (this._loadedScopeKey() === scopeKey && this._staffTree().length > 0) {
      console.log(
        '[TravelStaffTree] Using cached tree, nodes=',
        this._staffTree().length
      );
      return of(this._staffTree());
    }

    this._loading.set(true);
    this._staffTree.set([]); // Clear immediately

    return this.orgService.fetchAllWithStaff(scopeKey, includeChildren).pipe(
      map((tree) => {
        const mapped = (tree || []).map((n: any) => this.mapNode(n));
        const totalStaff = this.countTotalStaff(mapped);
        console.log(
          '[TravelStaffTree] Loaded tree for scope=',
          scopeKey,
          'nodes=',
          mapped.length,
          'totalStaff=',
          totalStaff
        );
        this._staffTree.set(mapped);
        this._loadedScopeKey.set(scopeKey);
        this._loading.set(false);
        return mapped;
      }),
      catchError((err) => {
        console.error('[TravelStaffTree] Error loading tree', err);
        this._staffTree.set([]);
        this._loading.set(false);
        return of([]);
      })
    );
  }

  /**
   * Map backend node to OrgUnitNodeWithStaff
   */
  private mapNode(n: any): OrgUnitNodeWithStaff {
    return {
      id: n.id || 0,
      code: n.code || '',
      name: n.name || '',
      parentCode: n.parentCode,
      staff: (n.staff || []).map((u: any) => this.mapUser(u)),
      children: (n.children || []).map((c: any) => this.mapNode(c)),
    };
  }

  /**
   * Map backend user to SimpleUser
   */
  private mapUser(u: any): SimpleUser {
    return {
      id: u.id || 0,
      username: u.username || '',
      displayName: u.displayName || u.fullName || '',
      isLeader: u.isLeader || false,
      positionLevel: u.positionLevel || u.cLevel,
      positionName: u.positionName || u.positionTitle || '',
      orgUnitCode: u.orgUnitCode || u.orgCode || '',
      orgUnitName: u.orgUnitName || u.unitName || '',
      phone: u.phone,
    };
  }

  /**
   * Count total staff in tree
   */
  private countTotalStaff(nodes: OrgUnitNodeWithStaff[]): number {
    let count = 0;
    const traverse = (node: OrgUnitNodeWithStaff) => {
      count += node.staff?.length || 0;
      (node.children || []).forEach(traverse);
    };
    nodes.forEach(traverse);
    return count;
  }

  /**
   * Search/filter tree by query string.
   * Returns filtered tree with only matching nodes/staff.
   */
  filterTree(
    tree: OrgUnitNodeWithStaff[],
    query: string
  ): OrgUnitNodeWithStaff[] {
    if (!query || query.trim().length === 0) return tree;

    const q = this.removeDiacritics(query.trim()).toLowerCase();

    const filterNode = (
      node: OrgUnitNodeWithStaff
    ): OrgUnitNodeWithStaff | null => {
      // Filter staff in this node
      const filteredStaff = (node.staff || []).filter((u) => {
        const name = this.removeDiacritics(u.displayName || '').toLowerCase();
        const pos = this.removeDiacritics(u.positionName || '').toLowerCase();
        return name.includes(q) || pos.includes(q);
      });

      // Filter children recursively
      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter((c): c is OrgUnitNodeWithStaff => !!c);

      // Keep node if has matching staff or children
      if (filteredStaff.length > 0 || filteredChildren.length > 0) {
        return {
          ...node,
          staff: filteredStaff,
          children: filteredChildren,
        };
      }
      return null;
    };

    return tree.map(filterNode).filter((n): n is OrgUnitNodeWithStaff => !!n);
  }

  /**
   * Remove Vietnamese diacritics for search
   */
  private removeDiacritics(str: string): string {
    return str
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  /**
   * Clear cache
   */
  clear(): void {
    console.log('[TravelStaffTree] Clearing cache');
    this._staffTree.set([]);
    this._loadedScopeKey.set(null);
    this._loading.set(false);
  }
}
