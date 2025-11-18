import {
  Component,
  computed,
  signal,
  inject,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HeaderBarComponent } from './header-bar/header-bar.component';
import { StaffTreeComponent } from './staff-tree/staff-tree.component';
import { ShiftTabsComponent } from './shift-tabs/shift-tabs.component';
import {
  LocationTabsComponent,
  LocationConfig,
} from './location-tabs/location-tabs.component';
import { MonthBoardComponent } from './month-board/month-board.component';
import { FormsModule } from '@angular/forms';
import { ScopeService, ScopeRef } from '../../../core/services/scope.service';
import { DiagnosticsService } from '../../../core/diagnostics/diagnostics.service';
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
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DutyApiService } from '../../../core/api/duty-api.service';
import { RosterApiService } from '../roster-api.service';

// models & service
import {
  RosterMeta,
  Shift,
  DutyLocation,
  AssignmentRead,
  SimpleUser,
} from '../schedule';
import { ScheduleUiService } from '../services/schedule-ui.service';
import { StaffByDepartment } from '../services/staff-data.service';
import {
  OrganizationService,
  OrgUnitNode,
} from '../../admin/system-config/organization.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ScopePickerComponent } from '../../../shared/components/scope-picker/scope-picker.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

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
    LocationTabsComponent,
    MonthBoardComponent,
    ScopePickerComponent,
    HeaderBarComponent,
    ToastModule,
    TooltipModule,
    LoadingSpinnerComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './schedule-page.component.html',
})
export class SchedulePageComponent implements OnInit {
  private scopeService = inject(ScopeService);
  private diag = inject(DiagnosticsService, { optional: true });
  private destroyRef = inject(DestroyRef);
  private dutyApi = inject(DutyApiService);
  private rosterApi = inject(RosterApiService);
  private toast = inject(MessageService);
  private route = inject(ActivatedRoute);

  // Edit mode detection
  readonly rosterId = signal<number | null>(null);
  readonly isEditMode = signal<boolean>(false);

  // Roster status tracking
  readonly rosterStatus = signal<'DRAFT' | 'PUBLISHED' | 'LOCKED'>('DRAFT');

  // Computed UI state helpers
  readonly isDraft = computed(() => this.rosterStatus() === 'DRAFT');
  readonly isPublished = computed(() => this.rosterStatus() === 'PUBLISHED');
  readonly isLocked = computed(() => this.rosterStatus() === 'LOCKED');
  readonly canEdit = computed(() => this.isDraft());

  // Flag to prevent confirmation dialog during initial auto-selection
  private isInitializing = true;

  // Local stateless scope state for create page
  scopes = signal<ScopeRef[]>([]);
  activeScope = signal<ScopeRef | null>(null);

  // OrgId from active scope (for staff tree and API calls)
  activeOrgId = computed(() => this.activeScope()?.orgId || null);

  // Global page loading state
  pageLoading = signal(false);

  // Published-roster conflict state (for date range + location)
  checkingConflict = signal<boolean>(false);
  publishedConflict = signal<{ hasConflict: boolean; items: any[] } | null>(
    null
  );
  hasPublishedConflict = computed(
    () => this.publishedConflict()?.hasConflict ?? false
  );

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
    return this.svc.locations(); // Unwrap signal
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
  // loading indicator for shifts API
  shiftsLoading = signal<boolean>(false);

  // keep track of last auto-generated name to avoid overriding manual edits
  private lastAutoName: string | null = null;

  constructor(
    public svc: ScheduleUiService,
    private confirmService: ConfirmationService,
    private orgService: OrganizationService,
    private router: Router
  ) {
    // set giá trị mặc định cho ca đang chọn
    this.selectedShiftId.set(this.svc.shifts[0]?.id ?? 0);

    // constructor intentionally minimal to avoid reactive loops
  }

