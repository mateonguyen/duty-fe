import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { PersonnelDto } from './personnel-api.service';
import {
  OrganizationService,
  OrgUnitNode,
} from '../../admin/system-config/organization.service';
import { ScopeService } from '../../../core/services/scope.service';

/**
 * TravelLeaderSourceService
 * Provides leaders for the Travel Order form (Người duyệt dropdown).
 * Leaders are loaded from the root organization scope configuration,
 * reusing the same logic as schedule-page (Lịch trực).
 */
@Injectable({ providedIn: 'root' })
export class TravelLeaderSourceService {
  private orgService = inject(OrganizationService);
  private scopeService = inject(ScopeService);

  private _leaders = signal<PersonnelDto[]>([]);
  private _loadedRootOrgId = signal<string | null>(null);
  private _loading = signal(false);

  leaders = computed(() => this._leaders());
  loading = computed(() => this._loading());
  loadedRootOrgId = computed(() => this._loadedRootOrgId());

  constructor() {
    // Auto-preload leaders when scope service updates
    effect(() => {
      const activeScope =
        this.scopeService.getActiveScope('travel.trip.create');
      if (activeScope?.orgId) {
        console.log(
          '[TravelLeaderSource] Scope changed, preloading leaders for rootOrgId:',
          activeScope.orgId,
        );
        this.preloadLeadersForRootOrg(activeScope.orgId);
      }
    });
  }

  /**
   * Preload leaders for a given root org (by extracting from org tree).
   * This mirrors the logic used in schedule-page to get the leadership hierarchy.
   */
  preloadLeadersForRootOrg(rootOrgId: string): Observable<PersonnelDto[]> {
    console.log(
      '[TravelLeaderSource] preloadLeadersForRootOrg rootOrgId=',
      rootOrgId,
    );

    // Check if already loaded for this org
    if (this._loadedRootOrgId() === rootOrgId && this._leaders().length > 0) {
      console.log(
        '[TravelLeaderSource] Using cached leaders, count=',
        this._leaders().length,
      );
      return of(this._leaders());
    }

    this._loading.set(true);

    return this.orgService
      .fetchAllWithStaff(rootOrgId, false) // Don't include children for leader scope
      .pipe(
        map((tree) => {
          const leaders = this.extractLeadersFromTree(tree || []);
          console.log(
            '[TravelLeaderSource] Extracted leaders from tree, count=',
            leaders.length,
          );
          this._leaders.set(leaders);
          this._loadedRootOrgId.set(rootOrgId);
          this._loading.set(false);
          return leaders;
        }),
        catchError((err) => {
          console.error('[TravelLeaderSource] Error loading leaders', err);
          this._leaders.set([]);
          this._loading.set(false);
          return of([] as PersonnelDto[]);
        }),
      );
  }

  /**
   * Extract leaders (staff marked as isLeader) from org tree.
   * This mirrors the logic used in schedule-page staff-tree component.
   */
  private extractLeadersFromTree(tree: any[]): PersonnelDto[] {
    const leaders: PersonnelDto[] = [];

    const traverse = (node: any) => {
      if (node.staff && Array.isArray(node.staff)) {
        for (const person of node.staff) {
          if (person.isLeader) {
            const rankName = person.rankName || person.rankTitle;
            leaders.push({
              username: person.username,
              fullName: person.fullName,
              rankName,
              rankTitle: person.rankTitle || rankName,
              displayNameWithRank:
                person.displayNameWithRank ||
                [rankName, person.fullName].filter(Boolean).join(' '),
              positionTitle: person.positionTitle,
              unitName: person.unitName || node.name,
              orgCode: person.orgCode,
              isLeader: true,
            });
          }
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    for (const node of tree) {
      traverse(node);
    }

    // Dedupe and sort by fullName
    const unique = Array.from(
      new Map(leaders.map((l) => [l.username, l])).values(),
    ).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    console.log(
      '[TravelLeaderSource] Extracted and deduped leaders, count=',
      unique.length,
    );
    return unique;
  }

  /**
   * Search leaders locally by query string.
   */
  searchLocal(query: string): PersonnelDto[] {
    if (!query) return this._leaders();

    const q = query.toLowerCase();
    return this._leaders().filter(
      (l) =>
        l.fullName?.toLowerCase().includes(q) ||
        l.rankName?.toLowerCase().includes(q) ||
        l.positionTitle?.toLowerCase().includes(q) ||
        l.rankTitle?.toLowerCase().includes(q) ||
        l.unitName?.toLowerCase().includes(q),
    );
  }

  /**
   * Clear cache (useful on logout).
   */
  clear(): void {
    console.log('[TravelLeaderSource] Clearing cache');
    this._leaders.set([]);
    this._loadedRootOrgId.set(null);
    this._loading.set(false);
  }
}
