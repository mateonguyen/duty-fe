import { Injectable, computed, signal, inject } from '@angular/core';
import {
  AssignmentRead,
  DutyLocation,
  RosterMeta,
  Shift,
  SimpleUser,
} from '../schedule';
import { StaffDataService } from './staff-data.service';
import { DutyApiService } from '../../../core/api/duty-api.service';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

// Service for managing schedule UI state (roster metadata, assignments, staff)
// Renamed from ScheduleDemoService - no longer using demo/mock data
@Injectable({ providedIn: 'root' })
export class ScheduleUiService {
  private staffDataService = inject(StaffDataService);
  private dutyApi = inject(DutyApiService);

  // ---- shifts: now driven by backend by selected scope ----
  // No demo defaults to avoid confusing UI before API load.
  shifts: Shift[] = [];

  // ---- locations: load from backend API instead of static demo data ----
  locations = signal<DutyLocation[]>([]);

  // ---- staff thật từ EOffice API (thay thế mock data) ----
  staffAll = signal<SimpleUser[]>([]);

  constructor() {
    // Locations will be loaded when scope is selected
  }

  /** Load DutyLocations from backend API with scopeCode */
  loadLocations(scopeCode?: string | null): Observable<DutyLocation[]> {
    if (!scopeCode) {
      console.warn(
        '[ScheduleUiService] loadLocations called without scopeCode - this will cause 400 error. Skipping.'
      );
      return of([]);
    }

    return this.dutyApi
      .getDutyLocations(scopeCode, true)
      .pipe(
        map((dtos) =>
          dtos.map(
            (dto) =>
              ({
                id: dto.id,
                name: dto.name,
              } as DutyLocation)
          )
        ),
        catchError((err) => {
          console.error('[ScheduleUiService] Failed to load locations:', err);
          if (err.status === 400) {
            console.error(
              '[ScheduleUiService] 400 error - likely missing scopeCode. Current scopeCode:',
              scopeCode
            );
          }
          // Return empty array on error
          return of([]);
        })
      );
  }

  /** Reset toàn bộ state service về mặc định (dùng khi đổi user) */
  resetAllState() {
    this.staffAll.set([]);
    this.assignments.set([]);
    this.selectedUser.set(null);
    this.roster.set({
      unitId: 1,
      unitName: '',
      from: this.toDayKey(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      ),
      to: this.toDayKey(
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      ),
      locationId: 2,
      name: '',
    });
  }

  /**
   * Load staff theo loại lịch và đơn vị
   */
  loadStaffForRoster(orgUnitCode?: string, includeChildren: boolean = false) {
    this.staffDataService
      .getStaffForRoster(orgUnitCode, includeChildren)
      .subscribe({
        next: (staff) => {
          this.staffAll.set(staff);
        },
        error: (err) => {
          console.error('Failed to load staff from EOffice:', err);
          this.staffAll.set([]);
        },
      });
  }

  /** Finite Observable wrapper for staff loading (preferred in reactive pipelines). */
  loadStaffForRoster$(
    orgUnitCode?: string,
    includeChildren: boolean = false
  ): Observable<void> {
    return this.staffDataService
      .getStaffForRoster(orgUnitCode, includeChildren)
      .pipe(
        tap({
          next: (staff) => this.staffAll.set(staff),
          error: (err) => {
            console.error('Failed to load staff from EOffice:', err);
            this.staffAll.set([]);
          },
        }),
        catchError(() => of([])),
        map(() => void 0)
      );
  }

  // ---- state kỳ lịch + phân công ----
  roster = signal<RosterMeta>({
    unitId: 1,
    unitName: 'Phòng 1',
    from: this.toDayKey(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    ),
    to: this.toDayKey(
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    ),
    locationId: 2,
    name: '',
  });

  // Bỏ mock assignments - tạo mới lịch sẽ bắt đầu từ blank
  assignments = signal<AssignmentRead[]>([]);

  selectedUser = signal<SimpleUser | null>(null);

  // (tuỳ UI có dùng): tháng đang xem
  viewMonth = signal<Date>(new Date());

