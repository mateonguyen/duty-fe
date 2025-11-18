import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  DutyLocationReadDto,
  DutyLocationWriteDto,
} from '../../shared/models/duty-location';
import { ShiftReadDto, ShiftWriteDto } from '../../shared/models/shift';
import {
  DutyRoleReadDto,
  DutyRoleWriteDto,
} from '../../shared/models/duty-role';
import { OrgUnitNodeDto } from '../../shared/models/org-unit';
import { OrgUnitNodeWithStaffDto } from '../../shared/models/org-unit';

@Injectable({ providedIn: 'root' })
export class DutyApiService {
  private base = '/api';
  constructor(private http: HttpClient) {}

  // Duty Locations
  /**
   * Load duty locations, optionally filtered by scope code.
   * When scopeCode is provided and includeGlobal=true (default), returns records with matching scopeCode plus global (null) ones.
   */
  getDutyLocations(scopeCode?: string | null, includeGlobal = true) {
    const params: any = { includeGlobal: includeGlobal.toString() };
    if (scopeCode) params.scopeCode = scopeCode;
    return this.http.get<DutyLocationReadDto[]>(`${this.base}/dutylocations`, {
      params,
    });
  }
  createDutyLocation(dto: DutyLocationWriteDto) {
    return this.http.post<DutyLocationReadDto>(
      `${this.base}/dutylocations`,
      dto
    );
  }
  updateDutyLocation(id: number, dto: DutyLocationWriteDto) {
    return this.http.put<DutyLocationReadDto>(
      `${this.base}/dutylocations/${id}`,
      dto
    );
  }
  deleteDutyLocation(id: number) {
    return this.http.delete(`${this.base}/dutylocations/${id}`);
  }

  // Shifts
  getShifts() {
    return this.http.get<ShiftReadDto[]>(`${this.base}/shifts`);
  }
  /**
   * Load shifts for a specific scope code (from AdOrganize) including global shifts by default.
   * @param scopeCode Organization unit code string (e.g., "G01.705.000.002"). If null/empty, returns only global shifts.
   * @param includeGlobal Whether to include global (scopeCode == null) shifts. Default true.
   */
  getShiftsByScope(scopeCode: string | null, includeGlobal = false) {
    const params: any = { includeGlobal: includeGlobal.toString() };
    if (scopeCode) {
      params.scopeCode = scopeCode;
    }
    return this.http.get<ShiftReadDto[]>(`${this.base}/shifts/by-scope`, {
      params,
    });
  }
  /**
   * @deprecated Use getShiftsByScope instead. This method will be removed in future versions.
   * Load shifts for a specific organizational unit (scope) including global shifts by default.
   * @param unitId Org unit numeric id or string convertible to number.
   * @param includeGlobal Whether to include global (scopeUnitId == null) shifts. Default true.
   */
  getShiftsByUnit(unitId: number | string, includeGlobal = true) {
    const params = new HttpParams()
      .set('unitId', String(unitId))
      .set('includeGlobal', includeGlobal ? 'true' : 'false');
    return this.http.get<ShiftReadDto[]>(`${this.base}/shifts/by-unit`, {
      params,
    });
  }
  createShift(dto: ShiftWriteDto) {
    return this.http.post<ShiftReadDto>(`${this.base}/shifts`, dto);
  }
  updateShift(id: number, dto: ShiftWriteDto) {
    return this.http.put<ShiftReadDto>(`${this.base}/shifts/${id}`, dto);
  }
  deleteShift(id: number) {
    return this.http.delete(`${this.base}/shifts/${id}`);
  }

  // Duty Roles
  getDutyRoles() {
    return this.http.get<DutyRoleReadDto[]>(`${this.base}/dutyroles`);
  }
  createDutyRole(dto: DutyRoleWriteDto) {
    return this.http.post<DutyRoleReadDto>(`${this.base}/dutyroles`, dto);
  }
  updateDutyRole(id: number, dto: DutyRoleWriteDto) {
    return this.http.put<DutyRoleReadDto>(`${this.base}/dutyroles/${id}`, dto);
  }
  deleteDutyRole(id: number) {
    return this.http.delete(`${this.base}/dutyroles/${id}`);
  }

  // Org units
  getOrgTree() {
    return this.http.get<OrgUnitNodeDto[]>(`${this.base}/orgunits/tree`);
  }
  getOrgTreeWithStaff() {
    return this.http.get<OrgUnitNodeWithStaffDto[]>(
      `${this.base}/orgunits/tree-with-staff`
    );
  }
}
