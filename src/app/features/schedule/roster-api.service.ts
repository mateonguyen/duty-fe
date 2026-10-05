import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RosterListItem } from './schedule';

export interface RosterCreateDto {
  name: string;
  scopeCode: string; // Changed from scopeUnitId to match backend
  periodStart: string; // ISO date string "YYYY-MM-DD"
  periodEnd: string;
  defaultLocationId?: number | null; // Allow null to prevent FK constraint errors
}

export interface RosterUpdateDto {
  id: number;
  name: string;
  periodStart: string;
  periodEnd: string;
  defaultLocationId?: number | null; // Allow null to prevent FK constraint errors
}

export interface RosterEditorDto {
  id: number;
  name: string;
  scopeCode: string;
  scopeUnitName: string;
  periodStart: string; // ISO date "YYYY-MM-DD"
  periodEnd: string;
  status: 'DRAFT' | 'PUBLISHED' | 'LOCKED';
  defaultLocationId?: number | null;
  defaultLocationName?: string;
  shifts: ShiftSummaryDto[];
  assignments: AssignmentReadFullDto[];
}

export interface ShiftSummaryDto {
  id: number;
  code: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface AssignmentReadFullDto {
  id: number;
  dutyDate: string; // ISO date "YYYY-MM-DD"
  shiftId: number;
  shiftName: string;
  shiftTimeRange?: string; // "HH:mm - HH:mm"
  username: string;
  fullName: string;
  unitCode: string;
  unitName: string;
  positionTitle?: string;
  positionLevel?: number | null;
  isLeader: boolean;
  assignmentType: string;
  locationId?: number | null;
  locationName?: string;
  dutyRoleId?: number | null;
  dutyRoleName?: string;
  isLocked: boolean;
}

@Injectable({ providedIn: 'root' })
export class RosterApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/rosters';
  private monitoringUrl = '/api/monitoring';

  getByMonth(
    scopeCode: string,
    year: number,
    month: number
  ): Observable<RosterListItem[]> {
    const params = new HttpParams()
      .set('scopeCode', scopeCode)
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<RosterListItem[]>(`${this.baseUrl}/by-month`, {
      params,
    });
  }

  getById(id: number): Observable<RosterListItem> {
    return this.http.get<RosterListItem>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get roster for editor - returns full data for edit mode
   * @param id Roster ID
   */
  getForEditor(id: number): Observable<RosterEditorDto> {
    return this.http.get<RosterEditorDto>(`${this.baseUrl}/${id}/editor`);
  }

  getMatrix(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}/matrix`);
  }

  create(dto: RosterCreateDto): Observable<RosterListItem> {
    return this.http.post<RosterListItem>(this.baseUrl, dto);
  }

  update(dto: RosterUpdateDto): Observable<RosterListItem> {
    return this.http.put<RosterListItem>(`${this.baseUrl}/${dto.id}`, dto);
  }

  publish(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/publish`, {});
  }

  checkOverlap(dto: OverlapCheckDto): Observable<OverlapCheckResult> {
    return this.http.post<OverlapCheckResult>(
      `${this.baseUrl}/check-overlap`,
      dto
    );
  }

  checkPublishedConflict(
    dto: OverlapCheckDto
  ): Observable<PublishedConflictResult> {
    const headers = new HttpHeaders({ 'X-Scope-Code': dto.scopeCode });
    return this.http.post<PublishedConflictResult>(
      `${this.baseUrl}/check-published-conflict`,
      dto,
      { headers }
    );
  }

  unpublish(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/unpublish`, {});
  }

  lock(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/lock`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get published rosters for a scope and month (public endpoint, no auth required)
   * @param scopeCode Scope code from AdOrganize
   * @param month Month in YYYY-MM format
   */
  getPublicByMonth(
    scopeCode: string,
    month: string
  ): Observable<RosterListItem[]> {
    const params = new HttpParams()
      .set('scopeCode', scopeCode)
      .set('month', month);
    return this.http.get<RosterListItem[]>(`${this.baseUrl}/public/by-month`, {
      params,
    });
  }

  /**
   * Save assignments for a roster
   * @param rosterId Roster ID
   * @param changes List of assignment changes (upsert/delete)
   * @param defaultLocationBy Strategy for default location (AUTO|SHIFT|ROSTER|NONE)
   */
  saveAssignments(
    rosterId: number,
    changes: AssignmentChangeDto[],
    defaultLocationBy: 'AUTO' | 'SHIFT' | 'ROSTER' | 'NONE' = 'AUTO'
  ): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/${rosterId}/assignments/save`,
      { changes, defaultLocationBy }
    );
  }

  // Global live monitoring: who is on duty now
  getMonitoringLive(params?: {
    atTime?: string;
    unitCode?: string;
  }): Observable<DutyMonitoringDto[]> {
    let hp = new HttpParams();
    if (params?.atTime) hp = hp.set('atTime', params.atTime);
    if (params?.unitCode) hp = hp.set('unitCode', params.unitCode);
    return this.http.get<DutyMonitoringDto[]>(`${this.monitoringUrl}/live`, {
      params: hp,
    });
  }
}

export interface AssignmentChangeDto {
  kind?: 'upsert' | 'delete';
  dutyDate: string; // ISO date "YYYY-MM-DD"
  shiftId: number;
  username: string;
  userFullName: string;
  userUnitCode: string;
  userUnitName: string;
  userPositionTitle?: string; // Snapshot staff position/title at assignment time
  userPositionLevel?: number | null; // Snapshot C_LEVEL for sorting
  isLeader?: boolean; // Snapshot leader status
  assignmentType?: string;
  locationId?: number | null;
  dutyRoleId?: number | null;
}

export interface OverlapCheckDto {
  rosterId?: number | null;
  scopeCode: string;
  name: string;
  periodStart: string; // DateOnly as string YYYY-MM-DD
  periodEnd: string;
  defaultLocationId?: number | null;
}

export interface OverlapCheckResult {
  hasHardBlock: boolean;
  hasSoftWarning: boolean;
  hardBlockRosters: OverlapRoster[];
  softWarningRosters: OverlapRoster[];
}

export interface OverlapRoster {
  id: number;
  name: string;
  scopeUnitName?: string;
  defaultLocationId?: number | null;
  defaultLocationName?: string;
  periodStart: string;
  periodEnd: string;
}

export interface PublishedConflictResult {
  hasConflict: boolean;
  items: OverlapRoster[];
}

export interface DutyMonitoringDto {
  unitCode: string;
  unitName: string;
  locations: DutyLocationDto[];
}

export interface DutyLocationDto {
  locationId: number;
  locationName: string;
  shifts: DutyShiftDto[];
}

export interface DutyShiftDto {
  shiftId: number;
  shiftName: string;
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
  date: string; // ISO
  status: number; // Backend enum DutyStatus
  roles: DutyRoleDto[];
}

export interface DutyRoleDto {
  roleCode: string;
  roleName: string;
  staffDisplayName?: string | null;
  isLeader: boolean;
  positionTitle?: string | null;
}