  // ---- map nhanh "YYYY-MM-DD|shiftId" -> list assignments
  cellMap = computed(() => {
    const map = new Map<string, AssignmentRead[]>();
    for (const a of this.assignments()) {
      const k = `${a.date}|${a.shiftId}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return map;
  });

  // ---- set các ô bận của user đang chọn
  busySet = computed(() => {
    const u = this.selectedUser();
    const set = new Set<string>();
    if (!u) return set;
    for (const a of this.assignments()) {
      if (a.userId === u.id) {
        set.add(`${a.date}|${a.shiftId}`); // bận đúng ca
        set.add(`${a.date}|*`); // bận cả ngày
      }
    }
    return set;
  });

  /** Định mức/độ chứa của ca (mock). Nếu có capacity trong Shift, đổi sang đọc từ đó. */
  capacityOf(shiftId: number): number {
    return 99;
  }

  // ===== Helpers ngày =====
  toDayKey(d: Date): string {
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`; // YYYY-MM-DD
  }

  /** Chuẩn hoá key về YYYY-MM-DD (chấp nhận YYYYMMDD hoặc YYYY-MM-DD). */
  private normalizeDayKey(k: string): string {
    if (!k) return k;
    // dạng YYYYMMDD
    if (/^\d{8}$/.test(k)) {
      return `${k.substring(0, 4)}-${k.substring(4, 6)}-${k.substring(6, 8)}`;
    }
    return k; // đã là YYYY-MM-DD
  }

  // ===== CRUD tạm (mock) =====
  /**
   * Add assignment to roster.
   *
   * SNAPSHOT STRATEGY:
   * - Captures user position at assignment time (`u.positionName`)
   * - Captures user org unit at assignment time (`u.orgUnitCode`, `u.orgUnitName`)
   * - Stored as snapshots in assignment
   * - This ensures historical accuracy even if staff is promoted or transfers later
   * - Example: Staff assigned from "Phòng Hành chính" in Jan, transfers to "Phòng Kế hoạch" in Feb
   *   → Jan roster still shows "Phòng Hành chính" (correct historical data)
   */
  addAssignment(
    date: string,
    shiftId: number,
    u: SimpleUser,
    locationId?: number | null
  ) {
    const d = this.normalizeDayKey(date);

    // Validate username: must be a real username from eOffice
    if (!u.username || u.username.trim() === '') {
      console.error(
        '[ScheduleUiService] Cannot add assignment: user missing username',
        u
      );
      return;
    }

    // tránh trùng
    if (
      this.assignments().some(
        (x) => x.date === d && x.shiftId === shiftId && x.userId === u.id
      )
    ) {
      return;
    }
    const a: AssignmentRead = {
      date: d,
      shiftId,
      userId: u.id,
      username: u.username, // Always use real username from eOffice (never fallback)
      userName: u.displayName,
      orgUnitCode: u.orgUnitCode,
      orgUnitName: u.orgUnitName,
      positionTitle: u.positionName, // Snapshot staff position at assignment time
      positionLevel: u.positionLevel, // Snapshot C_LEVEL for leader sorting
      isLeader: false,
      dutyRoleName: 'Cán bộ trực',
      phone: u.phone,
      locationId: locationId ?? this.roster().locationId,
    };
    this.assignments.update((list) => {
      const cell = [...list, a].filter(x => x.date === d && x.shiftId === shiftId && x.locationId === a.locationId);
      const commander = [...cell].sort((x, y) => (x.positionLevel ?? 999) - (y.positionLevel ?? 999) || x.userName.localeCompare(y.userName))[0];
      return [...list, a].map(x => x.date === d && x.shiftId === shiftId && x.locationId === a.locationId
        ? { ...x, isLeader: x.username === commander.username, dutyRoleName: x.username === commander.username ? 'Chỉ huy trực' : 'Cán bộ trực' }
        : x);
    });
  }

  setCommander(selected: AssignmentRead) {
    this.assignments.update(list => list.map(x => x.date === selected.date && x.shiftId === selected.shiftId && x.locationId === selected.locationId
      ? { ...x, isLeader: x.username === selected.username, dutyRoleName: x.username === selected.username ? 'Chỉ huy trực' : 'Cán bộ trực' }
      : x));
  }

  normalizeCommanders() {
    this.assignments.update(list => {
      const cells = new Map<string, AssignmentRead[]>();
      for (const a of list) {
        const key = `${a.date}|${a.shiftId}|${a.locationId ?? ''}`;
        cells.set(key, [...(cells.get(key) || []), a]);
      }
      const chosen = new Map<string, string>();
      for (const [key, cell] of cells) {
        const marked = cell.filter(a => a.isLeader);
        const commander = marked.length === 1 ? marked[0] : [...cell].sort((a, b) => (a.positionLevel ?? 999) - (b.positionLevel ?? 999) || a.userName.localeCompare(b.userName))[0];
        if (commander?.username) chosen.set(key, commander.username);
      }
      return list.map(a => {
        const isLeader = chosen.get(`${a.date}|${a.shiftId}|${a.locationId ?? ''}`) === a.username;
        return { ...a, isLeader, dutyRoleName: isLeader ? 'Chỉ huy trực' : 'Cán bộ trực' };
      });
    });
  }

  removeAssignment(a: AssignmentRead) {
    this.assignments.update((list) => {
      const remaining = list.filter(
        (i) =>
          !(
            i.date === a.date &&
            i.shiftId === a.shiftId &&
            i.userId === a.userId
          )
      );
      if (!a.isLeader) return remaining;
      const cell = remaining.filter(x => x.date === a.date && x.shiftId === a.shiftId && x.locationId === a.locationId);
      const next = [...cell].sort((x, y) => (x.positionLevel ?? 999) - (y.positionLevel ?? 999) || x.userName.localeCompare(y.userName))[0];
      return next ? remaining.map(x => x === next ? { ...x, isLeader: true, dutyRoleName: 'Chỉ huy trực' } : x) : remaining;
    });
  }

  // ====== API bổ sung cho component ======

  /** Danh sách cán bộ (đúng model bạn đang có) */
  users(): SimpleUser[] {
    return this.staffAll();
  }

  /** Lấy assignments của 1 ô (dayKey + shiftId). */
  assignmentsBy(shiftId: number, dayKey: string): AssignmentRead[] {
    const d = this.normalizeDayKey(dayKey);
    const list = this.cellMap().get(`${d}|${shiftId}`) ?? [];
    // Trả nguyên AssignmentRead — template dùng userName/phone/isLeader/dutyRoleName ok
    return list;
  }

  /** Đếm số người trong 1 ô. */
  countInCell(shiftId: number, dayKey: string): number {
    const d = this.normalizeDayKey(dayKey);
    return this.cellMap().get(`${d}|${shiftId}`)?.length ?? 0;
  }

  /** Handler kéo–thả từ CDK: item.data phải là SimpleUser. */
  onDrop(ev: any /* CdkDragDrop<any> */, dayKey: string, shiftId: number) {
    const u = ev?.item?.data as SimpleUser | undefined;
    if (!u || !shiftId || !dayKey) return;
    this.addAssignment(dayKey, shiftId, u);
  }
}
