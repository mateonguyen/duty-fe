type DayKey = string; // yyyyMMdd

export interface Shift {
  id: number;
  code: string;
  name: string;
  start: string;
  end: string;
}
export interface SimpleUser {
  id: number;
  displayName: string;
  isLeader?: boolean;
  positionLevel?: number;
  phone?: string;
  positionName?: string;
  orgUnitName?: string; // Department/Phòng ban
  orgUnitId?: number; // ID đơn vị tổ chức (chuẩn tree)
}
export interface AssignmentRead {
  id?: number;
  rosterId?: number;
  date: DayKey; // 'YYYY-MM-DD'
  shiftId: number;
  userId: number;
  userName: string;
  isLeader?: boolean;
  dutyRoleName?: string;
  locationId?: number;
  phone?: string;
  note?: string;
}
export type CalendarMap = Record<string, AssignmentRead[]>; // yyyyMMdd -> list

export interface RosterState {
  rosterId: number;
  unitId: number;
  locationId?: number;
  month: string; // '2025-11'
}

export interface RosterMeta {
  id?: number;
  name: string;
  unitId: number;
  unitName: string;
  from: DayKey;
  to: DayKey;
  locationId?: number;
}

// Roster lifecycle status aligned with backend enum
export type RosterStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED';

export interface RosterListItem {
  id: number;
  name: string;
  scopeUnitId: number;
  scopeUnitName: string;
  periodStart: string; // DateOnly from backend "YYYY-MM-DD"
  periodEnd: string;
  status: RosterStatus;
  publishedAt?: string; // ISO datetime
  defaultLocationId?: number;
  defaultLocationName?: string;
}

export interface DutyLocation {
  id: number;
  name: string;
}

interface Assignment {
  id: number;
  dayKey: DayKey;
  shiftId: number;
  userId: number;
}
