import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OrgUnitNodeWithStaffDto } from '../../../shared/models/org-unit';

export interface OrgUnitNode {
  id: number;
  code: string;
  name: string;
  children: OrgUnitNode[];
}

export interface OrgSearchResult {
  id: string;
  code: string;
  name: string;
  displayName: string;
}

export interface OrgSearchResponse {
  items: OrgSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  organizations = signal<OrgUnitNode[]>([]);
  loading = signal(false);

  constructor(private http: HttpClient) {}

  fetchAll(): Observable<OrgUnitNode[]> {
    this.loading.set(true);
    return this.http.get<OrgUnitNode[]>('/api/orgunits/tree');
  }

  fetchAllWithStaff(
    rootOrgCode?: string
  ): Observable<OrgUnitNodeWithStaffDto[]> {
    this.loading.set(true);
    let url = '/api/orgunits/tree-with-staff';
    if (rootOrgCode) {
      url += `?rootOrgCode=${encodeURIComponent(rootOrgCode)}`;
    }
    return this.http.get<OrgUnitNodeWithStaffDto[]>(url);
  }

  searchOrganizations(
    query: string,
    page = 1,
    pageSize = 20
  ): Observable<OrgSearchResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (query) {
      params = params.set('query', query);
    }

    return this.http.get<OrgSearchResponse>('/api/orgunits/search', { params });
  }

  searchOrganizationsSync(query: string): OrgUnitNode[] {
    const allOrgs = this.organizations();
    if (!query) return allOrgs;

    const searchTerm = query.toLowerCase();
    return allOrgs.filter(
      (org) =>
        org.code.toLowerCase().includes(searchTerm) ||
        org.name.toLowerCase().includes(searchTerm)
    );
  }
}
