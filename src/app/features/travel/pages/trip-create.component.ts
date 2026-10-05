import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
  effect,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  AbstractControl,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, EMPTY, of, Observable } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
  catchError,
} from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { TravelApiService } from '../services/travel-api.service';
import {
  PersonnelApiService,
  PersonnelDto,
} from '../services/personnel-api.service';
import { PersonnelStoreService } from '../services/personnel-store.service';
import { TravelLeaderSourceService } from '../services/travel-leader-source.service';
import { TravelStaffTreeService } from '../services/travel-staff-tree.service';
import { TravelStaffDropdownComponent } from '../components/travel-staff-dropdown.component';
import { SimpleUser } from '../../schedule/schedule';
import {
  CreateSingleTravelOrderRequestDto,
  CreateTravelTripRequest,
  TravelOrderDetailDto,
  TravelOrderPreviewModel,
  TravelOrderViewDto,
  TravelTripDetailDto,
  UpdateTravelOrderRequestDto,
  UpdateTravelOrderOverrideRequest,
} from '../models/travel.models';
import { ScopePickerComponent } from '../../../shared/components/scope-picker/scope-picker.component';
import { ScopeService, ScopeRef } from '../../../core/services/scope.service';
import { SafePipe } from '../../../shared/pipes/safe.pipe';
import {
  FileViewComponent,
  FileConfig,
} from '../../../shared/components/file-view/file-view.component';

// Per-person override state for batch mode
export interface PersonOverrideState {
  signerName?: string | null;
  signerTitle?: string | null;
  signerUnitName?: string | null;
  missionNo?: string | null;
  missionDate?: Date | string | null;
  fromDate?: Date | string | null;
  toDate?: Date | string | null;
}

