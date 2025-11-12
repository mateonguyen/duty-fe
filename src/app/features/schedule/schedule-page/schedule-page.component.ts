import {
  Component,
  computed,
  signal,
  inject,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HeaderBarComponent } from './header-bar/header-bar.component';
import { StaffTreeComponent } from './staff-tree/staff-tree.component';
import { ShiftTabsComponent } from './shift-tabs/shift-tabs.component';
import { MonthBoardComponent } from './month-board/month-board.component';
import { FormsModule } from '@angular/forms';
import { ScopeService, ScopeRef } from '../../../core/services/scope.service';
import { DiagnosticsService } from '../../../core/diagnostics/diagnostics.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ScopePickerComponent } from './scope-picker/scope-picker.component';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  distinctUntilChanged,
  map,
  filter,
  switchMap,
  tap,
  catchError,
} from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

// models & service
import {
  RosterMeta,
  Shift,
  DutyLocation,
  AssignmentRead,
  SimpleUser,
} from '../schedule';
import { ScheduleDemoService } from '../services/schedule-demo.service';
import {
  StaffDataService,
  StaffByDepartment,
} from '../services/staff-data.service';
import {
  OrganizationService,
  OrgUnitNode,
} from '../../admin/system-config/organization.service';
import { Router } from '@angular/router';

// Extend OrgUnitNode to include staff
export interface OrgUnitNodeWithStaff extends OrgUnitNode {
  staff?: SimpleUser[];
  children: OrgUnitNodeWithStaff[];
}

@Component({
  standalone: true,
  selector: 'app-schedule-page',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    StaffTreeComponent,
    ShiftTabsComponent,
    MonthBoardComponent,
    ScopePickerComponent,
    HeaderBarComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './schedule-page.component.html',
})
export class SchedulePageComponent implements OnInit {
  private staffDataService = inject(StaffDataService);
  private http = inject(HttpClient);
  private scopeService = inject(ScopeService);
  private diag = inject(DiagnosticsService, { optional: true });
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  // Local stateless scope state for create page
  scopes = signal<ScopeRef[]>([]);
  activeScope = signal<ScopeRef | null>(null);

  // OrgId from active scope (for staff tree and API calls)
  activeOrgId = computed(() => this.activeScope()?.orgId || null);

  // ---- expose state qua getter (tránh dùng svc trong field initializer)
  get roster() {
    return this.svc.roster;
  }
  get assignments() {
    return this.svc.assignments;
  }
  get shifts(): Shift[] {
    return this.svc.shifts;
  }
  get locations(): DutyLocation[] {
    return this.svc.locations;
  }
  get staffAll(): SimpleUser[] {
    return this.svc.staffAll();
  }

  // Grouped staff for tree mode (always tree)
  groupedStaff = signal<StaffByDepartment[] | null>(null);

  // full tree returned from server (unfiltered)
  fullOrgTree = signal<OrgUnitNodeWithStaff[] | null>(null);

  // displayed tree filtered by selected scope/unit
  orgTreeWithStaff = signal<OrgUnitNodeWithStaff[] | null>(null);
  loadingTree = signal<boolean>(false);

  constructor(
    public svc: ScheduleDemoService,
    private confirmService: ConfirmationService,
    private orgService: OrganizationService,
    private router: Router
  ) {
    // set giá trị mặc định cho ca đang chọn
    this.selectedShiftId.set(this.svc.shifts[0]?.id ?? 0);

    // constructor intentionally minimal to avoid reactive loops
  }