  ngOnInit(): void {
    // ── EDIT vs CREATE MODE DETECTION ──
    // Read rosterId from route params to determine mode
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.rosterId.set(id);
      this.isEditMode.set(true);
      console.debug('[SchedulePage] Edit mode for roster:', id);
      // Load existing roster data
      this.loadExistingRoster(id);
    } else {
      this.rosterId.set(null);
      this.isEditMode.set(false);
      console.debug('[SchedulePage] Create new roster mode');
      // ── STATE RESET STRATEGY for CREATE mode ──
      // Clear any stale state from previous roster sessions before initializing.
      this.clearStateForNewSession();
      this.initializeNewRoster();
    }
  }

  /**
   * Initialize NEW roster mode (create)
   */
  private initializeNewRoster(): void {
    // Ensure default date range is set on initialization (for create mode)
    this.ensureDefaultMonthRange();

    // Load locations from API
    this.svc.loadLocations();

    // Wait for locations to load, then initialize configs
    // TODO: Make loadLocations() return observable for better flow
    setTimeout(() => this.initializeLocationConfigs(), 500);

    // Load scopes immediately; route is protected by guard
    this.scopeService.load('roster.create').subscribe({
      next: (items) => {
        this.scopes.set(items);
        // Auto-select first scope if available (always once)
        if (!this.activeScope() && items.length > 0) {
          const first = items[0];
          this.activeScope.set(first);
          // Trigger same logic as manual selection
          // isInitializing=true prevents confirmation dialog on first auto-select
          this.onScopeChange(first);
          this.diag?.incStaffTreeReload();
          // Mark initialization complete after first scope selection
          setTimeout(() => (this.isInitializing = false), 0);
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

    // Reactive published-conflict checks: run when scope/date/location changes
    toObservable(
      computed(() => {
        const scopeCode = this.activeScope()?.orgId || null;
        const r = this.roster();
        const from = r.from || null;
        const to = r.to || null;
        const locId = r.locationId ?? null;
        return scopeCode && from && to ? { scopeCode, from, to, locId } : null;
      })
    )
      .pipe(
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((key) => {
          if (!key) return of(null);
          this.checkingConflict.set(true);
          const dto = {
            rosterId: null,
            scopeCode: key.scopeCode,
            name: this.roster().name || '',
            periodStart: key.from,
            periodEnd: key.to,
            defaultLocationId: key.locId,
          };
          return this.rosterApi.checkPublishedConflict(dto).pipe(
            catchError((err) => {
              console.error('[SchedulePage] conflict check failed', err);
              return of({ hasConflict: false, items: [] });
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        this.publishedConflict.set(res);
        this.checkingConflict.set(false);
      });
  }

  /**
   * Load existing roster for EDIT mode
   * Fetches full editor payload and populates all state
   */
  private loadExistingRoster(id: number): void {
    this.pageLoading.set(true);
    this.rosterApi.getForEditor(id).subscribe({
      next: (data) => {
        console.log('[SchedulePage] Loaded roster for edit:', data);

        // Set roster status
        this.rosterStatus.set(data.status);

        // Set roster metadata
        this.roster.set({
          id: data.id,
          name: data.name,
          unitId: 0, // Will be set from scope
          unitName: data.scopeUnitName,
          from: data.periodStart,
          to: data.periodEnd,
          locationId: data.defaultLocationId || undefined,
          status: data.status,
        });

        // Load locations
        this.svc.loadLocations();

        // Initialize location configs after locations load
        setTimeout(() => {
          this.initializeLocationConfigs();

          // Set location configs from editor data if available
          if (data.defaultLocationId) {
            this.locationConfigs.update((configs) =>
              configs.map((c) => ({
                ...c,
                isEnabled: c.id === data.defaultLocationId,
              }))
            );
          }
        }, 500);

        // Load scopes and set active scope
        this.scopeService.load('roster.edit').subscribe({
          next: (scopes) => {
            this.scopes.set(scopes);
            const matchingScope = scopes.find(
              (s) => s.orgId === data.scopeCode
            );
            if (matchingScope) {
              this.activeScope.set(matchingScope);
              this.roster.update((r) => ({
                ...r,
                unitId: parseInt(matchingScope.orgId) || 0,
              }));
            }
          },
          error: (err) =>
            console.error('[SchedulePage] Failed to load scopes:', err),
        });

        // ──────────────────────────────────────────────────────────────
        // EDIT MODE DATA STRATEGY
        // DRAFT  -> Use LIVE shifts & staff, rehydrate assignments with live data
        // PUBLISHED/LOCKED -> Use snapshot data from editor payload (read-only)
        // ──────────────────────────────────────────────────────────────

        const isDraft = data.status === 'DRAFT';

        // Prepare raw assignments snapshot first (will enrich for DRAFT)
        const rawAssignments = data.assignments.map(
          (a) =>
            ({
              date: a.dutyDate,
              shiftId: a.shiftId,
              userId: this.hashUsername(a.username),
              username: a.username,
              userName: a.fullName,
              orgUnitCode: a.unitCode,
              orgUnitName: a.unitName,
              positionTitle: a.positionTitle,
              locationId: a.locationId || undefined,
              dutyRoleName: a.dutyRoleName,
            } as AssignmentRead)
        );

        if (!isDraft) {
          // Snapshot path (immutable view): shifts come from editor payload
          this.svc.shifts = data.shifts.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            start: s.startTime,
            end: s.endTime,
          }));
          if (this.svc.shifts.length > 0) {
            this.selectedShiftId.set(this.svc.shifts[0].id);
          }
          this.svc.assignments.set(rawAssignments); // keep snapshot as-is
        } else {
          // DRAFT path: load LIVE shifts by scope (ignore snapshot shift definitions)
          if (data.scopeCode) {
            this.loadShiftsForScope(data.scopeCode);
          } else {
            this.svc.shifts = [];
          }
        }

        // Load staff tree (live) for both paths (snapshot still may show current org tree)
        if (data.scopeCode) {
          this.loadingTree.set(true);
          this.orgService
            .fetchAllWithStaff(data.scopeCode)
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

              if (isDraft) {
                // Rehydrate assignments with LIVE staff attributes
                const userMap = new Map<string, SimpleUser>();
                for (const node of mapped) this.flattenUsers(node, userMap);

                const enriched = rawAssignments.map((a) => {
                  const live = userMap.get(a.username || '') || null;
                  return {
                    ...a,
                    // Prefer LIVE data where available
                    userName: live?.displayName || a.userName,
                    orgUnitCode: live?.orgUnitCode || a.orgUnitCode,
                    orgUnitName: live?.orgUnitName || a.orgUnitName,
                    positionTitle: live?.positionName || a.positionTitle,
                    isLeader: live?.isLeader,
                    dutyRoleName: live?.isLeader ? 'Chỉ huy' : 'Trực ban',
                    phone: live?.phone || undefined,
                  } as AssignmentRead;
                });
                this.svc.assignments.set(enriched);
              }
            });
        }

        // Mark initialization complete
        setTimeout(() => {
          this.isInitializing = false;
          this.pageLoading.set(false);

          // Auto-select location if not set (for edit mode)
          if (!this.selectedLocationId() && data.defaultLocationId) {
            this.selectedLocationId.set(data.defaultLocationId);
          } else if (!this.selectedLocationId() && this.locations.length > 0) {
            this.selectedLocationId.set(this.locations[0].id);
          }
        }, 0);
      },
      error: (err) => {
        console.error('[SchedulePage] Failed to load roster for edit:', err);
        this.pageLoading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không thể tải dữ liệu lịch trực',
        });
        // Navigate back to list on error
        this.router.navigate(['/schedule/rosters']);
      },
    });
  }

  /**
   * Hash username to generate consistent numeric ID for UI
   */
  private hashUsername(username: string): number {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      const char = username.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // No initializeScopes(): scopes are decoded from JWT and preloaded into ScopeService at app start

  /**
   * Clear stale state from previous roster sessions.
   *
   * PROBLEM: ScheduleUiService is a singleton, so it retains state across route navigations.
   * If user creates a roster, saves draft, then deletes it, the service still has assignments in memory.
   * Opening "create new roster" would then show ghost data and trigger unwanted confirmation dialogs.
   *
   * SOLUTION: Reset service state when entering this page for a new session.
   */
  private clearStateForNewSession(): void {
    console.debug('[SchedulePage] Clearing stale state from previous sessions');
    this.svc.assignments.set([]);
    this.svc.selectedUser.set(null);
    // Keep roster metadata structure but clear unit-specific data
    this.svc.roster.update((r) => ({
      ...r,
      unitId: 0,
      unitName: '',
      name: '',
      locationId: undefined,
    }));
  }

  get selectedUser() {
    return this.svc.selectedUser;
  }

  // ---- local UI state
  selectedShiftId = signal<number>(0); // set trong constructor
  visibleShiftIds = signal<number[]>([]);
  selectedLocationId = signal<number | null>(null);

  // Location configuration: which locations are enabled for this roster
  locationConfigs = signal<LocationConfig[]>([]);

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
    // Cannot change scope in EDIT mode
    if (this.isEditMode()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Không thể đổi phạm vi',
        detail: 'Không thể thay đổi phạm vi khi đang sửa lịch trực',
      });
      // Rollback selection
      this.scopes.set([...this.scopes()]);
      return;
    }

    // ── CONFIRMATION LOGIC ──
    // Only show confirmation if:
    // 1. NOT during initial auto-selection (isInitializing=false)
    // 2. There are actual unsaved assignments in current state
    // This prevents the annoying "change scope will delete assignments" dialog
    // when the page first loads and auto-selects a scope.
    if (!this.isInitializing && this.assignments().length > 0) {
      this.confirmService.confirm({
        header: 'Xác nhận đổi phạm vi',
        message:
          'Đổi phạm vi sẽ xóa toàn bộ phân công hiện tại. Bạn có muốn tiếp tục?',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Xác nhận',
        rejectLabel: 'Hủy',
        rejectButtonStyleClass: 'p-button-danger',
        accept: () => {
          this.applyScopeChange(scope);
        },
        reject: () => {
          // Rollback: keep current scope selection (don't change activeScope)
          // Force re-render ScopePicker by creating new array reference
          this.scopes.set([...this.scopes()]);
        },
      });
      return;
    }

    // No assignments or initializing, change scope directly
    this.applyScopeChange(scope);
  }

  private applyScopeChange(scope: ScopeRef | null) {
    console.debug('[SchedulePage] Scope changed:', scope);

    // Clear all assignments when changing scope
    this.svc.assignments.set([]);

    this.activeScope.set(scope);

    // Sync unit name and unitId
    this.roster.update((r) =>
      scope
        ? {
            ...r,
            unitName: scope.displayName,
            unitId: parseInt(scope.orgId) || 0,
          }
        : r
    );

    // Update auto roster name when scope changes if user hasn't edited manually
    this.updateAutoRosterName();

    // Ensure a default date range exists (once)
    this.ensureDefaultMonthRange();

    // Load shifts for this scope
    if (scope) {
      this.loadShiftsForScope(scope.orgId);
    }

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

  private loadShiftsForScope(orgId: string) {
    console.debug(`[SchedulePage] load shifts for orgId=${orgId}`);
    this.shiftsLoading.set(true);
    this.dutyApi.getShiftsByScope(orgId, true).subscribe({
      next: (shifts) => {
        // Map to Shift interface
        this.svc.shifts = shifts.map((s: any) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          start: s.startTime?.substring(0, 5) || '00:00',
          end: s.endTime?.substring(0, 5) || '00:00',
        }));

        // Auto-select first shift
        if (this.svc.shifts.length > 0) {
          this.selectedShiftId.set(this.svc.shifts[0].id);
        }

        // Initialize selected location from enabled locations only
        if (!this.selectedLocationId()) {
          const enabledConfigs = this.locationConfigs().filter(
            (c) => c.isEnabled
          );
          if (enabledConfigs.length > 0) {
            this.selectedLocationId.set(enabledConfigs[0].id);
          } else if (this.locations.length > 0) {
            // Fallback: select first location if no configs yet
            this.selectedLocationId.set(this.locations[0].id);
          }
        }

        this.shiftsLoading.set(false);
        console.debug('[SchedulePage] Loaded shifts for scope:', shifts);
      },
      error: (err) => {
        console.error('[SchedulePage] Failed to load shifts:', err);
        this.svc.shifts = [];
        this.selectedShiftId.set(0);
        this.shiftsLoading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không tải được dữ liệu ca trực',
        });
      },
    });
  }

  // ===== Auto roster name helpers =====
  private generateAutoName(): string | null {
    const scopeName = this.activeScope()?.displayName?.toUpperCase();
    const r = this.roster();
    const from = r.from ? new Date(r.from) : new Date();
    const mm = String(from.getMonth() + 1).padStart(2, '0');
    const yyyy = String(from.getFullYear());
    if (!scopeName) return null;
    return `${scopeName} - ${mm}/${yyyy}`;
  }

  private shouldOverwriteName(current: string | undefined | null): boolean {
    if (!current || current.trim() === '') return true;
    return current === this.lastAutoName; // only overwrite if still auto-generated previously
  }

  private updateAutoRosterName() {
    const auto = this.generateAutoName();
    if (!auto) return;
    const r = this.roster();
    if (this.shouldOverwriteName(r.name)) {
      // Store both name (display) and keep unitName (original scope displayName) unchanged
      this.roster.update((m) => ({ ...m, name: auto }));
      this.lastAutoName = auto;
    }
  }

  private mapUser(u: any): SimpleUser {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName || u.username,
      isLeader: !!u.isLeader,
      positionLevel: u.positionLevel ?? undefined,
      positionName: u.positionName,
      phone: u.phone || undefined,
      orgUnitName: u.orgUnitName || undefined,
      orgUnitCode: u.orgUnitCode || undefined,
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

  /** Flatten users from org tree into map(username -> SimpleUser) */
  private flattenUsers(
    node: OrgUnitNodeWithStaff,
    map: Map<string, SimpleUser>
  ) {
    for (const u of node.staff || []) {
      if (u.username) map.set(u.username, u);
    }
    for (const c of node.children || []) this.flattenUsers(c, map);
  }

  // ===== Validation & Save Logic =====

  canSave(): boolean {
    const scope = this.activeScope();
    const r = this.roster();
    const hasAssignments = this.assignments().length > 0;
    return !!(scope && r.from && r.to && hasAssignments);
  }

  getSaveTooltip(): string {
    if (!this.activeScope()) return 'Vui lòng chọn phạm vi trước';
    if (!this.roster().from || !this.roster().to)
      return 'Vui lòng chọn khoảng ngày';
    if (this.assignments().length === 0)
      return 'Vui lòng thêm ít nhất 1 phân công';
    return '';
  }

  getPublishTooltip(): string {
    if (!this.canEdit())
      return 'Lịch trực đã xuất bản hoặc đã khóa, không thể chỉnh sửa';
    if (!this.activeScope()) return 'Vui lòng chọn phạm vi trước';
    if (!this.roster().from || !this.roster().to)
      return 'Vui lòng chọn khoảng ngày';
    if (this.assignments().length === 0)
      return 'Vui lòng thêm ít nhất 1 phân công';
    if (this.hasPublishedConflict())
      return 'Không thể xuất bản do trùng với lịch đã xuất bản khác';
    return '';
  }

  onSaveDraft() {
    if (this.isEditMode()) {
      this.updateExistingRoster();
    } else {
      this.createNewRoster('DRAFT');
    }
  }

  onPublish() {
    if (this.isEditMode()) {
      // For edit mode, save first then publish
      this.updateExistingRoster().then(() => {
        this.publishRoster(this.rosterId()!);
      });
    } else {
      this.createNewRoster('PUBLISHED');
    }
  }

  /**
   * Create NEW roster (CREATE mode)
   */
  private createNewRoster(status: 'DRAFT' | 'PUBLISHED') {
    const scope = this.activeScope();
    if (!scope) {
      this.toast.add({
        severity: 'error',
        summary: 'Lỗi',
        detail: 'Vui lòng chọn đơn vị trước khi lưu',
      });
      return;
    }

    if (this.assignments().length === 0) {
      this.toast.add({
        severity: 'warn',
        summary: 'Chưa có phân công',
        detail: 'Vui lòng thêm ít nhất 1 phân công trước khi lưu',
      });
      return;
    }

    const r = this.roster();

    // Auto-generate name if empty
    let rosterName = r.name || (r as any).unitName;
    if (!rosterName || rosterName.trim() === '') {
      const scopeName = scope.displayName || 'Lịch trực';
      const monthYear = r.from ? r.from.substring(0, 7).replace('-', '/') : '';
      rosterName = `${scopeName} - ${monthYear}`;
    }

    // Check for overlaps before proceeding with save
    this.checkOverlapBeforeSave(
      null, // rosterId is null for create
      scope.orgId,
      rosterName,
      r.from,
      r.to,
      r.locationId || null,
      () => this.proceedWithCreateRoster(status, scope, rosterName)
    );
  }

  /**
   * Check for roster overlaps and show appropriate dialogs
   * @param rosterId Roster ID (null for create, set for update)
   * @param scopeCode Scope code
   * @param name Roster name
   * @param periodStart Start date
   * @param periodEnd End date
   * @param defaultLocationId Location ID
   * @param onProceed Callback to execute if user confirms or no conflicts
   */
  private checkOverlapBeforeSave(
    rosterId: number | null,
    scopeCode: string,
    name: string,
    periodStart: string,
    periodEnd: string,
    defaultLocationId: number | null,
    onProceed: () => void
  ): void {
    const checkDto = {
      rosterId,
      scopeCode,
      name,
      periodStart,
      periodEnd,
      defaultLocationId,
    };

    this.rosterApi.checkOverlap(checkDto).subscribe({
      next: (result) => {
        if (result.hasHardBlock) {
          // Hard block: same name + overlapping period
          this.toast.add({
            severity: 'error',
            summary: 'Không thể lưu',
            detail:
              'Kỳ lịch của đơn vị này bị chồng lấn (cùng tên và thời gian).',
            life: 8000,
          });
          return;
        }

        if (result.hasSoftWarning) {
          // Soft warning: different name but same unit+location+period
          const rosterNames = result.softWarningRosters
            .map((r) => `"${r.name}"`)
            .join(', ');
          this.confirmService.confirm({
            header: 'Cảnh báo trùng lặp',
            message: `Khoảng thời gian và địa điểm này trùng với các kỳ lịch khác: ${rosterNames}. Bạn có muốn tiếp tục?`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Xác nhận',
            rejectLabel: 'Hủy',
            rejectButtonStyleClass: 'p-button-danger',
            accept: () => onProceed(),
          });
        } else {
          // No conflicts, proceed directly
          onProceed();
        }
      },
      error: (err) => {
        console.error('[SchedulePage] Overlap check failed:', err);
        // Proceed anyway on check failure (don't block user)
        onProceed();
      },
    });
  }

  /**
   * Proceed with creating roster after overlap check passed
   */
  private proceedWithCreateRoster(
    status: 'DRAFT' | 'PUBLISHED',
    scope: any,
    rosterName: string
  ): void {
    const r = this.roster();
    // Auto-generate name if empty
    let finalName = rosterName;
    if (!finalName || finalName.trim() === '') {
      const scopeName = scope.displayName || 'Lịch trực';
      const monthYear = r.from ? r.from.substring(0, 7).replace('-', '/') : '';
      finalName = `${scopeName} - ${monthYear}`;
    }

    // Create new roster
    const createDto = {
      name: finalName,
      scopeCode: scope.orgId,
      periodStart: r.from,
      periodEnd: r.to,
      defaultLocationId: r.locationId || null,
    };

    console.log('[SchedulePage] Creating roster:', createDto);

    this.rosterApi.create(createDto).subscribe({
      next: (result) => {
        console.log('[SchedulePage] Roster created:', result);

        // Update local state with new ID
        this.roster.update((current) => ({ ...current, id: result.id }));

        // Save assignments after roster is created
        this.saveAssignments(result.id, status);
      },
      error: (err) => {
        console.error('[SchedulePage] Failed to create roster:', err);
        this.handleSaveError(err);
      },
    });
  }

  /**
   * Update EXISTING roster (EDIT mode)
   * Returns promise for chaining with publish
   */
  private updateExistingRoster(): Promise<void> {
    return new Promise((resolve, reject) => {
      const rosterId = this.rosterId();
      if (!rosterId) {
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không tìm thấy ID lịch trực',
        });
        reject('No roster ID');
        return;
      }

      if (!this.canEdit()) {
        this.toast.add({
          severity: 'warn',
          summary: 'Không thể sửa',
          detail: 'Lịch trực đã xuất bản, không thể chỉnh sửa',
        });
        reject('Roster is locked');
        return;
      }

      const r = this.roster();
      const scope = this.activeScope();

      if (!scope) {
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Vui lòng chọn đơn vị trước khi lưu',
        });
        reject('No scope');
        return;
      }

      if (this.assignments().length === 0) {
        this.toast.add({
          severity: 'warn',
          summary: 'Chưa có phân công',
          detail: 'Vui lòng thêm ít nhất 1 phân công trước khi lưu',
        });
        reject('No assignments');
        return;
      }

      // Auto-generate name if empty
      let rosterName = r.name || (r as any).unitName;
      if (!rosterName || rosterName.trim() === '') {
        const scopeName = scope.displayName || 'Lịch trực';
        const monthYear = r.from
          ? r.from.substring(0, 7).replace('-', '/')
          : '';
        rosterName = `${scopeName} - ${monthYear}`;
      }

      // Check for overlaps before proceeding with update
      this.checkOverlapBeforeSave(
        rosterId,
        scope.orgId,
        rosterName,
        r.from,
        r.to,
        r.locationId || null,
        () =>
          this.proceedWithUpdateRoster(rosterId, rosterName, resolve, reject)
      );
    });
  }

  /**
   * Proceed with updating roster after overlap check passed
   */
  private proceedWithUpdateRoster(
    rosterId: number,
    rosterName: string,
    resolve: (value: void | PromiseLike<void>) => void,
    reject: (reason?: any) => void
  ): void {
    const r = this.roster();
    const updateDto = {
      id: rosterId,
      name: rosterName,
      periodStart: r.from,
      periodEnd: r.to,
      defaultLocationId: r.locationId || null,
    };

    console.log('[SchedulePage] Updating roster:', updateDto);

    this.rosterApi.update(updateDto).subscribe({
      next: (result) => {
        console.log('[SchedulePage] Roster updated:', result);

        // Save assignments after roster is updated
        this.saveAssignmentsForUpdate(rosterId).then(
          () => {
            this.toast.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã cập nhật lịch trực',
              life: 3000,
            });
            resolve();
          },
          (err) => reject(err)
        );
      },
      error: (err) => {
        console.error('[SchedulePage] Failed to update roster:', err);
        this.handleSaveError(err);
        reject(err);
      },
    });
  }

  /**
   * Save assignments for UPDATE mode (returns promise)
   */
  private saveAssignmentsForUpdate(rosterId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const scope = this.activeScope();
      if (!scope) {
        reject('No scope');
        return;
      }

      const changes = this.assignments().map((a) => {
        if (!a.username || a.username.trim() === '') {
          console.error(
            '[SchedulePage] Invalid assignment: missing username',
            a
          );
          throw new Error(`Assignment missing username for user ${a.userName}`);
        }

        return {
          kind: 'upsert' as const,
          dutyDate: a.date,
          shiftId: a.shiftId,
          username: a.username,
          userFullName: a.userName,
          userUnitCode: a.orgUnitCode || scope.orgId,
          userUnitName: a.orgUnitName || scope.displayName || '',
          userPositionTitle: a.positionTitle,
          userPositionLevel: a.positionLevel, // Snapshot C_LEVEL
          isLeader: a.isLeader, // Snapshot leader status
          assignmentType: 'NORMAL',
          locationId: a.locationId || null,
          dutyRoleId: null,
        };
      });

      console.log('[SchedulePage] Saving assignments for update:', changes);

      this.rosterApi.saveAssignments(rosterId, changes, 'AUTO').subscribe({
        next: () => {
          console.log('[SchedulePage] Assignments saved successfully');
          resolve();
        },
        error: (err) => {
          console.error('[SchedulePage] Failed to save assignments:', err);
          const errorMsg =
            err.error?.message || 'Không thể lưu danh sách phân công trực';
          this.toast.add({
            severity: 'error',
            summary: 'Lỗi khi lưu phân công',
            detail: errorMsg,
            life: 8000,
          });
          reject(err);
        },
      });
    });
  }

  private handleSaveError(err: any) {
    const errorMessage =
      err.error?.message || err.message || 'Không thể lưu lịch trực';

    this.toast.add({
      severity: 'error',
      summary: 'Lỗi khi lưu lịch trực',
      detail: errorMessage,
      life: 8000,
    });

    console.error('[SchedulePage] Error details:', {
      status: err.status,
      statusText: err.statusText,
      error: err.error,
      message: errorMessage,
    });
  }

  /**
   * Save assignments for a roster, then optionally publish
   * @param rosterId Roster ID
   * @param status Target status (DRAFT or PUBLISHED)
   */
  private saveAssignments(
    rosterId: number,
    status: 'DRAFT' | 'PUBLISHED'
  ): void {
    const scope = this.activeScope();
    if (!scope) return;

    // Convert assignments to backend format
    const changes = this.assignments().map((a) => {
      // Validate username: must be a real username from eOffice, not a fallback
      if (!a.username || a.username.trim() === '') {
        console.error('[SchedulePage] Invalid assignment: missing username', a);
        throw new Error(`Assignment missing username for user ${a.userName}`);
      }

      return {
        kind: 'upsert' as const,
        dutyDate: a.date,
        shiftId: a.shiftId,
        username: a.username, // Always use real username from eOffice (never fallback)
        userFullName: a.userName,
        // Snapshot org unit: preserve staff's unit at assignment time
        // Fallback to scope if staff.orgUnitCode missing (rare edge case)
        // Historical rosters will show this snapshot even if staff transfers later
        userUnitCode: a.orgUnitCode || scope.orgId, // Fallback to scope if not available
        userUnitName: a.orgUnitName || scope.displayName || '',
        userPositionTitle: a.positionTitle, // Snapshot staff position at assignment time
        userPositionLevel: a.positionLevel, // Snapshot C_LEVEL for leader sorting
        isLeader: a.isLeader, // Snapshot leader status
        assignmentType: 'NORMAL',
        locationId: a.locationId || null,
        dutyRoleId: null, // TODO: Add dutyRoleId support if needed
      };
    });

    console.log('[SchedulePage] Saving assignments:', changes);

    this.rosterApi.saveAssignments(rosterId, changes, 'AUTO').subscribe({
      next: () => {
        console.log('[SchedulePage] Assignments saved successfully');

        // If publishing, call publish endpoint
        if (status === 'PUBLISHED') {
          this.publishRoster(rosterId);
        } else {
          this.toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã lưu nháp lịch trực',
            life: 5000,
          });
          // Navigate to edit page
          this.router.navigate(['/schedule/rosters', rosterId, 'edit']);
        }
      },
      error: (err) => {
        console.error('[SchedulePage] Failed to save assignments:', err);
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi khi lưu phân công',
          detail:
            err.error?.message || 'Không thể lưu danh sách phân công trực',
          life: 8000,
        });
      },
    });
  }

  /**
   * Publish a roster
   * @param rosterId Roster ID
   */
  private publishRoster(rosterId: number): void {
    this.rosterApi.publish(rosterId).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: 'Thành công',
          detail: 'Đã xuất bản lịch trực',
          life: 3000,
        });
        // Navigate to edit page
        setTimeout(() => {
          this.router.navigate(['/schedule/rosters', rosterId, 'edit']);
        }, 1000);
      },
      error: (err) => {
        console.error('[SchedulePage] Failed to publish roster:', err);
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi khi xuất bản',
          detail: err.error?.message || 'Không thể xuất bản lịch trực',
          life: 8000,
        });
      },
    });
  }

  onCancel() {
    this.confirmService.confirm({
      header: 'Xác nhận Hủy',
      message: 'Hủy sẽ mất các thay đổi chưa lưu. Bạn có chắc chắn muốn hủy?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Ở lại',
      rejectLabel: 'Hủy',
      rejectButtonStyleClass: 'p-button-danger',
      reject: () => {
        this.router.navigate(['/schedule/rosters']);
      },
    });
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
          header: 'Xác nhận đổi khoảng ngày',
          message: `Có ${outOfRange.length} phân công trực nằm ngoài khoảng ngày mới sẽ bị xóa. Bạn có chắc chắn muốn tiếp tục?`,
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Xác nhận',
          rejectLabel: 'Hủy',
          rejectButtonStyleClass: 'p-button-danger',
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

  onSelectShift(id: number) {
    this.selectedShiftId.set(id);
  }

  onSelectLocation(id: number) {
    this.selectedLocationId.set(id);
    // keep roster meta in sync for legacy fields (overlap checks, defaults)
    this.roster.update((r) => ({ ...r, locationId: id }));
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
          acceptLabel: 'Xác nhận',
          rejectLabel: 'Hủy',
          rejectButtonStyleClass: 'p-button-danger',
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
    if (!this.canEdit()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Không thể thêm',
        detail: 'Lịch trực đã xuất bản, không thể chỉnh sửa',
      });
      return;
    }
    const u = this.selectedUser();
    const shiftId = this.selectedShiftId();
    if (!u || !shiftId) return;
    this.svc.addAssignment(dateKey, shiftId, u, this.selectedLocationId());
  }

  onRemoveAssignment(a: AssignmentRead) {
    if (!this.canEdit()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Không thể xóa',
        detail: 'Lịch trực đã xuất bản, không thể chỉnh sửa',
      });
      return;
    }
    this.svc.removeAssignment(a);
  }

  // When a new location is created from shift-tabs
  onLocationCreated(loc: { id: number; name: string }) {
    // Update catalog locally using signal.update()
    this.svc.locations.update((current) => [
      ...current,
      { id: loc.id, name: loc.name },
    ]);
    // Select the newly created location in roster meta
    this.roster.update((r) => ({ ...r, locationId: loc.id }));

    // Also add to location configs as enabled
    this.locationConfigs.update((configs) => [
      ...configs,
      { id: loc.id, name: loc.name, isEnabled: true },
    ]);
  }

  /**
   * Handle location configuration change from location-tabs
   * Confirms before disabling locations that have assignments
   */
  onLocationConfigChange(newConfigs: LocationConfig[]) {
    const oldConfigs = this.locationConfigs();

    // Find locations being disabled
    const disabledLocations = newConfigs.filter((nc) => {
      const old = oldConfigs.find((oc) => oc.id === nc.id);
      return old?.isEnabled && !nc.isEnabled;
    });

    // Check if any disabled location has assignments
    const locationsWithAssignments = disabledLocations.filter((loc) => {
      return this.assignments().some((a) => a.locationId === loc.id);
    });

    if (locationsWithAssignments.length > 0) {
      // Show confirmation dialog
      const locationNames = locationsWithAssignments
        .map((l) => l.name)
        .join(', ');
      this.confirmService.confirm({
        header: 'Xác nhận xóa địa điểm',
        message: `Các địa điểm sau đang có cán bộ được phân công: <strong>${locationNames}</strong>.<br><br>Nếu bỏ địa điểm, tất cả phân công ở các địa điểm này sẽ bị xóa.<br><br>Bạn có chắc chắn muốn tiếp tục?`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Xác nhận',
        rejectLabel: 'Hủy',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => {
          this.applyLocationConfigChange(newConfigs, locationsWithAssignments);
        },
        reject: () => {
          // Do nothing, keep old config
          console.log('[SchedulePage] User cancelled location config change');
        },
      });
    } else {
      // No assignments affected, apply immediately
      this.applyLocationConfigChange(newConfigs, []);
    }
  }

  /**
   * Apply location config change and cleanup assignments
   */
  private applyLocationConfigChange(
    newConfigs: LocationConfig[],
    locationsToCleanup: LocationConfig[]
  ) {
    // Remove assignments for disabled locations
    if (locationsToCleanup.length > 0) {
      const locationIds = new Set(locationsToCleanup.map((l) => l.id));
      this.svc.assignments.update((assignments) =>
        assignments.filter((a) => !locationIds.has(a.locationId || 0))
      );

      this.toast.add({
        severity: 'success',
        summary: 'Đã xóa phân công',
        detail: `Đã xóa ${locationIds.size} địa điểm và các phân công liên quan`,
      });
    }

    // Update location configs
    this.locationConfigs.set(newConfigs);

    // If current selected location is disabled, switch to first enabled
    const currentId = this.selectedLocationId();
    const currentConfig = newConfigs.find((c) => c.id === currentId);
    if (!currentConfig?.isEnabled) {
      const firstEnabled = newConfigs.find((c) => c.isEnabled);
      this.selectedLocationId.set(firstEnabled?.id || null);
    }

    console.log('[SchedulePage] Applied location config change:', newConfigs);
  }

  /**
   * Initialize location configs from loaded locations
   * Called after locations are loaded in create/edit mode
   */
  private initializeLocationConfigs() {
    const currentConfigs = this.locationConfigs();
    const allLocations = this.locations;

    // If configs already exist (from edit mode), keep them
    if (currentConfigs.length > 0) {
      return;
    }

    // Create configs for all locations (default: all enabled)
    const configs: LocationConfig[] = allLocations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      isEnabled: true, // Enable all by default for new rosters
    }));

    this.locationConfigs.set(configs);
    console.log('[SchedulePage] Initialized location configs:', configs);
  }

  // Xử lý drag staff vào calendar cell
  onStaffDropped(e: { user: SimpleUser; date: string }) {
    if (!this.canEdit()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Không thể thêm',
        detail: 'Lịch trực đã xuất bản, không thể chỉnh sửa',
      });
      return;
    }
    const shiftId = this.selectedShiftId();
    if (!e.user || !shiftId) return;
    // Không xóa staff khỏi tree, chỉ thêm assignment mới
    this.svc.addAssignment(e.date, shiftId, e.user, this.selectedLocationId());
  }
}