@Component({
  selector: 'app-trip-create',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ReactiveFormsModule,
    FormsModule,
    ScopePickerComponent,
    PanelModule,
    InputTextModule,
    CalendarModule,
    AutoCompleteModule,
    SafePipe,
    FileViewComponent,
  ],
  templateUrl: './trip-create.component.html',
  styleUrl: './trip-create.component.scss',
})
export class TripCreateComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(TravelApiService);
  private personnelApi = inject(PersonnelApiService);
  private personnelStore = inject(PersonnelStoreService);
  private leaderSource = inject(TravelLeaderSourceService);
  private staffTreeService = inject(TravelStaffTreeService);
  private scopeService = inject(ScopeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild('personnelSection') personnelSection!: ElementRef;

  // Form controls
  tripForm!: FormGroup;
  signerSearchCtrl = new FormControl('');
  personnelSearchCtrl = new FormControl('');

  // Scopes
  scopes = signal<ScopeRef[]>([]);
  activeScope = signal<ScopeRef | null>(null);

  // Edit mode
  editingTripId: number | null = null;
  editingOrderId: number | null = null;
  copyingOrderId: number | null = null;
  orderDetail = signal<TravelOrderDetailDto | null>(null);
  orderView = signal<TravelOrderViewDto | null>(null);
  isEditMode(): boolean {
    return this.editingTripId !== null && this.editingOrderId === null;
  }

  isOrderEditMode(): boolean {
    return this.editingOrderId !== null;
  }

  // Signer search / Leader approval
  signerSearchQuery = signal('');
  approverQuery = signal('');
  showSignerDropdown = signal(false);
  showLeaderDropdown = signal(false);
  leaderSearchLoading = signal(false);
  leaderDropdownResults = signal<PersonnelDto[]>([]);
  highlightedLeaderIndex = signal<number>(-1);
  approverDropdownPlacement = signal<'top' | 'bottom'>('bottom');
  approverDropdownMaxHeight = signal(280);
  approverPool = signal<PersonnelDto[]>([]);
  private approverPoolByOrg = new Map<string, PersonnelDto[]>();
  selectedSigner = signal<PersonnelDto | null>(null);
  bulkSignerUsername = signal('');
  bulkApplyScope = signal<'all' | 'active' | 'leaders' | 'staff'>('all');
  activePersonId = signal<string | null>(null);
  signerByPerson = signal<Map<string, PersonnelDto | null>>(
    new Map<string, PersonnelDto | null>(),
  );
  openSignerPickerPersonId = signal<string | null>(null);
  signerPickerQuery = signal('');
  isApproverRequired = signal(false);

  // Batch create: per-person overrides (phase 2)
  batchPersonOverrides = signal<Map<number, PersonOverrideState>>(
    new Map<number, PersonOverrideState>(),
  );
  expandedPersonIndex = signal<number | null>(null);

  // Personnel search & dropdown
  personnelSearchQuery = signal('');
  showStaffDropdown = signal(false);
  highlightedStaffIndex = signal<number>(-1);
  hasPersonnelInteracted = signal(false);
  suppressOpenOnce = signal(false);
  suppressOpenUntil = signal<number>(0);

  // PDF preview modal
  showPdfModal = signal(false);
  isLoadingPdf = signal(false);
  pdfBlobUrl = signal<string | null>(null);

  // Inline PDF preview state - proper blob management
  previewBlob: Blob | null = null;
  private currentBlobUrl: string | null = null;
  previewBlobUrl = signal<string | null>(null);
  currentFileConfig = signal<FileConfig | null>(null);
  previewError = signal<string | null>(null);
  private previewTrigger$ = new Subject<string>();
  private previewSubscription: any = null;

  // Flat results for dropdown groups
  leadersResults = signal<PersonnelDto[]>([]);
  staffResults = signal<PersonnelDto[]>([]);

  // Reference to personnel input for blur control
  @ViewChild('personnelInput', { static: false })
  personnelInputRef?: ElementRef<HTMLInputElement>;

  // Staff tree for new dropdown
  staffTree = computed(() => this.staffTreeService.staffTree());

  // Filtered staff tree driven by the single search input
  filteredStaffTree = computed(() => {
    const tree = this.staffTree();
    const q = this.personnelSearchQuery().trim();
    if (!q) return tree;
    return this.staffTreeService.filterTree(tree, q);
  });

  // Diagnostic: observe scoped personnel size (effect must be in injection context)
  private scopePersonnelEffect = effect(() => {
    try {
      const cnt = (this.personnelStore as any).scopePersonnel?.()?.length ?? 0;
      console.log('[Travel] scopePersonnel=', cnt);
    } catch {}
  });

  // Reference to the dropdown wrapper for outside-click detection
  @ViewChild('personnelDropdownWrapper', { static: false })
  personnelDropdownWrapper?: ElementRef<HTMLElement>;

  @ViewChild('approverDropdownWrapper', { static: false })
  approverDropdownWrapper?: ElementRef<HTMLElement>;

  @ViewChild('bulkApproverSearchInput', { static: false })
  bulkApproverSearchInput?: ElementRef<HTMLInputElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Close staff dropdown if click outside
    const staffWrapper = this.personnelDropdownWrapper?.nativeElement;
    if (staffWrapper && !staffWrapper.contains(target)) {
      this.closeStaffDropdown();
    }

    // Close leader dropdown if click outside approver section
    const approverSection = document.querySelector('.approver-section');
    if (approverSection && !approverSection.contains(target)) {
      this.closeLeaderDropdown();
    }

    if (!target.closest('.card-signer-picker')) {
      this.closeSignerPicker();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.showLeaderDropdown()) {
      this.scheduleApproverDropdownPositionUpdate();
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.showLeaderDropdown()) {
      this.scheduleApproverDropdownPositionUpdate();
    }
  }

  // Temporary shim: legacy local personnel source is deprecated.
  personnelLocal(): PersonnelDto[] {
    return [];
  }

  // Leaders from root org config (independent of scope picker)
  leadersLocal = computed(() => this.leaderSource.leaders());
  // Leaders derived from scoped personnel (preferred for approver search)
  leadersPool = computed(() => {
    const list = (this.personnelStore as any).scopePersonnel?.() ?? [];
    return (Array.isArray(list) ? list : []).filter(
      (x: any) => x?.isLeader === true,
    );
  });

  // Keep approver pool aligned with the current scope leaders plus expanded chain cache.
  private approverPoolSyncEffect = effect(() => {
    this.leadersPool();
    this.refreshApproverPool();
  });

  // UI state
  errorMsg = signal('');
  isSubmitting = signal(false);
  canTakeNumberOnForm = signal(true);
  private issueAndPrintAfterSave = false;

  // AutoComplete suggestions
  signerSuggestions = signal<PersonnelDto[]>([]);
  officerSuggestions = signal<PersonnelDto[]>([]);

  // Form arrays
  get personsArray(): any[] {
    const ctrl = this.tripForm?.get('persons') as FormArray;
    return ctrl ? ctrl.controls.map((c) => c.value) : [];
  }

  get stopsArray() {
    return this.tripForm?.get('stops') as FormArray;
  }

  get activePersonIndex(): number {
    const persons = this.getSelectedPersonnelForPreview();
    const activeId = this.activePersonId();
    if (!activeId || persons.length === 0) {
      return 0;
    }
    const idx = persons.findIndex(
      (p, i) => this.getPersonKey(p, i) === activeId,
    );
    return idx >= 0 ? idx : 0;
  }

  private getSelectedPersonnelForPreview(): any[] {
    const ctrl = this.tripForm?.get('persons') as FormArray;
    if (!ctrl) return [];
    return ctrl.controls.map((c: any) =>
      typeof c?.getRawValue === 'function' ? c.getRawValue() : c.value,
    );
  }

  // Accessor for persons FormArray and in-place sort helper
  get personsFA(): FormArray {
    return this.tripForm.get('persons') as FormArray;
  }

  // Sorted view-only list of selected personnel (does not mutate FormArray)
  get sortedSelectedPersonnel(): AbstractControl[] {
    const arr = this.personsFA.controls;
    return [...arr].sort((a, b) => {
      const A: any = a.value;
      const B: any = b.value;
      const la = A?.isLeader ? 1 : 0;
      const lb = B?.isLeader ? 1 : 0;
      if (la !== lb) return lb - la; // leaders first
      const ca = A?.cLevel ?? 999;
      const cb = B?.cLevel ?? 999;
      if (ca !== cb) return ca - cb; // smaller level first
      return (A?.fullName || '').localeCompare(B?.fullName || '', 'vi');
    });
  }

  private sortPersonsFormArray(): void {
    const personsCtrl = this.personsFA;
    const items = personsCtrl.controls.map((c) => c.value as PersonnelDto);
    const sorted = items.sort((a, b) => {
      const pos = (a.positionTitle || '').localeCompare(
        b.positionTitle || '',
        'vi',
      );
      if (pos !== 0) return pos;
      const rank = this.getRankName(a).localeCompare(this.getRankName(b), 'vi');
      if (rank !== 0) return rank;
      return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
    });
    const newControls = sorted.map((p) =>
      this.fb.group({
        fullName: [p.fullName],
        rankName: [p.rankName || p.rankTitle || ''],
        rankTitle: [p.rankTitle || p.rankName || ''],
        displayNameWithRank: [this.getDisplayNameWithRank(p)],
        positionTitle: [p.positionTitle || ''],
        unitName: [p.unitName],
        username: [p.username],
        personId: [p.username || ''],
        personCode: [p.username || ''],
        unitCode: [(p as any).orgCode || ''],
        orgCode: [(p as any).orgCode || ''],
        isLeader: [p.isLeader === true],
        cLevel: [(p as any)?.cLevel ?? null],
      }),
    );
    personsCtrl.clear();
    newControls.forEach((ctrl) => personsCtrl.push(ctrl));
  }

  get isPersonnelQueryNonEmpty(): boolean {
    return this.personnelSearchQuery().trim().length > 0;
  }

  ngOnInit() {
    this.initializeForm();
    this.loadScopes();
    this.setupSearchListeners();
    this.setupPreviewPipeline();
    this.checkEditMode();
    this.checkCopyMode();
    // Trigger initial preview
    this.triggerPreview('init');
  }

  private initializeForm() {
    this.tripForm = this.fb.group({
      missionNo: [''],
      missionDate: [null],
      fromDate: [null],
      toDate: [null],
      persons: this.fb.array([]),
      stops: this.fb.array([this.createStopForm()]),
    });

    // Auto-refresh preview for relevant form changes
    this.tripForm.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      const selected = this.getSelectedPersonnelForPreview();
      if (selected.length === 0) {
        return;
      }
      this.triggerPreview('form-change');
    });
  }

  private createStopForm() {
    return this.fb.group({
      fromLocation: [''],
      fromDateTime: [null],
      toLocation: [''],
      toDateTime: [null],
      transport: [''],
    });
  }

  private loadScopes() {
    this.scopeService.load('travel.trip.create').subscribe({
      next: (scopes: ScopeRef[]) => {
        this.scopes.set(scopes || []);
        if (scopes && scopes.length > 0) {
          this.onScopeChange(scopes[0]);
        }
      },
      error: () => {
        this.errorMsg.set('Không thể tải danh sách đơn vị');
      },
    });
  }

  private setupSearchListeners() {
    // Personnel search input
    this.personnelSearchCtrl.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged())
      .subscribe((query) => {
        const now = Date.now();
        if (now < this.suppressOpenUntil()) {
          return;
        }
        const q = (query ?? '').toString().trim();
        this.personnelSearchQuery.set(q);
        // Build flat results when query non-empty
        if (q.length >= 1) {
          this.buildFlatResults(q);
          this.resetHighlightedStaffForCurrentResults();
          // Only open when user has interacted and query non-empty
          if (this.hasPersonnelInteracted()) {
            this.showStaffDropdown.set(true);
          }
        } else {
          this.leadersResults.set([]);
          this.staffResults.set([]);
          this.showStaffDropdown.set(false);
          this.highlightedStaffIndex.set(-1);
        }
      });
  }

  private setupPreviewPipeline() {
    this.previewSubscription = this.previewTrigger$
      .pipe(
        debounceTime(350),
        switchMap((reason) => {
          const persons = this.getSelectedPersonnelForPreview();
          const count = persons.length;
          console.log('[Preview] trigger', { reason, count });
          if (count === 0) {
            // Don't clear here - clearing is handled in triggerPreview guard
            return EMPTY;
          }

          this.isLoadingPdf.set(true);
          this.previewError.set(null);

          const payload = this.buildPreviewRequestForPdf(persons);
          console.log('[Preview] payload sample:', {
            persons: payload?.orders?.length ?? payload?.persons?.length,
            firstTenCanBo:
              payload?.orders?.[0]?.tenCanBo ?? payload?.persons?.[0]?.tenCanBo,
          });

          return this.api.previewTripPdf(payload).pipe(
            tap(async (blob: Blob) => {
              console.log('[Preview] got blob', {
                size: blob?.size,
                type: blob?.type,
              });
              await this.setPreviewBlob(blob, 'travel-order.pdf');
            }),
            catchError((err) => {
              console.error('[Preview] API error', err);
              this.previewError.set(
                'Không tạo được bản xem trước. Vui lòng thử lại.',
              );
              this.isLoadingPdf.set(false);
              this.describePreviewError(err).then((msg) => {
                if (msg) this.previewError.set(msg);
              });
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe((blob) => {
        if (!blob) return;
      });
  }

  /** Turn the backend error (JSON inside a Blob body) into an actionable message. */
  private async describePreviewError(err: any): Promise<string | null> {
    const status: number = err?.status ?? -1;
    let code = '';
    try {
      const body =
        err?.error instanceof Blob ? JSON.parse(await err.error.text()) : err?.error;
      code = (body?.error || '').toString();
    } catch {
      // Body is not JSON; fall back to status-based message.
    }

    if (code.startsWith('GOTENBERG') || status === 502) {
      return 'Dịch vụ tạo PDF (Gotenberg) chưa chạy hoặc máy chủ không kết nối được tới nó. Liên hệ quản trị hệ thống.';
    }
    if (code === 'TEMPLATE_NOT_FOUND') {
      return 'Không tìm thấy mẫu giấy đi đường trên máy chủ.';
    }
    if (status === 401 || status === 403) {
      return 'Phiên đăng nhập đã hết hạn hoặc bạn không có quyền xem trước.';
    }
    if (status === 0) {
      return 'Không kết nối được tới máy chủ.';
    }
    return null;
  }

  private buildPreviewRequestForPdf(persons: any[]) {
    const activeIdx = this.activePersonIndex;
    const mapped = persons.map((p: any, index: number) => {
      const ten =
        p.displayNameWithRank ||
        [p.rankName || p.rankTitle, p.fullName || p.username || p.personCode]
          .filter(Boolean)
          .join(' ');
      const signer = this.resolveSignerForPerson(p, index);
      return {
        ...p,
        empName: ten,
        signerName: signer?.fullName || '',
        personName: ten,
        personCode: p.personCode ?? p.username ?? null,
        fullName: p.fullName || p.username || p.personCode || '',
        username: p.username ?? null,
        rankId: p.rankId ?? null,
        rankCode: p.rankCode ?? null,
        rankName: p.rankName ?? p.rankTitle ?? null,
        rankTitle: p.rankTitle ?? p.rankName ?? null,
        positionTitle: p.positionTitle ?? null,
        unitName: p.unitName ?? null,
        displayNameWithRank: ten,
      };
    });
    const activeTen = mapped[activeIdx]?.empName || mapped[0]?.empName || '';
    const activeSignerName =
      mapped[activeIdx]?.signerName || mapped[0]?.signerName || '';
    const activeSigner =
      this.resolveSignerForPerson(persons[activeIdx], activeIdx) ||
      this.resolveSignerForPerson(persons[0], 0) ||
      this.getPrimarySigner();
    const activeSignerRankName =
      activeSigner?.rankName || activeSigner?.rankTitle || '';
    const activeSignerUserId = activeSigner?.username || '';
    const activeSignerUnitId = (activeSigner as any)?.orgCode || '';

    const activePerson = mapped[activeIdx] || mapped[0] || null;
    const empTitle = [activePerson?.positionTitle, activePerson?.unitName]
      .filter((x) => !!(x || '').toString().trim())
      .join(', ');
    const soCongLenh = (
      this.tripForm?.get('missionNo')?.value || ''
    ).toString();

    return {
      empName: activeTen,
      signerName: activeSignerName,
      signerRankName: activeSignerRankName,
      signerUserId: activeSignerUserId,
      signerUnitId: activeSignerUnitId,
      signerUnitName: activeSigner?.unitName || '',
      documentSnapshotJson:
        this.isOrderEditMode() &&
        this.orderDetail()?.signerName === activeSignerName &&
        this.orderDetail()?.signerUnitName === activeSigner?.unitName
          ? this.orderDetail()?.documentSnapshotJson
          : undefined,
      empTitle,
      soCongLenh,
      persons: mapped,
      orders: mapped,
      previewPersonIndex: activeIdx,
      missionDate: this.toLocalDateString(this.tripForm?.get('missionDate')?.value),
      fromDate: this.toLocalDateString(this.tripForm?.get('fromDate')?.value),
      toDate: this.toLocalDateString(this.tripForm?.get('toDate')?.value),
      stops: (this.stopsArray?.value || []).map((stop: any) => ({
        fromLocation: stop?.fromLocation || null,
        toLocation: stop?.toLocation || null,
        fromDateTime: this.toLocalDateString(stop?.fromDateTime, true),
        toDateTime: this.toLocalDateString(stop?.toDateTime, true),
        transport: stop?.transport || null,
      })),
    };
  }

  private toCalendarDate(value?: string | null): Date | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
  }
  /** Local "yyyy-MM-dd[THH:mm]" so the server never sees a UTC-shifted day. */
  private toLocalDateString(value: any, withTime = false): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => `${n}`.padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
  }

  private clearPreview(reason: string) {
    console.log('[Preview] clear', reason);
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    const oldUrl = this.previewBlobUrl();
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }
    this.previewBlob = null;
    this.previewBlobUrl.set(null);
    this.pdfBlobUrl.set(null);
    this.currentFileConfig.set(null);
    this.previewError.set(null);
    this.isLoadingPdf.set(false);
  }

  private async setPreviewBlob(blob: Blob, fileName: string) {
    // Validate blob type is PDF
    const blobType = blob?.type ?? '';
    const blobSize = blob?.size ?? 0;

    console.log('[Preview] setPreviewBlob received:', {
      type: blobType,
      size: blobSize,
      blobConstructor: blob?.constructor?.name,
    });

    // If blob type is HTML/JSON, read content and show clear error
    if (blobType.includes('html') || blobType.includes('json')) {
      try {
        const text = await blob.text();
        const sample = text.substring(0, 500);
        console.error('[Preview] received HTML/JSON instead of PDF:', {
          type: blobType,
          size: blobSize,
          sample,
        });
        this.previewError.set(
          'Preview trả về trang web thay vì PDF (có thể bị redirect/401/lỗi)',
        );
        this.isLoadingPdf.set(false);
        return;
      } catch (err) {
        console.error('[Preview] error reading HTML/JSON blob:', err);
      }
    }

    // If blob type is empty or generic, try to detect by reading first bytes
    if (
      !blobType ||
      blobType === 'application/octet-stream' ||
      blobType === ''
    ) {
      console.warn('[Preview] blob type is empty/generic, checking content...');
      try {
        const header = await blob.slice(0, 10).text();
        console.log('[Preview] blob header:', header);

        // Check if it's HTML (starts with <!DOCTYPE or <html)
        if (
          header.trim().startsWith('<!') ||
          header.trim().startsWith('<html')
        ) {
          const text = await blob.text();
          const sample = text.substring(0, 500);
          console.error(
            '[Preview] detected HTML content (blob type was empty):',
            sample,
          );
          this.previewError.set(
            'Backend trả về HTML thay vì PDF - kiểm tra API endpoint hoặc backend đang chạy',
          );
          this.isLoadingPdf.set(false);
          return;
        }
      } catch (err) {
        console.error('[Preview] error reading blob header:', err);
      }
    }

    if (blobType !== 'application/pdf') {
      console.error('[Preview] invalid blob type:', blobType);
      this.previewError.set(
        'Preview response is not a PDF (type: ' + blobType + ')',
      );
      this.isLoadingPdf.set(false);
      return;
    }

    // Validate size
    if (blobSize < 1024) {
      console.error('[Preview] blob too small:', blobSize);
      this.previewError.set(
        'Preview file is too small (might be error response)',
      );
      this.isLoadingPdf.set(false);
      return;
    }

    // Validate PDF magic header asynchronously
    this.validatePdfHeader(blob).then((isValid) => {
      if (!isValid) {
        console.error('[Preview] blob does not start with %PDF');
        this.previewError.set('Preview response is not a valid PDF');
        this.isLoadingPdf.set(false);
        return;
      }

      // Revoke old URL if exists
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }
      const oldUrl = this.previewBlobUrl();
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }

      // Set new blob and URL
      this.previewBlob = blob;
      const newUrl = URL.createObjectURL(blob);
      const isBlobUrl =
        typeof newUrl === 'string' && newUrl.startsWith('blob:');
      const hasPdfExt =
        typeof fileName === 'string' && fileName.toLowerCase().endsWith('.pdf');

      // Logging before bind
      console.debug('[Preview] about to bind viewer source', {
        fileName,
        blobType,
        blobSize,
        previewUrl: newUrl,
        typeofUrl: typeof newUrl,
        startsWithBlob: isBlobUrl,
        hasPdfExt,
      });

      this.currentBlobUrl = newUrl;
      this.previewBlobUrl.set(newUrl);
      this.currentFileConfig.set({
        filePath: newUrl,
        fileName,
        isBlobUrl: true,
      });
      this.isLoadingPdf.set(false);
    });
  }

  private async validatePdfHeader(blob: Blob): Promise<boolean> {
    try {
      const header = await blob.slice(0, 4).text();
      return header === '%PDF';
    } catch {
      return false;
    }
  }

  private normalize(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  private matchesQuery(p: PersonnelDto, q: string): boolean {
    const nq = this.normalize(q);
    return (
      this.normalize(p.fullName).includes(nq) ||
      this.normalize(this.getRankName(p)).includes(nq) ||
      this.normalize(p.positionTitle || '').includes(nq) ||
      this.normalize(p.unitName || '').includes(nq)
    );
  }

  private sortLeaders(list: PersonnelDto[]): PersonnelDto[] {
    return [...list].sort((a, b) => {
      // cLevel/positionLevel: lower means higher position => sort ascending first
      const aLevel =
        (a as any).cLevel ??
        (a as any).positionLevel ??
        Number.MAX_SAFE_INTEGER;
      const bLevel =
        (b as any).cLevel ??
        (b as any).positionLevel ??
        Number.MAX_SAFE_INTEGER;
      const levelCmp = (aLevel as number) - (bLevel as number);
      if (levelCmp !== 0) return levelCmp;
      // Then rankLevel desc if available, else rankTitle desc
      const aRankLevel = (a as any).rankLevel ?? null;
      const bRankLevel = (b as any).rankLevel ?? null;
      if (aRankLevel !== null && bRankLevel !== null) {
        const rankCmp = (bRankLevel as number) - (aRankLevel as number);
        if (rankCmp !== 0) return rankCmp;
      } else {
        const rank = this.getRankName(b).localeCompare(
          this.getRankName(a),
          'vi',
        );
        if (rank !== 0) return rank;
      }
      return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
    });
  }

  private sortStaff(list: PersonnelDto[]): PersonnelDto[] {
    const posKey = (t: string) =>
      t?.includes('Trưởng') ? 0 : t?.includes('Phó') ? 1 : 2;
    return [...list].sort((a, b) => {
      // rankLevel desc if available, else rankTitle desc
      const aRankLevel = (a as any).rankLevel ?? null;
      const bRankLevel = (b as any).rankLevel ?? null;
      if (aRankLevel !== null && bRankLevel !== null) {
        const rankCmp = (bRankLevel as number) - (aRankLevel as number);
        if (rankCmp !== 0) return rankCmp;
      } else {
        const rank = this.getRankName(b).localeCompare(
          this.getRankName(a),
          'vi',
        );
        if (rank !== 0) return rank;
      }
      const pos = posKey(a.positionTitle || '') - posKey(b.positionTitle || '');
      if (pos !== 0) return pos;
      return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
    });
  }

  private buildFlatResults(q: string) {
    // Strictly use scoped personnel list to avoid leaking outside scope
    const scopeList: PersonnelDto[] =
      this.personnelStore.getScopePersonnel?.() ?? [];
    console.log(
      '[Travel] buildFlatResults q=',
      q,
      'activeScope=',
      this.activeScope()?.orgId,
      'scopeList.len=',
      Array.isArray(scopeList) ? scopeList.length : 'n/a',
    );
    if (!Array.isArray(scopeList) || scopeList.length === 0) {
      const orgCode = this.activeScope()?.orgId || '';
      this.personnelStore
        .preloadScopePersonnel('unit', orgCode)
        .subscribe((list) => {
          console.log(
            '[Travel] preloadScopePersonnel done',
            { scopeKey: 'unit', orgCode },
            'len=',
            Array.isArray(list) ? list.length : 'n/a',
          );
          const filteredLater = (list || []).filter((p) =>
            this.matchesQuery(p, q),
          );
          const withFlagLater = this.markLeadersByUnit(filteredLater);
          const leadersLater = withFlagLater.filter(
            (p: any) => p.isLeader === true,
          );
          const staffOnlyLater = withFlagLater.filter(
            (p: any) => p.isLeader !== true,
          );
          console.log(
            '[Travel] results leaders=',
            leadersLater.length,
            'staff=',
            staffOnlyLater.length,
          );
          this.leadersResults.set(this.sortLeaders(leadersLater).slice(0, 20));
          this.staffResults.set(this.sortStaff(staffOnlyLater).slice(0, 30));
        });
      this.leadersResults.set([]);
      this.staffResults.set([]);
      return;
    }
    const filtered = scopeList.filter((p) => this.matchesQuery(p, q));
    const withLeaderFlag = this.markLeadersByUnit(filtered);

    // Split: leaders have isLeader=true (server flag), staff have isLeader=false/undefined
    const leaders = withLeaderFlag.filter((p: any) => p.isLeader === true);
    const staffOnly = withLeaderFlag.filter((p: any) => p.isLeader !== true);
    console.log(
      '[Travel] results leaders=',
      leaders.length,
      'staff=',
      staffOnly.length,
    );

    this.leadersResults.set(this.sortLeaders(leaders).slice(0, 20));
    this.staffResults.set(this.sortStaff(staffOnly).slice(0, 30));
  }

  // Determine leaders: trust server's isLeader flag directly
  private markLeadersByUnit(list: PersonnelDto[]): PersonnelDto[] {
    // Simply preserve server's isLeader flag; do NOT calculate from cLevel
    return list.map(
      (p) =>
        ({
          ...(p as any),
          isLeader: (p as any).isLeader === true,
        }) as PersonnelDto,
    );
  }

  private checkEditMode() {
    this.route.params.subscribe((params) => {
      if (params['orderId']) {
        this.editingOrderId = parseInt(params['orderId'], 10);
        this.editingTripId = null;
        this.canTakeNumberOnForm.set(false);
        this.loadOrderForEdit(this.editingOrderId);
        return;
      }

      this.editingOrderId = null;
      this.orderDetail.set(null);
      this.orderView.set(null);
      this.setOrderModeFieldState(false);
      if (params['tripId'] || params['id']) {
        this.editingTripId = parseInt(params['tripId'] ?? params['id'], 10);
        this.canTakeNumberOnForm.set(false);
        this.loadTripForEdit(this.editingTripId);
      }
    });
  }

  private checkCopyMode() {
    this.route.queryParamMap.subscribe((query) => {
      const sourceId = Number(query.get('copyFrom'));
      this.copyingOrderId =
        !this.editingOrderId && !this.editingTripId &&
        Number.isSafeInteger(sourceId) && sourceId > 0 ? sourceId : null;
      if (!this.copyingOrderId) return;
      this.api.getOrderDetail(this.copyingOrderId).subscribe({
        next: (order) => this.patchOrderForm(order, order.itinerary || []),
        error: (err) => this.errorMsg.set(
          'Không tải được giấy nguồn để sao chép: ' +
          (err?.error?.error || err?.message || 'Lỗi không xác định'),
        ),
      });
    });
  }

  private loadOrderForEdit(orderId: number) {
    this.errorMsg.set('');
    this.api.getOrderDetail(orderId).subscribe({
      next: (order) => {
        this.orderDetail.set(order);
        this.orderView.set(this.mapOrderDetailToView(order));
        this.patchOrderForm(order, order.itinerary || []);
        this.api.getTrip(order.tripId).subscribe({ next: trip => this.canTakeNumberOnForm.set(trip.canTakeNumber), error: () => this.canTakeNumberOnForm.set(false) });
      },
      error: (err) => {
        if (err?.status === 404) {
          this.loadLegacyOrderForEdit(orderId);
          return;
        }

        this.errorMsg.set(
          'Không tải được dữ liệu giấy đi đường: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  private loadLegacyOrderForEdit(orderId: number) {
    this.api.getOrderView(orderId).subscribe({
      next: (order) => {
        this.orderDetail.set(null);
        this.orderView.set(order);
        this.canTakeNumberOnForm.set(false);
        this.patchOrderForm(order, order.stopsMerged || []);
      },
      error: (err) => {
        this.errorMsg.set(
          'Không tải được dữ liệu giấy đi đường: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  private patchOrderForm(
    order: TravelOrderDetailDto | TravelOrderViewDto,
    stops: Array<{
      stopIndex?: number;
      fromLocation?: string;
      fromDateTime?: string;
      toLocation?: string;
      toDateTime?: string;
      transport?: string;
    }>,
  ) {
    this.tripForm.patchValue({
      missionNo: order.missionNo || null,
      missionDate: this.toCalendarDate(order.missionDate),
      fromDate: this.toCalendarDate(order.fromDate),
      toDate: this.toCalendarDate(order.toDate),
    });

    this.patchPersonsFromDto([
      {
        ...order,
        username:
          (order as TravelOrderDetailDto).personCode ||
          (order as any).username ||
          '',
        personId: (order as TravelOrderDetailDto).personId || '',
        personCode: (order as TravelOrderDetailDto).personCode || '',
        unitCode: order.unitCode || '',
        orgCode: order.unitCode || '',
      },
    ]);
    this.patchStopsFromDto(stops);
    this.setOrderModeFieldState(false);
    this.resetSearchState();

    if (order.signerName) {
      this.selectedSigner.set({
        username: '',
        fullName: order.signerName,
        rankName: undefined,
        rankTitle: undefined,
        displayNameWithRank: [order.signerName]
          .filter(Boolean)
          .join(' '),
        positionTitle: order.signerPositionTitle || order.signerTitle,
        unitName: order.signerUnitName,
        isLeader: true,
      });
    } else {
      this.selectedSigner.set(null);
    }

    queueMicrotask(() => {
      const person = this.getSelectedPersonnelForPreview()[0];
      if (!person) {
        return;
      }

      this.activePersonId.set(this.getPersonKey(person, 0));
      if (this.selectedSigner()) {
        this.setSignerForPerson(person, this.selectedSigner(), 0);
      }
      this.rebuildPersonUiState();
      this.triggerPreview('order-edit-load');
    });
  }

  private mapOrderDetailToView(
    order: TravelOrderDetailDto,
  ): TravelOrderViewDto {
    return {
      id: order.id,
      orderNo: order.orderNo,
      fullName: order.fullName,
      displayNameWithRank: order.displayNameWithRank,
      rankId: order.rankId,
      rankCode: order.rankCode,
      rankName: order.rankName,
      positionTitle: order.positionTitle,
      rankTitle: order.rankTitle,
      unitName: order.unitName,
      unitCode: order.unitCode,
      missionNo: order.missionNo,
      missionDate: order.missionDate,
      purpose: order.purpose,
      fromDate: order.fromDate,
      toDate: order.toDate,
      departureDate: order.departureDate,
      signerName: order.signerName,
      signerTitle: order.signerTitle,
      signerUnitName: order.signerUnitName,
      signedAt: order.signedAt,
      status: order.status,
      stopsMerged: (order.itinerary || []).map((stop) => ({
        stopIndex: stop.stopIndex,
        fromLocation: stop.fromLocation,
        fromDateTime: stop.fromDateTime,
        toLocation: stop.toLocation,
        toDateTime: stop.toDateTime,
        transport: stop.transport,
      })),
    };
  }

  private setOrderModeFieldState(readonly: boolean) {
    for (const controlName of [
      'missionNo',
      'missionDate',
      'fromDate',
      'toDate',
    ]) {
      const control = this.tripForm.get(controlName);
      if (!control) {
        continue;
      }

      if (readonly) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
  }

  private loadTripForEdit(tripId: number) {
    this.api.getTrip(tripId).subscribe({
      next: (trip) => {
        this.patchTripForm(trip);
        this.canTakeNumberOnForm.set(trip.canTakeNumber);
        this.resetSearchState();
      },
      error: () => {
        this.errorMsg.set('Không tải được dữ liệu bộ giấy');
      },
    });
  }

  private patchTripForm(trip: TravelTripDetailDto) {
    this.tripForm.patchValue({
      missionNo: trip.missionNo,
      missionDate: this.toCalendarDate(trip.missionDate),
      fromDate: this.toCalendarDate(trip.fromDate),
      toDate: this.toCalendarDate(trip.toDate),
    });

    this.patchPersonsFromDto(trip.orders || []);
    this.patchStopsFromDto(trip.stops || []);

    if (trip.signerName) {
      this.selectedSigner.set({
        username: '',
        fullName: trip.signerName,
        rankName: trip.signerTitle,
        rankTitle: trip.signerTitle,
        displayNameWithRank: [trip.signerTitle, trip.signerName]
          .filter(Boolean)
          .join(' '),
        positionTitle: '',
        unitName: trip.signerUnitName,
        isLeader: true,
      });
      this.rebuildPersonUiState();
    }
  }

  private patchPersonsFromDto(orders: any[]) {
    const personsCtrl = this.tripForm.get('persons') as FormArray;
    personsCtrl.clear();
    for (const order of orders) {
      personsCtrl.push(
        this.fb.group({
          orderId: [order.id || null],
          fullName: [order.fullName],
          rankName: [order.rankName || order.rankTitle || ''],
          rankTitle: [order.rankTitle || order.rankName || ''],
          displayNameWithRank: [
            order.displayNameWithRank ||
              [order.rankName || order.rankTitle, order.fullName]
                .filter(Boolean)
                .join(' '),
          ],
          positionTitle: [order.positionTitle || ''],
          unitName: [order.unitName],
          username: [order.username || order.personCode || ''],
          personId: [order.personId || order.username || order.personCode || ''],
          personCode: [order.personCode || order.username || ''],
          unitCode: [order.unitCode || order.orgCode || ''],
          orgCode: [order.orgCode || order.unitCode || ''],
          isLeader: [order.isLeader === true],
          cLevel: [(order as any)?.cLevel ?? null],
        }),
      );
    }
    this.rebuildPersonUiState();
    this.preloadApproversForSelectedPersons();
  }

  private patchStopsFromDto(stops: any[]) {
    const stopsCtrl = this.tripForm.get('stops') as FormArray;
    stopsCtrl.clear();
    if (stops.length === 0) {
      stopsCtrl.push(this.createStopForm());
    } else {
      for (const stop of stops) {
        stopsCtrl.push(
          this.fb.group({
            fromLocation: [stop.fromLocation || ''],
            fromDateTime: [stop.fromDateTime || null],
            toLocation: [stop.toLocation || ''],
            toDateTime: [stop.toDateTime || null],
            transport: [stop.transport || ''],
          }),
        );
      }
    }
  }

  private resetSearchState() {
    this.signerSearchCtrl.reset('');
    this.personnelSearchCtrl.reset('');
    this.signerSearchQuery.set('');
    this.approverQuery.set('');
    this.personnelSearchQuery.set('');
    this.showStaffDropdown.set(false);
    this.highlightedStaffIndex.set(-1);
    this.hasPersonnelInteracted.set(false);
    this.suppressOpenOnce.set(false);
  }

  onScopeChange(scope: ScopeRef | null) {
    this.activeScope.set(scope);
    this.resetSearchState();
    this.clearApproverPoolCache();
    console.log('[Travel] scope change', { scope });
    console.log('[Scope] RAW scope data:', JSON.stringify(scope));
    if (scope) {
      // Set BOTH scopeKey and orgCode with includeChildren, then reload personnel
      try {
        const includeChildren = scope.includeChildren ?? false;
        console.log('[Travel] set scope for personnelStore', {
          scopeKey: 'unit',
          orgCode: scope.orgId,
          includeChildren,
        });
        this.personnelStore
          .setScope('unit', scope.orgId, includeChildren)
          .subscribe((list) => {
            console.log('[PersonnelStore] scopePersonnel loaded', {
              orgCode: scope.orgId,
              includeChildren,
              count: Array.isArray(list) ? list.length : 0,
            });
            // If user already has a query, rebuild results after store loads
            const q = this.personnelSearchQuery().trim();
            if (q.length >= 1) {
              this.buildFlatResults(q);
              this.showStaffDropdown.set(true);
            }
          });
      } catch {}
      // Clear query + results + dropdown open state and log
      this.personnelSearchCtrl.setValue('', { emitEvent: false });
      this.personnelSearchQuery.set('');
      this.leadersResults.set([]);
      this.staffResults.set([]);
      this.showStaffDropdown.set(false);
      this.highlightedStaffIndex.set(-1);
      this.staffTreeService
        .loadForScope(scope.orgId, scope.includeChildren || false)
        .subscribe({
          next: () => {
            const scopeList: any[] =
              (this.personnelStore as any).scopePersonnel?.() ?? [];
            console.log(
              '[Travel] staffTree loaded, scopePersonnel=',
              Array.isArray(scopeList) ? scopeList.length : 0,
            );
          },
          error: () => {
            this.errorMsg.set('Không thể tải danh sách cán bộ');
          },
        });
    }
  }

  onPersonnelSelected(person: PersonnelDto) {
    const personsCtrl = this.tripForm.get('persons') as FormArray;
    console.log('[select]', person);
    console.log('[before]', personsCtrl.length, personsCtrl.value);

    const exists = personsCtrl.controls.some((ctrl) => {
      const v = ctrl.value;
      return v.username && v.username === person.username;
    });
    if (exists) {
      this.errorMsg.set('Cán bộ này đã được thêm');
      return;
    }
    personsCtrl.push(
      this.fb.group({
        fullName: [person.fullName],
        rankName: [person.rankName || person.rankTitle || ''],
        rankTitle: [person.rankTitle || person.rankName || ''],
        displayNameWithRank: [this.getDisplayNameWithRank(person)],
        positionTitle: [person.positionTitle || ''],
        unitName: [person.unitName],
        username: [person.username],
        personId: [person.username || ''],
        personCode: [person.username || ''],
        unitCode: [person.orgCode || ''],
        orgCode: [person.orgCode || ''],
        isLeader: [person.isLeader === true],
        cLevel: [(person as any)?.cLevel ?? null],
      }),
    );
    this.rebuildPersonUiState();
    this.preloadApproversForPerson(person);
    this.setActivePersonByValue(person, personsCtrl.length - 1);

    // Close dropdown & clear search query/results
    this.closeStaffDropdown();
    this.personnelSearchCtrl.setValue('', { emitEvent: false });
    this.personnelSearchQuery.set('');
    this.leadersResults.set([]);
    this.staffResults.set([]);
    this.highlightedStaffIndex.set(-1);

    // Focus back to input for quick next entry
    queueMicrotask(() => this.personnelInputRef?.nativeElement?.focus());

    console.log('[after]', personsCtrl.length, personsCtrl.value);
    console.log('[Preview] personnel selected count=', personsCtrl.length);

    // Force sync + trigger after state commit (avoid stale reads)
    personsCtrl.updateValueAndValidity({ emitEvent: false });
    queueMicrotask(() => this.triggerPreview('person-selected'));
  }

  removePersonnel(ctrl: AbstractControl) {
    const personsCtrl = this.tripForm.get('persons') as FormArray;
    const idx = personsCtrl.controls.indexOf(ctrl);
    if (idx >= 0) {
      personsCtrl.removeAt(idx);
      this.rebuildPersonUiState();

      personsCtrl.updateValueAndValidity({ emitEvent: false });

      // Trigger preview refresh
      queueMicrotask(() => this.triggerPreview('person-removed'));
    }
  }

  removeSelected(ctrl: AbstractControl) {
    if (this.isOrderEditMode()) {
      return;
    }
    this.removePersonnel(ctrl);
  }

  addStop() {
    const stopsCtrl = this.tripForm.get('stops') as FormArray;
    stopsCtrl.push(this.createStopForm());
  }

  removeStop(index: number) {
    const stopsCtrl = this.tripForm.get('stops') as FormArray;
    stopsCtrl.removeAt(index);
  }

  selectSigner(leader: PersonnelDto) {
    const activePerson = this.getActivePersonForUi();
    if (activePerson) {
      this.setSignerForPerson(activePerson, leader);
    }
    this.selectedSigner.set(leader);
    this.approverQuery.set('');
    this.showLeaderDropdown.set(false);
    // Trigger preview on signer change
    this.triggerPreview('approver-selected');
  }

  onLeaderSelected(leader: PersonnelDto) {
    console.log('[Approver] selected', leader);
    this.selectSigner(leader);
  }

  startChangeApprover() {
    this.selectedSigner.set(null);
    this.approverQuery.set('');
    this.showLeaderDropdown.set(true);
    this.scheduleApproverDropdownPositionUpdate();
    this.triggerPreview('approver-cleared');
  }

  clearSelectedApprover() {
    const activePerson = this.getActivePersonForUi();
    if (activePerson) {
      this.setSignerForPerson(activePerson, null);
    }
    this.selectedSigner.set(this.getPrimarySigner());
    this.triggerPreview('approver-cleared');
  }

  clearSigner() {
    this.clearSelectedApprover();
  }

  onBulkSignerSelected(username: string): void {
    this.bulkSignerUsername.set((username || '').trim());
  }

  getBulkSignerSelected(): PersonnelDto | null {
    const username = this.bulkSignerUsername();
    return this.getSignerOptions().find((x) => x.username === username) || null;
  }

  toggleBulkSignerDropdown(): void {
    if (this.showLeaderDropdown()) {
      this.closeLeaderDropdown();
      return;
    }
    this.openLeaderDropdown();
  }

  onBulkApproverInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.approverQuery.set(value);
    this.filterLeaderResults(value);
  }

  clearBulkApproverQuery(): void {
    this.approverQuery.set('');
    this.filterLeaderResults('');
  }

  onBulkApproverKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (key === 'Escape') {
      event.preventDefault();
      this.closeLeaderDropdown();
      return;
    }

    if (!this.showLeaderDropdown()) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') {
        event.preventDefault();
        this.openLeaderDropdown();
      }
      return;
    }

    const total = this.leaderDropdownResults().length;
    if (total === 0) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      const current = this.highlightedLeaderIndex();
      this.highlightedLeaderIndex.set(current < 0 ? 0 : (current + 1) % total);
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      const current = this.highlightedLeaderIndex();
      this.highlightedLeaderIndex.set(
        current < 0 ? total - 1 : (current - 1 + total) % total,
      );
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      const current = this.highlightedLeaderIndex();
      const index = current >= 0 && current < total ? current : 0;
      const item = this.leaderDropdownResults()[index];
      if (item) {
        this.selectBulkApprover(item);
      }
    }
  }

  selectBulkApprover(leader: PersonnelDto): void {
    this.onBulkSignerSelected(leader.username || '');
    this.approverQuery.set('');
    this.closeLeaderDropdown();
  }

  isBulkApproverSelected(leader: PersonnelDto): boolean {
    return !!leader?.username && this.bulkSignerUsername() === leader.username;
  }

  isHighlightedLeader(index: number): boolean {
    return this.highlightedLeaderIndex() === index;
  }

  setHighlightedLeaderIndex(index: number): void {
    this.highlightedLeaderIndex.set(index);
  }

  getLeaderDropdownSameUnitOptions(): PersonnelDto[] {
    const activePerson = this.getActivePersonForUi();
    if (!activePerson) {
      return this.leaderDropdownResults();
    }
    return this.leaderDropdownResults().filter((x) =>
      this.isSameUnitApprover(x, activePerson),
    );
  }

  getLeaderDropdownUpperUnitOptions(): PersonnelDto[] {
    const activePerson = this.getActivePersonForUi();
    if (!activePerson) {
      return [];
    }
    return this.leaderDropdownResults().filter(
      (x) =>
        !this.isSameUnitApprover(x, activePerson) &&
        this.isInApproverChain(x, activePerson),
    );
  }

  getUpperLeaderGlobalIndex(localIndex: number): number {
    return this.getLeaderDropdownSameUnitOptions().length + localIndex;
  }

  getSignerOptionsForCard(
    ctrl: AbstractControl,
    fallbackIndex: number,
  ): PersonnelDto[] {
    return this.getSignerOptionsForPerson(ctrl?.value, fallbackIndex);
  }

  getApproverScopeLabel(
    leader: PersonnelDto | null | undefined,
    person: any,
    fallbackIndex = 0,
  ): string {
    if (!leader || !person) {
      return '';
    }

    return this.isSameUnitApprover(leader, person, fallbackIndex)
      ? 'Cùng đơn vị'
      : 'Cấp trên';
  }

  onBulkScopeSelected(scope: 'all' | 'active' | 'leaders' | 'staff'): void {
    this.bulkApplyScope.set(scope);
  }

  canApplyBulkSigner(): boolean {
    return !!this.bulkSignerUsername() && this.personsFA.length > 0;
  }

  getBulkScopeTargetCount(): number {
    const persons = this.getSelectedPersonnelForPreview();
    if (persons.length === 0) {
      return 0;
    }

    const scope = this.bulkApplyScope();
    if (scope === 'all') {
      return persons.length;
    }
    if (scope === 'leaders') {
      return persons.filter((p: any) => p?.isLeader === true).length;
    }
    if (scope === 'staff') {
      return persons.filter((p: any) => p?.isLeader !== true).length;
    }

    return this.getActivePersonForUi() ? 1 : 0;
  }

  applySignerBulk(): void {
    const username = this.bulkSignerUsername();
    const signer = this.getSignerOptions().find((x) => x.username === username);
    if (!signer) {
      this.errorMsg.set('Vui lòng chọn người duyệt để áp dụng');
      return;
    }

    const persons = this.getSelectedPersonnelForPreview();
    if (persons.length === 0) {
      this.errorMsg.set('Chưa có cán bộ để áp dụng người duyệt');
      return;
    }

    const scope = this.bulkApplyScope();
    const targets = persons
      .map((person, index) => ({ person, index }))
      .filter(({ person, index }) => {
        if (scope === 'all') {
          return true;
        }
        if (scope === 'leaders') {
          return person?.isLeader === true;
        }
        if (scope === 'staff') {
          return person?.isLeader !== true;
        }

        return (
          this.activePersonId() === this.getPersonKey(person, index) ||
          (!this.activePersonId() && index === 0)
        );
      });

    if (targets.length === 0) {
      this.errorMsg.set('Không có cán bộ phù hợp với phạm vi áp dụng đã chọn');
      return;
    }

    targets.forEach(({ person, index }) => {
      this.setSignerForPerson(person, signer, index);
    });

    this.errorMsg.set('');
    this.syncSelectedSignerFromActivePerson();
    this.triggerPreview('bulk-approver-applied');
  }

  onApproverInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.approverQuery.set(value);
    this.signerSearchQuery.set(value);
    this.showLeaderDropdown.set(true);
    console.log('[Approver] input=', value);
    this.filterLeaderResults(value);
  }

  clearApproverInput(): void {
    this.approverQuery.set('');
    this.signerSearchQuery.set('');
    this.leaderDropdownResults.set([]);
    this.highlightedLeaderIndex.set(-1);
    this.showLeaderDropdown.set(false);
    this.approverDropdownPlacement.set('bottom');
    this.approverDropdownMaxHeight.set(280);
  }

  openLeaderDropdown(): void {
    this.filterLeaderResults(this.approverQuery());
    if (this.leaderDropdownResults().length > 0) {
      const selectedIdx = this.leaderDropdownResults().findIndex(
        (x) => x.username === this.bulkSignerUsername(),
      );
      this.highlightedLeaderIndex.set(selectedIdx >= 0 ? selectedIdx : 0);
    } else {
      this.highlightedLeaderIndex.set(-1);
    }
    this.showLeaderDropdown.set(true);
    this.scheduleApproverDropdownPositionUpdate();
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        this.bulkApproverSearchInput?.nativeElement.focus({ preventScroll: true });
      });
    });
  }

  closeLeaderDropdown(): void {
    this.showLeaderDropdown.set(false);
    this.highlightedLeaderIndex.set(-1);
    this.approverDropdownPlacement.set('bottom');
  }

  clearLeaderSearch(): void {
    this.clearApproverInput();
  }

  filterLeaderResults(query: string): void {
    const q = (query || '').trim();

    // Use leaders derived from scoped personnel
    const pool = this.getSignerOptions();
    console.log(
      '[Approver] Filtering query="' + q + '", pool size=',
      pool.length,
    );

    if (pool.length === 0) {
      console.warn('[Approver] Pool is empty - no data to filter');
      this.leaderDropdownResults.set([]);
      this.highlightedLeaderIndex.set(-1);
      return;
    }

    const filtered = q
      ? pool.filter((p: any) => this.matchesQuery(p, q))
      : pool;
    const next = this.sortLeaders(filtered).slice(0, 50);
    this.leaderDropdownResults.set(next);

    if (next.length > 0) {
      const selectedIdx = next.findIndex(
        (x) => x.username === this.bulkSignerUsername(),
      );
      this.highlightedLeaderIndex.set(selectedIdx >= 0 ? selectedIdx : 0);
    } else {
      this.highlightedLeaderIndex.set(-1);
    }

    if (this.showLeaderDropdown()) {
      this.scheduleApproverDropdownPositionUpdate();
    }
  }

  onFormColumnScroll(): void {
    if (this.showLeaderDropdown()) {
      this.scheduleApproverDropdownPositionUpdate();
    }
  }

  private scheduleApproverDropdownPositionUpdate(): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => this.updateApproverDropdownPosition());
    });
  }

  private updateApproverDropdownPosition(): void {
    const wrapper = this.approverDropdownWrapper?.nativeElement;
    if (!wrapper || !this.showLeaderDropdown()) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const margin = 12;
    const preferredHeight = 280;
    const minimumHeight = 140;
    const availableBelow = Math.max(0, viewportHeight - rect.bottom - margin);
    const availableAbove = Math.max(0, rect.top - margin);

    const placement =
      availableBelow >= minimumHeight || availableBelow >= availableAbove
        ? 'bottom'
        : 'top';
    const preferredSpace =
      placement === 'bottom' ? availableBelow : availableAbove;
    const fallbackSpace =
      placement === 'bottom' ? availableAbove : availableBelow;
    const maxHeight = Math.max(
      minimumHeight,
      Math.min(preferredHeight, Math.max(preferredSpace, fallbackSpace)),
    );

    this.approverDropdownPlacement.set(placement);
    this.approverDropdownMaxHeight.set(maxHeight);
  }

  private loadApproverPool(orgCode: string): void {
    // Deprecated: approver pool now derived from scoped personnel
    console.log(
      '[Approver] loadApproverPool skipped (using leadersPool from scopePersonnel)',
    );
  }

  private searchSignersWide() {
    // Deprecated: no longer used. Leader search now uses filterLeaderResults().
  }

  // AutoComplete methods for PrimeNG (deprecated: kept for compatibility)
  searchNguoiDuyet(event: any) {
    // Deprecated: replaced by filterLeaderResults() in dropdown handler
  }

  // New method for staff selection from dropdown
  onSelectStaff(person: SimpleUser): void {
    const personnel: PersonnelDto = {
      username: person.username || person.displayName || '',
      fullName: person.displayName || '',
      rankTitle: '',
      positionTitle: person.positionName || '',
      unitName: person.orgUnitName || '',
      isLeader: !!person.isLeader,
    };

    // Close dropdown first
    this.closeStaffDropdown();

    // Set flag to suppress next valueChanges auto-open
    this.suppressOpenOnce.set(true);

    // Add to form array
    this.onPersonnelSelected(personnel);

    // Clear search without triggering valueChanges and suppress reopen briefly
    this.personnelSearchCtrl.setValue('', { emitEvent: false });
    this.suppressOpenUntil.set(Date.now() + 200);

    // Blur input and reset flag in next microtask
    queueMicrotask(() => {
      this.personnelInputRef?.nativeElement?.blur();
      this.suppressOpenOnce.set(false);
    });
  }

  // Open dropdown when input is focused
  onPersonnelInputFocus(): void {
    // Skip if suppressOpenOnce is set (prevent re-open after select)
    if (this.suppressOpenOnce()) {
      return;
    }
    this.hasPersonnelInteracted.set(true);
    // Only open when query non-empty
    const q = this.personnelSearchQuery().trim();
    if (q.length >= 1) {
      this.buildFlatResults(q);
      this.resetHighlightedStaffForCurrentResults();
      this.showStaffDropdown.set(true);
    } else {
      this.showStaffDropdown.set(false);
      this.highlightedStaffIndex.set(-1);
    }
  }

  onPersonnelInputKeydown(event: KeyboardEvent): void {
    const key = event.key;
    const dropdownOpen = this.showStaffDropdown();

    if (key === 'Escape') {
      event.preventDefault();
      this.closeStaffDropdown();
      return;
    }

    if (!dropdownOpen) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      this.moveHighlightedStaff(1);
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      this.moveHighlightedStaff(-1);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      this.selectHighlightedStaff();
    }
  }

  setHighlightedStaffIndex(index: number): void {
    this.highlightedStaffIndex.set(index);
  }

  isHighlightedStaff(index: number): boolean {
    return this.highlightedStaffIndex() === index;
  }

  getStaffResultGlobalIndex(indexInStaffGroup: number): number {
    return this.leadersResults().length + indexInStaffGroup;
  }

  // Close dropdown
  closeStaffDropdown(): void {
    this.showStaffDropdown.set(false);
    this.highlightedStaffIndex.set(-1);
  }

  private getFlatPersonnelResults(): PersonnelDto[] {
    return [...this.leadersResults(), ...this.staffResults()];
  }

  private resetHighlightedStaffForCurrentResults(): void {
    const total = this.getFlatPersonnelResults().length;
    this.highlightedStaffIndex.set(total > 0 ? 0 : -1);
  }

  private moveHighlightedStaff(delta: number): void {
    const total = this.getFlatPersonnelResults().length;
    if (total === 0) {
      this.highlightedStaffIndex.set(-1);
      return;
    }
    const current = this.highlightedStaffIndex();
    if (current < 0) {
      this.highlightedStaffIndex.set(0);
      return;
    }
    const next = (current + delta + total) % total;
    this.highlightedStaffIndex.set(next);
  }

  private selectHighlightedStaff(): void {
    const list = this.getFlatPersonnelResults();
    if (list.length === 0) {
      return;
    }
    const idx = this.highlightedStaffIndex();
    const safeIndex = idx >= 0 && idx < list.length ? idx : 0;
    this.onPersonnelSelected(list[safeIndex]);
  }

  // Removed old searchCanBo method - replaced by staff tree dropdown

  isFormValid(): boolean {
    if (this.isOrderEditMode()) {
      return this.personsArray.length === 1 && this.tripForm.valid;
    }

    const hasPrimarySigner = this.getPrimarySigner() !== null;
    return hasPrimarySigner && this.personsArray.length > 0 && this.tripForm.valid;
  }

  /**
   * Builds request DTO for single-order creation
   */
  private buildSingleOrderRequest(
    formValue: any,
  ): CreateSingleTravelOrderRequestDto {
    const person = formValue.persons[0];
    const signer =
      this.resolveSignerForPerson(person, 0) || this.getPrimarySigner();
    return {
      personId: person.personId || person.username || undefined,
      personCode: person.personCode || person.username || undefined,
      fullName: person.fullName,
      positionTitle: person.positionTitle || undefined,
      rankTitle: person.rankTitle || undefined,
      unitName: person.unitName,
      unitCode: person.unitCode || person.orgCode || undefined,
      missionNo: formValue.missionNo || undefined,
      missionDate: formValue.missionDate || undefined,
      fromDate: formValue.fromDate || undefined,
      toDate: formValue.toDate || undefined,
      signerName: signer?.fullName || '',
      signerTitle: signer?.positionTitle || undefined,
      signerUnitName: signer?.unitName || undefined,
      itinerary: (formValue.stops || [])
        .map((stop: any, index: number) => ({ ...stop, stopIndex: index }))
        .filter(
          (stop: any) =>
            stop.fromLocation ||
            stop.fromDateTime ||
            stop.toLocation ||
            stop.toDateTime ||
            stop.transport,
        ),
    };
  }

  /**
   * Submits single-order creation request and handles response
   */
  private submitSingleOrder(request: CreateSingleTravelOrderRequestDto): void {
    this.api.createSingleOrder(request).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.navigateAfterSave(created.tripId);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMsg.set(
          'Tạo giấy đi đường thất bại: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  /**
   * Builds batch trip request for 2+ persons
   * Maps form data to CreateTravelTripRequest with per-person overrides
   */
  private buildBatchRequest(formValue: any): CreateTravelTripRequest {
    const stops: any[] = (formValue.stops || [])
      .map((stop: any, index: number) => ({
        stopIndex: index,
        fromLocation: stop.fromLocation || '',
        fromDateTime: stop.fromDateTime || null,
        toLocation: stop.toLocation || '',
        toDateTime: stop.toDateTime || null,
        transport: stop.transport || '',
      }))
      .filter(
        (s: any) =>
          s.fromLocation ||
          s.fromDateTime ||
          s.toLocation ||
          s.toDateTime ||
          s.transport,
      );

    const defaultSigner = this.getPrimarySigner();
    const overrides = this.batchPersonOverrides();

    const persons: any[] = formValue.persons.map(
      (person: any, index: number) => {
        const orderNo = (index + 1).toString();
        const personOverride = overrides.get(index);
        const personSigner = this.resolveSignerForPerson(person, index);

        // Use per-person override if available, else use default
        const signerName =
          personOverride?.signerName ||
          personSigner?.fullName ||
          defaultSigner?.fullName;
        const signerTitle =
          personOverride?.signerTitle ||
          personSigner?.positionTitle ||
          defaultSigner?.positionTitle;
        const signerUnitName =
          personOverride?.signerUnitName ||
          personSigner?.unitName ||
          defaultSigner?.unitName;
        const missionNo = personOverride?.missionNo || formValue.missionNo;
        const missionDate =
          personOverride?.missionDate || formValue.missionDate;
        const fromDate = personOverride?.fromDate || formValue.fromDate;
        const toDate = personOverride?.toDate || formValue.toDate;

        return {
          orderNo,
          personId: person.personId || person.username || undefined,
          personCode: person.personCode || person.username || undefined,
          fullName: person.fullName,
          positionTitle: person.positionTitle || undefined,
          rankTitle: person.rankTitle || undefined,
          unitName: person.unitName,
          unitCode: person.unitCode || person.orgCode || undefined,
          missionNoOverride: missionNo || undefined,
          missionDateOverride: missionDate || undefined,
          fromDateOverride: fromDate || undefined,
          toDateOverride: toDate || undefined,
          departureDateOverride: undefined,
          stopOverrides: [], // Can be enhanced in future
        };
      },
    );

    return {
      tripNo: '', // Backend auto-generates
      missionNo: formValue.missionNo || undefined,
      missionDate: formValue.missionDate || undefined,
      purpose: undefined,
      fromDate: formValue.fromDate || undefined,
      toDate: formValue.toDate || undefined,
      departureDate: undefined,
      signerName: defaultSigner?.fullName,
      signerTitle: defaultSigner?.positionTitle || undefined,
      signerUnitName: defaultSigner?.unitName || undefined,
      signedAt: undefined,
      stops,
      persons,
    };
  }

  /**
   * Submits batch trip creation request and handles response
   */
  private submitBatchTrip(request: CreateTravelTripRequest): void {
    this.api.createTrip(request).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.navigateAfterSave(created.tripId);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMsg.set(
          'Tạo bộ giấy đi đường thất bại: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  onSaveDraft() {
    if (this.isOrderEditMode()) {
      this.errorMsg.set('Chế độ sửa giấy không hỗ trợ lưu nháp');
      return;
    }

    this.errorMsg.set('Chức năng lưu nháp chưa được triển khai');
  }

  onCancel() {
    if (this.isOrderEditMode()) {
      const tripId = this.orderDetail()?.tripId;
      if (tripId) {
        this.router.navigate(['/travel/trips', tripId]);
        return;
      }
    }

    this.router.navigate(['/travel/trips']);
  }

  getPageTitle(): string {
    if (this.isOrderEditMode()) {
      return 'Chỉnh sửa giấy đi đường';
    }

    if (this.isEditMode()) {
      return 'Chỉnh sửa bộ giấy đi đường';
    }

    return this.copyingOrderId ? 'Sao chép giấy đi đường' : 'Tạo giấy đi đường';
  }

  getSubmitButtonLabel(): string {
    return this.isSubmitting() ? 'Đang lưu...' : 'Lấy số và in';
  }

  private navigateAfterSave(tripId: number): void {
    this.router.navigate(['/travel'], this.issueAndPrintAfterSave ? { queryParams: { issueAndPrintTrip: tripId } } : undefined);
  }

  scrollToPersonnelSection() {
    this.personnelSection?.nativeElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  buildPreviewModel(person: any, index: number): TravelOrderPreviewModel {
    return {
      orderNo: `ORD-${index + 1}`,
      fullName: person.fullName,
      displayNameWithRank:
        person.displayNameWithRank ||
        [person.rankName || person.rankTitle, person.fullName]
          .filter(Boolean)
          .join(' '),
      rankId: person.rankId,
      rankCode: person.rankCode,
      rankName: person.rankName || person.rankTitle,
      rankTitle: person.rankTitle,
      positionTitle: person.positionTitle,
      unitName: person.unitName,
    } as TravelOrderPreviewModel;
  }

  /**
   * Toggle person override panel (batch mode)
   */
  togglePersonOverride(personIndex: number): void {
    this.expandedPersonIndex.set(
      this.expandedPersonIndex() === personIndex ? null : personIndex,
    );
  }

  /**
   * Get or create override state for a person
   */
  getPersonOverride(personIndex: number): PersonOverrideState {
    const overrides = this.batchPersonOverrides();
    if (!overrides.has(personIndex)) {
      overrides.set(personIndex, {});
    }
    return overrides.get(personIndex)!;
  }

  /**
   * Update specific override field for a person
   */
  updatePersonOverride(
    personIndex: number,
    field: keyof PersonOverrideState,
    value: any,
  ): void {
    const overrides = new Map(this.batchPersonOverrides());
    const state = overrides.get(personIndex) || {};
    (state as any)[field] = value;
    overrides.set(personIndex, state);
    this.batchPersonOverrides.set(overrides);
  }

  /**
   * Check if person has any overrides
   */
  personHasOverrides(personIndex: number): boolean {
    const override = this.getPersonOverride(personIndex);
    return !!(
      override.signerName ||
      override.missionNo ||
      override.missionDate ||
      override.fromDate ||
      override.toDate
    );
  }

  /**
   * Clear all overrides for a person
   */
  clearPersonOverride(personIndex: number): void {
    const overrides = new Map(this.batchPersonOverrides());
    overrides.delete(personIndex);
    this.batchPersonOverrides.set(overrides);
  }

  onSubmit(issueAndPrint = false) {
    this.issueAndPrintAfterSave = issueAndPrint;
    if (this.isOrderEditMode()) {
      this.submitOrderEdit();
      return;
    }

    const primarySigner = this.getPrimarySigner();
    if (primarySigner) {
      this.selectedSigner.set(primarySigner);
    }

    // Validate common constraints
    if (!primarySigner) {
      this.errorMsg.set('Chưa chọn người duyệt');
      return;
    }

    if (this.personsArray.length === 0) {
      this.errorMsg.set('Phải chọn ít nhất 1 cán bộ');
      return;
    }


    this.isSubmitting.set(true);
    this.errorMsg.set('');

    const formValue = this.tripForm.getRawValue();
    formValue.missionDate = this.toLocalDateString(formValue.missionDate);
    formValue.fromDate = this.toLocalDateString(formValue.fromDate);
    formValue.toDate = this.toLocalDateString(formValue.toDate);

    if (this.isEditMode()) {
      // UPDATE flow
      const updateRequest = {
        missionNo: formValue.missionNo || null,
        missionDate: formValue.missionDate || null,
        fromDate: formValue.fromDate || null,
        toDate: formValue.toDate || null,
        departureDate: undefined,
        signerName: primarySigner.fullName,
        signerTitle: primarySigner.positionTitle,
        signerUnitName: primarySigner.unitName || '',
        stops: (formValue.stops || [])
          .map((stop: any, index: number) => ({ ...stop, stopIndex: index }))
          .filter(
            (s: any) =>
              s.fromLocation ||
              s.fromDateTime ||
              s.toLocation ||
              s.toDateTime ||
              s.transport,
          ),
        people: formValue.persons.map((person: any) => ({
          ...person,
        })),
      };

      this.api.updateTrip(this.editingTripId!, updateRequest).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.navigateAfterSave(this.editingTripId!);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMsg.set(
            'Cập nhật bộ giấy thất bại: ' +
              (err?.error?.error || err?.message || 'Lỗi không xác định'),
          );
        },
      });
    } else if (formValue.persons.length === 1) {
      const request = this.buildSingleOrderRequest(formValue);
      this.submitSingleOrder(request);
    } else {
      const request = this.buildBatchRequest(formValue);
      this.submitBatchTrip(request);
    }
  }

  private submitOrderEdit() {
    if (!this.editingOrderId) {
      this.errorMsg.set('Không xác định được giấy đi đường cần cập nhật');
      return;
    }

    if (this.personsArray.length !== 1) {
      this.errorMsg.set('Chế độ sửa giấy phải có đúng 1 cán bộ');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMsg.set('');

    const formValue = this.tripForm.getRawValue();
    formValue.missionDate = this.toLocalDateString(formValue.missionDate);
    formValue.fromDate = this.toLocalDateString(formValue.fromDate);
    formValue.toDate = this.toLocalDateString(formValue.toDate);
    const currentOrder = this.orderDetail();
    if (currentOrder) {
      const request: UpdateTravelOrderRequestDto = {
        personId: currentOrder.personId,
        personCode: currentOrder.personCode,
        fullName: currentOrder.fullName,
        displayNameWithRank: currentOrder.displayNameWithRank,
        rankId: currentOrder.rankId,
        rankCode: currentOrder.rankCode,
        rankName: currentOrder.rankName,
        positionTitle: currentOrder.positionTitle,
        rankTitle: currentOrder.rankTitle,
        unitName: currentOrder.unitName,
        unitCode: currentOrder.unitCode,
        missionNo: formValue.missionNo || undefined,
        missionDate: formValue.missionDate || undefined,
        fromDate: formValue.fromDate || undefined,
        toDate: formValue.toDate || undefined,
        departureDate: currentOrder.departureDate || undefined,
        signerName: this.getPrimarySigner()?.fullName || currentOrder.signerName,
        signerTitle: this.getPrimarySigner()?.positionTitle || currentOrder.signerTitle,
        signerUnitName: this.getPrimarySigner()?.unitName || currentOrder.signerUnitName,
        signedAt: currentOrder.signedAt,
        status: currentOrder.status,
        itinerary: (formValue.stops || []).map((stop: any, index: number) => ({
          stopIndex: index,
          fromLocation: stop.fromLocation || '',
          fromDateTime: stop.fromDateTime || undefined,
          toLocation: stop.toLocation || undefined,
          toDateTime: stop.toDateTime || undefined,
          transport: stop.transport || undefined,
        })),
      };

      this.api.updateOrder(this.editingOrderId, request).subscribe({
        next: (updatedOrder) => {
          this.isSubmitting.set(false);
          this.navigateAfterSave(updatedOrder.tripId);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMsg.set(
            'Cập nhật giấy thất bại: ' +
              (err?.error?.error || err?.message || 'Lỗi không xác định'),
          );
        },
      });
      return;
    }

    const legacyOrder = this.orderView();
    if (!legacyOrder) {
      this.isSubmitting.set(false);
      this.errorMsg.set('Không tải được dữ liệu giấy đi đường đã cập nhật');
      return;
    }

    const request: UpdateTravelOrderOverrideRequest = {
      stopOverrides: (formValue.stops || [])
        .map((stop: any, index: number) => {
          const currentStop = legacyOrder.stopsMerged?.[index];
          if (!currentStop) {
            return null;
          }

          const override: any = { stopIndex: currentStop.stopIndex ?? index };
          let hasOverride = false;

          if ((stop.fromLocation || '') !== (currentStop.fromLocation || '')) {
            override.fromLocationOverride = stop.fromLocation || '';
            hasOverride = true;
          }
          if ((stop.fromDateTime || '') !== (currentStop.fromDateTime || '')) {
            override.fromDateTimeOverride = stop.fromDateTime || '';
            hasOverride = true;
          }
          if ((stop.toLocation || '') !== (currentStop.toLocation || '')) {
            override.toLocationOverride = stop.toLocation || '';
            hasOverride = true;
          }
          if ((stop.toDateTime || '') !== (currentStop.toDateTime || '')) {
            override.toDateTimeOverride = stop.toDateTime || '';
            hasOverride = true;
          }
          if ((stop.transport || '') !== (currentStop.transport || '')) {
            override.transportOverride = stop.transport || '';
            hasOverride = true;
          }

          return hasOverride ? override : null;
        })
        .filter(Boolean),
    };

    this.api.updateOrderOverride(this.editingOrderId, request).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/travel/trips']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMsg.set(
          'Cập nhật giấy thất bại: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  /**
   * Refresh inline PDF preview
   */
  /** Retry preview on error */
  retryPreview() {
    this.previewError.set(null);
    this.triggerPreview('retry');
  }

  /** Trigger preview refresh when personnel or form changes */
  triggerPreview(reason: string) {
    const selected = this.getSelectedPersonnelForPreview();
    const count = selected.length;
    console.log('[Preview] triggerPreview', { reason, count });
    if (count === 0) {
      console.log('[Preview] no-person debug', {
        from: 'triggerPreview',
        formArrayLen: this.personsFA?.controls?.length,
        personsArrayLen: this.personsArray?.length,
      });
      this.clearPreview('no-person');
      return;
    }
    this.previewTrigger$.next(reason);
  }

  setActivePersonByControl(ctrl: AbstractControl, fallbackIndex: number): void {
    this.setActivePersonByValue(ctrl?.value, fallbackIndex);
  }

  setActivePersonByValue(person: any, fallbackIndex = 0): void {
    const personId = this.getPersonKey(person, fallbackIndex);
    this.activePersonId.set(personId);
    this.syncSelectedSignerFromActivePerson();
    this.triggerPreview('active-person-changed');
  }

  isActivePerson(ctrl: AbstractControl, fallbackIndex: number): boolean {
    return (
      this.activePersonId() === this.getPersonKey(ctrl?.value, fallbackIndex)
    );
  }

  getSignerForCard(
    ctrl: AbstractControl,
    fallbackIndex: number,
  ): PersonnelDto | null {
    return this.resolveSignerForPerson(ctrl?.value, fallbackIndex);
  }

  getRankName(
    person:
      | {
          rankName?: string | null;
          rankTitle?: string | null;
        }
      | null
      | undefined,
  ): string {
    return (person?.rankName || person?.rankTitle || '').trim();
  }

  getDisplayNameWithRank(
    person:
      | {
          fullName?: string | null;
          displayNameWithRank?: string | null;
          rankName?: string | null;
          rankTitle?: string | null;
        }
      | null
      | undefined,
  ): string {
    const direct = (person?.displayNameWithRank || '').trim();
    if (direct) {
      return direct;
    }

    return [this.getRankName(person), (person?.fullName || '').trim()]
      .filter(Boolean)
      .join(' ');
  }

  getSignerTitle(signer: PersonnelDto | null | undefined): string {
    return signer?.positionTitle || signer?.rankTitle || 'Chưa có chức vụ';
  }

  getSignerSecondaryInfo(signer: PersonnelDto | null | undefined): string {
    return signer?.unitName || '';
  }

  toggleSignerPicker(
    ctrl: AbstractControl,
    fallbackIndex: number,
    trigger?: HTMLElement,
  ): void {
    const personId = this.getPersonKey(ctrl?.value, fallbackIndex);
    const opening = this.openSignerPickerPersonId() !== personId;
    this.signerPickerQuery.set('');
    this.openSignerPickerPersonId.set(opening ? personId : null);
    if (opening && trigger) {
      // Focus the search box once the dropdown has rendered.
      setTimeout(() =>
        trigger
          .closest('.card-signer-picker')
          ?.querySelector<HTMLInputElement>('.card-signer-search-input')
          ?.focus(),
      );
    }
  }

  closeSignerPicker(): void {
    this.openSignerPickerPersonId.set(null);
    this.signerPickerQuery.set('');
  }

  onSignerPickerSearch(event: Event): void {
    this.signerPickerQuery.set((event.target as HTMLInputElement).value);
  }

  getFilteredSignerOptionsForCard(
    ctrl: AbstractControl,
    fallbackIndex: number,
  ): PersonnelDto[] {
    const options = this.getSignerOptionsForCard(ctrl, fallbackIndex);
    const q = this.signerPickerQuery().trim();
    return q ? options.filter((p) => this.matchesQuery(p, q)) : options;
  }

  isSignerPickerOpen(ctrl: AbstractControl, fallbackIndex: number): boolean {
    return (
      this.openSignerPickerPersonId() ===
      this.getPersonKey(ctrl?.value, fallbackIndex)
    );
  }

  onSignerChangeForCard(
    ctrl: AbstractControl,
    fallbackIndex: number,
    username: string,
  ): void {
    const person = ctrl?.value;
    const signer =
      this.getSignerOptionsForPerson(person, fallbackIndex).find(
        (x) => x.username === username,
      ) || null;
    this.setSignerForPerson(person, signer, fallbackIndex);
    this.closeSignerPicker();
    if (this.isActivePerson(ctrl, fallbackIndex)) {
      this.syncSelectedSignerFromActivePerson();
      this.triggerPreview('card-signer-changed');
    }
  }

  getSignerOptions(): PersonnelDto[] {
    const expanded = this.approverPool();
    if (expanded.length > 0) {
      return expanded;
    }

    const unique = new Map<string, PersonnelDto>();
    this.sortLeaders(this.leadersPool()).forEach((leader) => {
      const key = leader.username || leader.fullName;
      if (key && !unique.has(key)) {
        unique.set(key, leader);
      }
    });
    return Array.from(unique.values());
  }

  private getSignerOptionsForPerson(
    person: any,
    fallbackIndex = 0,
  ): PersonnelDto[] {
    const all = this.getSignerOptions();
    if (!person) {
      return all;
    }

    const sameUnit = all.filter((leader) =>
      this.isSameUnitApprover(leader, person, fallbackIndex),
    );
    const upperUnits = all.filter(
      (leader) =>
        !this.isSameUnitApprover(leader, person, fallbackIndex) &&
        this.isInApproverChain(leader, person),
    );

    return [...this.sortLeaders(sameUnit), ...this.sortLeaders(upperUnits)];
  }

  private getPersonKey(person: any, fallbackIndex = 0): string {
    return (
      person?.personId ||
      person?.personCode ||
      person?.username ||
      `${person?.fullName || 'person'}-${fallbackIndex}`
    );
  }

  private getDefaultSignerForPerson(
    person: any,
    fallbackIndex = 0,
  ): PersonnelDto | null {
    const options = this.getSignerOptionsForPerson(person, fallbackIndex);
    return options[0] || this.selectedSigner() || null;
  }

  private normalizeOrgKey(value: string | null | undefined): string {
    return (value || '').trim().toUpperCase();
  }

  private isSameUnitApprover(
    leader: PersonnelDto | null | undefined,
    person: any,
    fallbackIndex = 0,
  ): boolean {
    if (!leader || !person) {
      return false;
    }

    const personOrg = this.normalizeOrgKey(
      person?.orgCode || person?.unitCode || person?.OrgCode,
    );
    const leaderOrg = this.normalizeOrgKey(leader.orgCode);
    if (personOrg && leaderOrg && personOrg === leaderOrg) {
      return true;
    }

    const personUnit = (person?.unitName || '').trim().toLowerCase();
    const leaderUnit = (leader?.unitName || '').trim().toLowerCase();
    if (personUnit && leaderUnit && personUnit === leaderUnit) {
      return true;
    }

    return false;
  }

  /**
   * "Cấp trên" must be a leader of an ancestor unit of the person's own unit,
   * not a leader of a sibling department. The backend approvers endpoint
   * returns exactly that chain (own unit -> ... -> root) per orgCode, while
   * getSignerOptions() merges the chains of every selected person, so filter
   * the merged pool back down to this person's chain.
   */
  private isInApproverChain(leader: PersonnelDto, person: any): boolean {
    const orgCode = this.normalizeOrgKey(
      person?.orgCode || person?.unitCode || person?.OrgCode,
    );
    const chain = orgCode ? this.approverPoolByOrg.get(orgCode) : undefined;
    if (!chain) {
      // Chain not loaded yet (or person has no org): keep previous behaviour.
      return true;
    }
    const key = leader.username || leader.fullName;
    return chain.some((x) => (x.username || x.fullName) === key);
  }

  private clearApproverPoolCache(): void {
    this.approverPoolByOrg.clear();
    this.approverPool.set([]);
    this.leaderDropdownResults.set([]);
  }

  private refreshApproverPool(): void {
    const unique = new Map<string, PersonnelDto>();

    this.sortLeaders(this.leadersPool()).forEach((leader) => {
      const key = leader.username || leader.fullName;
      if (key && !unique.has(key)) {
        unique.set(key, leader);
      }
    });

    Array.from(this.approverPoolByOrg.values()).forEach((list) => {
      this.sortLeaders(list || []).forEach((leader) => {
        const key = leader.username || leader.fullName;
        if (key && !unique.has(key)) {
          unique.set(key, leader);
        }
      });
    });

    this.approverPool.set(Array.from(unique.values()));
  }

  private preloadApproversForSelectedPersons(): void {
    const persons = this.getSelectedPersonnelForPreview();
    persons.forEach((person) => this.preloadApproversForPerson(person));
  }

  private preloadApproversForPerson(person: any): void {
    const orgCodeRaw =
      person?.orgCode || person?.unitCode || person?.OrgCode || '';
    const orgCode = this.normalizeOrgKey(orgCodeRaw);
    if (!orgCode) {
      this.refreshApproverPool();
      return;
    }

    if (this.approverPoolByOrg.has(orgCode)) {
      this.refreshApproverPool();
      return;
    }

    this.personnelApi
      .getApprovers(orgCode, false)
      .pipe(catchError(() => of([] as PersonnelDto[])))
      .subscribe((list) => {
        this.approverPoolByOrg.set(orgCode, list || []);
        this.refreshApproverPool();
        this.rebuildPersonUiState();
      });
  }

  private resolveSignerForPerson(
    person: any,
    fallbackIndex = 0,
  ): PersonnelDto | null {
    const personId = this.getPersonKey(person, fallbackIndex);
    return this.signerByPerson().get(personId) || this.selectedSigner() || null;
  }

  private setSignerForPerson(
    person: any,
    signer: PersonnelDto | null,
    fallbackIndex = 0,
  ): void {
    const personId = this.getPersonKey(person, fallbackIndex);
    const map = new Map(this.signerByPerson());
    map.set(personId, signer);
    this.signerByPerson.set(map);
  }

  private getPrimarySigner(): PersonnelDto | null {
    const persons = this.getSelectedPersonnelForPreview();
    if (persons.length === 0) {
      return this.selectedSigner();
    }
    const firstPersonSigner = this.resolveSignerForPerson(persons[0], 0);
    return firstPersonSigner || this.selectedSigner();
  }

  private getActivePersonForUi(): any | null {
    const persons = this.getSelectedPersonnelForPreview();
    if (persons.length === 0) {
      return null;
    }
    return persons[this.activePersonIndex] || persons[0] || null;
  }

  private syncSelectedSignerFromActivePerson(): void {
    const activePerson = this.getActivePersonForUi();
    if (!activePerson) {
      this.selectedSigner.set(null);
      return;
    }
    const signer = this.resolveSignerForPerson(
      activePerson,
      this.activePersonIndex,
    );
    this.selectedSigner.set(signer || this.getPrimarySigner());
  }

  private rebuildPersonUiState(): void {
    const persons = this.getSelectedPersonnelForPreview();
    const nextSignerMap = new Map(this.signerByPerson());
    const validIds = new Set<string>();

    persons.forEach((person, index) => {
      const personId = this.getPersonKey(person, index);
      validIds.add(personId);
      if (!nextSignerMap.has(personId)) {
        nextSignerMap.set(
          personId,
          this.getDefaultSignerForPerson(person, index),
        );
      }
    });

    Array.from(nextSignerMap.keys()).forEach((personId) => {
      if (!validIds.has(personId)) {
        nextSignerMap.delete(personId);
      }
    });

    this.signerByPerson.set(nextSignerMap);

    const currentActive = this.activePersonId();
    if (!currentActive || !validIds.has(currentActive)) {
      const firstPerson = persons[0];
      this.activePersonId.set(
        firstPerson ? this.getPersonKey(firstPerson, 0) : null,
      );
    }

    this.syncSelectedSignerFromActivePerson();
  }
  /**
   * Close PDF modal and cleanup blob URL
   */
  onClosePdfModal() {
    this.showPdfModal.set(false);
    const url = this.pdfBlobUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.pdfBlobUrl.set(null);
    }
  }

  /**
   * Download PDF file to disk
   */
  onDownloadPdf() {
    const blob = this.previewBlob;
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `travel-order-${new Date().getTime()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  ngOnDestroy() {
    // Cleanup subscriptions
    if (this.previewSubscription) {
      this.previewSubscription.unsubscribe();
    }
    // Cleanup blob URLs
    const blobUrl = this.previewBlobUrl();
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    const modalUrl = this.pdfBlobUrl();
    if (modalUrl) {
      URL.revokeObjectURL(modalUrl);
    }
    this.previewTrigger$.complete();
  }
}

// Lifecycle + form/setup methods and handlers required by template
export interface TripCreateComponent extends OnInit {}
