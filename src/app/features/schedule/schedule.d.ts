type DayKey = string; // yyyyMMdd

export interface Shift {
  id: number;
  code: string;
  name: string;
  start: string;
  end: string;
}
export interface SimpleUser {
  id: number; // Hashed from username for UI convenience
  username: string; // Actual username for backend API
  displayName: string;
  isLeader?: boolean;
  positionLevel?: number;
  phone?: string;
  positionName?: string;
  orgUnitCode?: string; // Unit code from AdOrganize
  orgUnitName?: string; // Department/Phòng ban
  orgUnitId?: number; // ID đơn vị tổ chức (chuẩn tree)
}
export interface AssignmentRead {
  id?: number;
  rosterId?: number;
  date: DayKey; // 'YYYY-MM-DD'
  shiftId: number;
  userId: number; // Hashed ID for UI convenience
  username?: string; // Actual username for backend API
  userName: string; // Display name
  orgUnitCode?: string; // Unit code for backend API
  orgUnitName?: string; // Unit name for display
  shiftName?: string; // Snapshot shift name for tooltip
  shiftTimeRange?: string; // Snapshot shift time range for tooltip
  positionTitle?: string; // Staff position/title snapshot (e.g., "Chuyên viên", "Trưởng phòng")
  positionLevel?: number | null; // C_LEVEL for sorting leaders
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
  status?: RosterStatus; // Current roster status (for edit mode)
}

// Roster lifecycle status aligned with backend enum
export type RosterStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED';

export interface RosterListItem {
  id: number;
  name: string;
  scopeCode: string;
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
