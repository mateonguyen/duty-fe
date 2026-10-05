import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface PersonnelDto {
  username: string;
  fullName: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  displayNameWithRank?: string;
  rankTitle?: string;
  positionTitle?: string;
  unitName?: string;
  orgCode?: string;
  userRoleCode?: string;
  isLeader?: boolean;
}

export interface SearchPersonnelRequest {
  query?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedPersonnelResult {
  items: PersonnelDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class PersonnelApiService {
  constructor(private http: HttpClient) {}

  private normalizePersonnel(person: PersonnelDto): PersonnelDto {
    const rankName = person.rankName || person.rankTitle;
    const displayNameWithRank =
      person.displayNameWithRank ||
      [rankName, person.fullName].filter(Boolean).join(' ');

    return {
      ...person,
      rankName,
      rankTitle: person.rankTitle || rankName,
      displayNameWithRank,
    };
  }

  searchPersonnel(
    query: string,
    role?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Observable<PagedPersonnelResult> {
    let params = new HttpParams()
      .set('q', query)
      .set('page', page)
      .set('pageSize', pageSize);
    if (role) {
      params = params.set('role', role);
    }
    return this.http
      .get<PagedPersonnelResult>('/api/personnel/search', {
        params,
      })
      .pipe(
        map((res) => ({
          ...res,
          items: (res.items || []).map((x) => this.normalizePersonnel(x)),
        })),
      );
  }

  getPersonnel(username: string): Observable<PersonnelDto> {
    return this.http
      .get<PersonnelDto>(`/api/personnel/${username}`)
      .pipe(map((x) => this.normalizePersonnel(x)));
  }

  getScopePersonnel(
    scopeKey: 'unit' | 'dept' | 'all' | string,
    orgCode: string,
    includeChildren: boolean = false,
  ): Observable<PersonnelDto[]> {
    console.info('[PersonnelApi] getScopePersonnel', {
      scopeKey,
      orgCode,
      includeChildren,
    });
    let params = new HttpParams()
      .set('scope', scopeKey)
      .set('orgCode', orgCode);
    if (includeChildren) {
      params = params.set('includeChildren', 'true');
    }
    return this.http
      .get<PersonnelDto[]>('/api/personnel/scope', { params })
      .pipe(map((list) => (list || []).map((x) => this.normalizePersonnel(x))));
  }

  getApprovers(
    orgCode: string,
    includeChildren: boolean = false,
  ): Observable<PersonnelDto[]> {
    console.info('[PersonnelApi] getApprovers', { orgCode, includeChildren });
    let params = new HttpParams().set('orgCode', orgCode);
    if (includeChildren) {
      params = params.set('includeChildren', 'true');
    }
    return this.http
      .get<PersonnelDto[]>('/api/personnel/approvers', {
        params,
      })
      .pipe(map((list) => (list || []).map((x) => this.normalizePersonnel(x))));
  }
}
