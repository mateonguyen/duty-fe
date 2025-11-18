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

// LƯU Ý: Không thay đổi model của bạn. Chỉ bổ sung hàm tiện ích.
@Injectable({ providedIn: 'root' })
export class ScheduleDemoService {
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
    // Load locations from backend on init
    this.loadLocations();
  }

  /** Load DutyLocations from backend API */
  loadLocations(): void {
    this.dutyApi
      .getDutyLocations()
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
          console.error('[ScheduleDemoService] Failed to load locations:', err);
          // Return empty array on error
          return of([]);
        })
      )
      .subscribe((locations) => {
        this.locations.set(locations);
        console.log(
          '[ScheduleDemoService] Loaded locations from API:',
          locations
        );
      });
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
  loadStaffForRoster(orgUnitCode?: string) {
    this.staffDataService.getStaffForRoster(orgUnitCode).subscribe({
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
  loadStaffForRoster$(orgUnitCode?: string): Observable<void> {
    return this.staffDataService.getStaffForRoster(orgUnitCode).pipe(
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
  addAssignment(date: string, shiftId: number, u: SimpleUser) {
    const d = this.normalizeDayKey(date);
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
      username: u.username, // Store username for backend API
      userName: u.displayName,
      orgUnitCode: u.orgUnitCode,
      orgUnitName: u.orgUnitName,
      isLeader: !!u.isLeader,
      dutyRoleName: u.isLeader ? 'Chỉ huy' : 'Trực ban',
      phone: u.phone,
      locationId: this.roster().locationId,
    };
    this.assignments.update((x) => [...x, a]);
  }

  removeAssignment(a: AssignmentRead) {
    this.assignments.update((list) =>
      list.filter(
        (i) =>
          !(
            i.date === a.date &&
            i.shiftId === a.shiftId &&
            i.userId === a.userId
          )
      )
    );
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