  ngOnInit(): void {
    // Ensure default date range is set on initialization (for create mode)
    this.ensureDefaultMonthRange();

    // Load scopes immediately; route is protected by guard
    this.scopeService.load('roster.create').subscribe({
      next: (items) => {
        this.scopes.set(items);
        // Auto-select first scope if available (always once)
        if (!this.activeScope() && items.length > 0) {
          const first = items[0];
          this.activeScope.set(first);
          // Trigger same logic as manual selection
          this.onScopeChange(first);
          this.diag?.incStaffTreeReload();
        }
        console.debug('[SchedulePage] Scopes loaded for roster.create:', items);
      },
      error: (err) =>
        console.error('[SchedulePage] Failed to load scopes:', err),
    });

    // Reactive pipeline for loading staff tree and data
    toObservable(this.activeScope)
      .pipe(
        map((s) => s?.orgId ?? null),
        distinctUntilChanged(),
        tap((orgId) => {
          if (!orgId) {
            this.fullOrgTree.set(null);
            this.orgTreeWithStaff.set(null);
          }
        }),
        filter((orgId): orgId is string => !!orgId),
        switchMap((orgId) =>
          forkJoin({
            tree: this.orgService.fetchAllWithStaff(orgId),
            staff: this.svc.loadStaffForRoster$(orgId),
          }).pipe(
            catchError((err) => {
              console.error('[SchedulePage] staff-tree load error', err);
              this.fullOrgTree.set([]);
              this.orgTreeWithStaff.set([]);
              return of({ tree: [] as any[], staff: void 0 });
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ tree }) => {
        console.count && console.count('staff-tree-load');
        const mapped = (tree ?? []).map((n: any) => this.mapNode(n));
        this.fullOrgTree.set(mapped);
        this.orgTreeWithStaff.set(mapped);
      });
  }

  // No initializeScopes(): scopes are decoded from JWT and preloaded into ScopeService at app start

  get selectedUser() {
    return this.svc.selectedUser;
  }

  // ---- local UI state
  selectedShiftId = signal<number>(0); // set trong constructor
  visibleShiftIds = signal<number[]>([]);

  // Tính toán ngày từ-to thành array theo month view hiện tại
  days = computed(() => {
    const { from, to } = this.roster();
    // bạn đã có util toDayKey trong service; ở board sẽ tự build grid từ from/to
    return { from, to };
  });

  private ensureDefaultMonthRange() {
    const r = this.roster();
    if (!r.from || !r.to) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.roster.update((m) => ({
        ...m,
        from: start.toISOString().substring(0, 10),
        to: end.toISOString().substring(0, 10),
      }));
      console.debug('[SchedulePage] Default month range set', start, end);
    }
  }

  // ---- Handlers đến từ các child ----
  // Khi user chọn scope khác (called by ScopePicker)
  onScopeChange(scope: ScopeRef | null) {
    console.debug('[SchedulePage] Scope changed:', scope);
    this.activeScope.set(scope);
    // Sync unit name only here to avoid reactive feedback loops
    this.roster.update((r) =>
      scope ? { ...r, unitName: scope.displayName } : r
    );
    // Ensure a default date range exists (once)
    this.ensureDefaultMonthRange();
    // Load org tree with staff when scope changes
    if (scope) {
      this.loadingTree.set(true);
      this.orgService
        .fetchAllWithStaff(scope.orgId)
        .pipe(
          catchError((err) => {
            console.error(
              '[SchedulePage] Failed to load org tree with staff',
              err
            );
            this.orgTreeWithStaff.set([]);
            return of([]);
          })
        )
        .subscribe((tree: any[]) => {
          const mapped = (tree || []).map((n: any) => this.mapNode(n));
          this.orgTreeWithStaff.set(mapped);
          this.loadingTree.set(false);
        });
    } else {
      this.orgTreeWithStaff.set(null);
    }
  }

  private mapUser(u: any): SimpleUser {
    return {
      id: u.id,
      displayName: u.displayName || u.username,
      isLeader: !!u.isLeader,
      positionLevel: u.positionLevel ?? undefined,
      positionName: u.positionName,
      phone: undefined,
      orgUnitName: undefined,
      orgUnitId: u.orgUnitId ?? undefined,
    } as SimpleUser;
  }

  private mapNode(n: any): OrgUnitNodeWithStaff {
    return {
      id: n.id,
      code: n.code,
      name: n.name,
      staff: (n.staff || []).map((s: any) => this.mapUser(s)),
      children: (n.children || []).map((c: any) => this.mapNode(c)),
    } as OrgUnitNodeWithStaff;
  }

  onSave() {
    const orgId = this.activeOrgId();
    if (!orgId) {
      console.error('[SchedulePage] Cannot save roster: no active scope/orgId');
      alert('Vui lòng chọn đơn vị trước khi lưu');
      return;
    }

    // Build roster DTO with orgId from selected scope
    const rosterDto = {
      name: this.roster().unitName,
      scopeUnitId: orgId, // include orgId in payload
      periodStart: this.roster().from,
      periodEnd: this.roster().to,
      defaultLocationId: this.roster().locationId,
      assignments: this.assignments().map((a) => ({
        date: a.date,
        shiftId: a.shiftId,
        userId: a.userId,
        locationId: a.locationId,
        dutyRoleName: a.dutyRoleName,
        note: a.note,
      })),
    };

    console.log('[SchedulePage] Saving roster with orgId:', orgId, rosterDto);

    // TODO: Call actual API
    // this.rosterApi.create(rosterDto).subscribe({
    //   next: (result) => {
    //     console.log('Roster saved:', result);
    //     this.router.navigate(['/schedule/rosters']);
    //   },
    //   error: (err) => console.error('Failed to save roster:', err)
    // });
  }
  onCancel() {
    /* TODO: điều hướng rời trang hoặc reset */
    console.log('[SchedulePage] Cancel clicked');
    this.router.navigate(['/schedule/rosters']);
  }

  onMetaChange(meta: Partial<RosterMeta>) {
    console.log('onMetaChange', meta);

    // Nếu thay đổi date range, kiểm tra có assignments out-of-range không
    if (meta.from || meta.to) {
      const newFrom = meta.from || this.roster().from;
      const newTo = meta.to || this.roster().to;

      const outOfRange = this.assignments().filter(
        (a) => a.date < newFrom || a.date > newTo
      );

      if (outOfRange.length > 0) {
        this.confirmService.confirm({
          header: 'Xác nhận thay đổi khoảng ngày',
          message: `Có ${outOfRange.length} phân công trực nằm ngoài khoảng ngày mới sẽ bị xóa. Bạn có chắc chắn muốn tiếp tục?`,
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Đồng ý',
          rejectLabel: 'Hủy',
          accept: () => {
            // Xóa các assignments out-of-range
            outOfRange.forEach((a) => this.svc.removeAssignment(a));
            // Áp dụng range mới
            this.roster.update((r) => ({ ...r, ...meta }));
          },
          reject: () => {
            // Force trigger ngOnChanges bằng cách tạo object mới
            this.roster.update((r) => ({ ...r }));
          },
        });
        return;
      }
    }

    // Nếu không có thay đổi range hoặc không có assignments out-of-range
    this.roster.update((r) => ({ ...r, ...meta }));
  }

  // Không còn onUnitChange, dùng onScopeChange(scopeCode: string)

  private findNodeByCode(
    nodes: OrgUnitNodeWithStaff[] | null,
    code?: string | null
  ): OrgUnitNodeWithStaff | null {
    if (!nodes || !code) return null;
    for (const n of nodes) {
      if (n.code && n.code.toLowerCase() === code.toLowerCase()) return n;
      const found = this.findNodeByCode(n.children, code);
      if (found) return found;
    }
    return null;
  }

  private updateDisplayedOrgTree() {
    const full = this.fullOrgTree();
    if (!full) {
      this.orgTreeWithStaff.set([]);
      return;
    }
    const orgId = this.activeOrgId();
    if (orgId) {
      const orgIdStr = orgId; // string id
      const node = this.findNodeByCode(full, orgIdStr);
      if (node) {
        this.orgTreeWithStaff.set([node]);
        return;
      }
    }
    this.orgTreeWithStaff.set(full);
  }

  onSelectShift(id: number) {
    this.selectedShiftId.set(id);
  }

  onVisibleShiftsChange(ids: number[]) {
    // Xác định các ca bị gỡ bỏ
    const oldIds = this.visibleShiftIds().length
      ? this.visibleShiftIds()
      : this.shifts.map((s) => s.id);
    const removed = oldIds.filter((id) => !ids.includes(id));

    // Kiểm tra có assignments trong các ca bị gỡ không
    if (removed.length > 0) {
      const affected = this.assignments().filter((a) =>
        removed.includes(a.shiftId)
      );

      if (affected.length > 0) {
        this.confirmService.confirm({
          header: 'Xác nhận thay đổi ca hiển thị',
          message: `Có ${affected.length} phân công trực trong các ca vừa gỡ bỏ sẽ bị xóa. Bạn có chắc chắn muốn tiếp tục?`,
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Đồng ý',
          rejectLabel: 'Hủy',
          accept: () => {
            // Xóa các assignments thuộc ca bị gỡ
            affected.forEach((a) => this.svc.removeAssignment(a));
            // Áp dụng thay đổi
            this.visibleShiftIds.set(ids);
            // Ensure selected shift stays valid
            if (!ids.includes(this.selectedShiftId())) {
              const next = ids[0] ?? 0;
              if (next) this.selectedShiftId.set(next);
            }
          },
          reject: () => {
            // Giữ nguyên, không làm gì cả (dialog manage shifts vẫn mở)
          },
        });
        return;
      }
    }

    // Nếu không có assignments bị ảnh hưởng, áp dụng bình thường
    this.visibleShiftIds.set(ids);
    // ensure selected shift stays valid
    if (!ids.includes(this.selectedShiftId())) {
      const next = ids[0] ?? 0;
      if (next) this.selectedShiftId.set(next);
    }
  }

  onPickUser(u: SimpleUser | null) {
    this.selectedUser.set(u);
  }

  onQuickAdd(dateKey: string) {
    const u = this.selectedUser();
    const shiftId = this.selectedShiftId();
    if (!u || !shiftId) return;
    this.svc.addAssignment(dateKey, shiftId, u);
  }

  onRemoveAssignment(a: AssignmentRead) {
    this.svc.removeAssignment(a);
  }

  // When a new location is created from shift-tabs
  onLocationCreated(loc: { id: number; name: string }) {
    // Update catalog locally
    this.svc.locations = [
      ...this.svc.locations,
      { id: loc.id, name: loc.name },
    ];
    // Select the newly created location in roster meta
    this.roster.update((r) => ({ ...r, locationId: loc.id }));
  }

  // Xử lý drag staff vào calendar cell
  onStaffDropped(e: { user: SimpleUser; date: string }) {
    const shiftId = this.selectedShiftId();
    if (!e.user || !shiftId) return;
    // Không xóa staff khỏi tree, chỉ thêm assignment mới
    this.svc.addAssignment(e.date, shiftId, e.user);
  }
}
