import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HomeOverviewDto } from './home-overview.model';

/**
 * Service for home overview API.
 * Fetches dashboard data from /api/home/overview endpoint.
 */
@Injectable({ providedIn: 'root' })
export class HomeOverviewService {
  private readonly http = inject(HttpClient);

  /**
   * Get home overview data including stats, upcoming shifts, today's assignments,
   * notifications, and recent activities.
   */
  getOverview(scopeCode?: string, period?: string): Observable<HomeOverviewDto> {
    // Use relative path - proxy.conf.json handles routing in dev
    // In production, nginx reverse proxy handles /api -> backend
    const params: Record<string, string> = {};
    if (scopeCode) params['scopeCode'] = scopeCode;
    if (period) params['period'] = period;
    return this.http.get<HomeOverviewDto>('/api/home/overview', { params });
  }
}
