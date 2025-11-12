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
  getDutyLocations() {
    return this.http.get<DutyLocationReadDto[]>(`${this.base}/dutylocations`);
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
