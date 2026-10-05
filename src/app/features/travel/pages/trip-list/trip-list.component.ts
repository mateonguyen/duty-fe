import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { catchError, forkJoin, map, of } from 'rxjs';
import { SystemConfigService } from '../../../admin/system-config/system-config.service';
import { TravelApiService } from '../../services/travel-api.service';
import { NumberingDialogComponent } from '../numbering-dialog.component';
import {
  TravelOrderListItemDto,
  TravelTripDetailDto,
} from '../../models/travel.models';

interface TravelOrderListRow extends TravelOrderListItemDto {
  fromDate?: string;
  toDate?: string;
  legacyReviewedAt?: string;
  issuedAt?: string;
  tripStatus?: string;
}

interface TravelTripGroup {
  tripId: number;
  tripNo: string;
  createdAt: string;
  orders: TravelOrderListRow[];
  totalOrders: number;
  canEdit: boolean;
  canTakeNumber: boolean;
  status: string;
  peopleSummary: string;
}

interface OrderFilters {
  keyword: string;
  status: string;
  signer: string;
  tripNo: string;
  fromDate: string;
  toDate: string;
  orderNo: string;
}

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, RouterModule, UiSelectComponent, NumberingDialogComponent],
  templateUrl: './trip-list.component.html',
  styleUrls: ['./trip-list.component.scss'],
})
export class TripListComponent implements OnInit {
  orders = signal<TravelOrderListRow[]>([]);
  selectedOrderIds = signal<Set<number>>(new Set());
  isPrinting = signal(false);
  printingTripId = signal<number | null>(null);
  changingTripId = signal<number | null>(null);
  numberingTripId = signal<number | null>(null);
  private printAfterNumbering = false;
  collapsedTripIds = signal<Set<number>>(new Set());

  toggleOrder(id: number, selected: boolean) {
    if (this.orders().find(row => row.id === id)?.status === 'DELETED') return;
    this.selectedOrderIds.update(current => {
      const next = new Set(current);
      selected ? next.add(id) : next.delete(id);
      return next;
    });
  }

  togglePage(selected: boolean) {
    this.selectedOrderIds.update(current => {
      const next = new Set(current);
      for (const row of this.pagedOrders().filter(item => item.status !== 'DELETED')) selected ? next.add(row.id) : next.delete(row.id);
      return next;
    });
  }

  isPageSelected(): boolean {
    const rows = this.pagedOrders().filter(item => item.status !== 'DELETED');
    return rows.length > 0 && rows.every(row => this.selectedOrderIds().has(row.id));
  }

  hasPagePrintableOrders(): boolean {
    return this.pagedOrders().some(row => row.status !== 'DELETED');
  }

  hasTripPrintableOrders(tripId: number): boolean {
    return this.orders().some(row => row.tripId === tripId && row.status !== 'DELETED');
  }

  printSelected() {
    const ids = [...this.selectedOrderIds()].filter(id => this.orders().some(row => row.id === id && row.status !== 'DELETED'));
    if (!ids.length || this.isPrinting()) return;
    this.isPrinting.set(true);
    this.errorMsg.set('');
    this.api.exportOrdersPdf(ids).subscribe({
      next: blob => {
        this.isPrinting.set(false);
        this.printPdf(blob);
      },
      error: err => {
        this.isPrinting.set(false);
        this.errorMsg.set('In hàng loạt thất bại: ' + (err?.error?.error || err?.message || 'Lỗi không xác định'));
      },
    });
  }

  isLoading = signal(false);
  isCreatingDemo = signal(false);
  errorMsg = signal('');
  unitCode = signal<string>(''); // Unit code for OrderNo display formatting

  readonly pageSizeOptions = [5, 10, 20];
  readonly pageSizeChoices = this.pageSizeOptions.map(value => ({ value, label: String(value) }));
  get statusChoices() { return [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'DRAFT', label: 'Bản nháp' },
    { value: 'ISSUED', label: 'Chính thức' },
    { value: 'ARCHIVED', label: 'Đã thu hồi / đã xóa' },
  ]; }
  orderPageSize = signal(5);
  orderPage = signal(1);

  orderFilter = signal<OrderFilters>({
    keyword: '',
    status: '',
    signer: '',
    tripNo: '',
    fromDate: '',
    toDate: '',
    orderNo: '',
  });

  readonly filterFromDate = computed(() => this.dateForPicker(this.orderFilter().fromDate));
  readonly filterToDate = computed(() => this.dateForPicker(this.orderFilter().toDate));

  readonly draftCount = computed(
    () =>
      this.orders().filter((x) => this.normalizedStatus(x.status) === 'DRAFT')
        .length,
  );
  readonly finalizedCount = computed(
    () => this.orders().filter(x => this.normalizedStatus(x.status) === 'ISSUED').length,
  );
  readonly archivedCount = computed(
    () => this.orders().filter(x => this.normalizedStatus(x.status) === 'ARCHIVED').length,
  );

  readonly uniqueTripsCount = computed(
    () => new Set(this.orders().map((x) => x.tripId)).size,
  );

  readonly orderStatusOptions = computed(() =>
    this.extractStatuses(this.orders()),
  );

  readonly signerOptions = computed(() =>
    Array.from(
      new Set(
        this.orders()
          .map((x) => x.signerName || '')
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'vi')),
  );

  readonly filteredOrders = computed(() => {
    const f = this.orderFilter();
    const keyword = this.normalize(f.keyword);
    const signer = this.normalize(f.signer);
    const tripNo = this.normalize(f.tripNo);
    const orderNo = this.normalize(f.orderNo);
    const from = this.parseDateSafe(f.fromDate);
    const to = this.parseDateSafe(f.toDate);

    return this.orders().filter((row) => {
      const matchesKeyword =
        !keyword ||
        this.normalize(this.getDisplayNameWithRank(row)).includes(keyword) ||
        this.normalize(row.signerName).includes(keyword) ||
        this.normalize(row.missionNo || row.orderNo).includes(keyword) ||
        this.normalize(this.formatOrderNo(row.orderNo)).includes(keyword) ||
        this.normalize(row.tripNo).includes(keyword) ||
        this.normalize(this.formatTripGroupCode(row.tripNo)).includes(keyword);

       const matchesStatus = !f.status || this.normalizedStatus(row.status) === f.status;
      const matchesSigner =
        !signer || this.normalize(row.signerName).includes(signer);
      const matchesTripNo =
        !tripNo || this.normalize(row.tripNo).includes(tripNo) ||
        this.normalize(this.formatTripGroupCode(row.tripNo)).includes(tripNo);
      const matchesOrderNo =
        !orderNo ||
        this.normalize(row.orderNo).includes(orderNo) ||
        this.normalize(this.formatOrderNo(row.orderNo)).includes(orderNo);
      const matchesFrom =
        !from || !row.fromDate || new Date(row.fromDate) >= from;
      const matchesTo = !to || !row.toDate || new Date(row.toDate) <= to;

      return (
        matchesKeyword &&
        matchesStatus &&
        matchesSigner &&
        matchesTripNo &&
        matchesOrderNo &&
        matchesFrom &&
        matchesTo
      );
    });
  });

  readonly hasActiveFilter = computed(() =>
    Object.values(this.orderFilter()).some((v) => !!v),
  );

  readonly orderEndIndex = computed(() =>
    Math.min(
      this.orderPage() * this.orderPageSize(),
      this.filteredTripGroups().length,
    ),
  );

  readonly filteredTripGroups = computed<TravelTripGroup[]>(() => {
    const groups = new Map<number, TravelTripGroup>();
    const totals = new Map<number, TravelOrderListRow[]>();
    for (const order of this.orders()) {
      const tripOrders = totals.get(order.tripId) || [];
      tripOrders.push(order);
      totals.set(order.tripId, tripOrders);
    }
    for (const order of this.filteredOrders()) {
      let group = groups.get(order.tripId);
      if (!group) {
        const allOrders = totals.get(order.tripId) || [];
        group = {
          tripId: order.tripId,
          tripNo: order.tripNo,
          createdAt: order.tripCreatedAt || order.createdAt,
          orders: [],
          totalOrders: allOrders.length,
          canEdit: allOrders.some(item => item.canEdit) && allOrders.filter(item => item.status !== 'DELETED').every(item => item.canEdit),
          canTakeNumber: allOrders.some(item => item.canTakeNumber) && allOrders.filter(item => item.status !== 'DELETED').every(item => item.canTakeNumber),
          status: allOrders[0]?.tripStatus || allOrders.find(item => item.status !== 'DELETED')?.status || 'DELETED',
          peopleSummary: allOrders.slice(0, 2).map(item => item.fullName).join(', ') +
            (allOrders.length > 2 ? ` và ${allOrders.length - 2} người khác` : ''),
        };
        groups.set(order.tripId, group);
      }
      group.orders.push(order);
    }
    return [...groups.values()].sort((a, b) =>
      this.sortByCreatedAtDesc(a.createdAt, b.createdAt) || b.tripId - a.tripId,
    );
  });

  readonly orderTotalPages = computed(() =>
    this.computeTotalPages(this.filteredTripGroups().length, this.orderPageSize()),
  );

  readonly pagedTripGroups = computed(() =>
    this.paginate(this.filteredTripGroups(), this.orderPage(), this.orderPageSize()),
  );

  readonly pagedOrders = computed(() => this.pagedTripGroups().flatMap(group => group.orders));

  readonly orderStartIndex = computed(() =>
    this.filteredTripGroups().length === 0
      ? 0
      : (this.orderPage() - 1) * this.orderPageSize() + 1,
  );

  constructor(
    private api: TravelApiService,
    private systemConfigService: SystemConfigService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.loadUnitCode();
    this.loadOrders();
    const issueAndPrintId = Number(this.route.snapshot.queryParamMap.get('issueAndPrintTrip'));
    if (Number.isInteger(issueAndPrintId) && issueAndPrintId > 0) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { issueAndPrintTrip: null }, queryParamsHandling: 'merge', replaceUrl: true });
      this.printAfterNumbering = true;
      this.numberingTripId.set(issueAndPrintId);
    }
    const printTripId = Number(this.route.snapshot.queryParamMap.get('printTrip'));
    if (Number.isInteger(printTripId) && printTripId > 0) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { printTrip: null }, queryParamsHandling: 'merge', replaceUrl: true });
      this.onPrintTrip(printTripId);
    }
  }

  toggleTrip(group: TravelTripGroup, selected: boolean) {
    this.selectedOrderIds.update(current => {
      const next = new Set(current);
      for (const order of this.orders().filter(item => item.tripId === group.tripId && item.status !== 'DELETED'))
        selected ? next.add(order.id) : next.delete(order.id);
      return next;
    });
  }

  isTripSelected(group: TravelTripGroup): boolean {
    const eligible = this.orders().filter(item => item.tripId === group.tripId && item.status !== 'DELETED');
    return eligible.length > 0 && eligible.every(order => this.selectedOrderIds().has(order.id));
  }

  isTripCollapsed(tripId: number): boolean {
    return this.collapsedTripIds().has(tripId);
  }

  toggleTripCollapsed(tripId: number): void {
    this.collapsedTripIds.update(current => {
      const next = new Set(current);
      next.has(tripId) ? next.delete(tripId) : next.add(tripId);
      return next;
    });
  }

  formatTripGroupCode(raw?: string): string {
    if (!raw) return '—';
    return /^\d{8,}$/.test(raw) ? `BG-${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
  }

  onPrintTrip(tripId: number) {
    if (this.printingTripId() !== null) return;
    this.printingTripId.set(tripId);
    this.errorMsg.set('');
    this.api.exportTripPdf(tripId).subscribe({
      next: blob => {
        this.printingTripId.set(null);
        this.printPdf(blob);
      },
      error: err => {
        this.printingTripId.set(null);
        this.errorMsg.set('In bộ giấy thất bại: ' + (err?.error?.error || err?.message || 'Lỗi không xác định'));
      },
    });
  }

  onIssueTrip(tripId: number) {
    this.printAfterNumbering = false;
    this.numberingTripId.set(tripId);
  }

  onNumberingClosed(): void { this.printAfterNumbering = false; this.numberingTripId.set(null); }

  onNumbered(tripId: number): void {
    const print = this.printAfterNumbering;
    this.printAfterNumbering = false;
    this.loadOrders();
    if (print) { this.numberingTripId.set(null); this.onPrintTrip(tripId); }
  }

  onReplaceTrip(tripId: number) {
    if (this.changingTripId() !== null) return;
    const reason = window.prompt('Lý do tạo bản thay thế (bản cũ chỉ bị hủy khi bản mới được lấy số):')?.trim();
    if (!reason) return;
    this.changingTripId.set(tripId);
    this.errorMsg.set('');
    this.api.createReplacement(tripId, reason).subscribe({
      next: result => {
        this.changingTripId.set(null);
        this.router.navigate(['/travel/trips', result.tripId, 'edit']);
      },
      error: err => { this.changingTripId.set(null); this.errorMsg.set('Cấp lại giấy thất bại: ' + (err?.error?.error || err?.message)); },
    });
  }

  loadUnitCode() {
    this.systemConfigService.fetchAll().subscribe({
      next: (configs) => {
        const unitCode =
          configs.find((x) => x.key === 'CucCode')?.value ||
          configs.find((x) => x.key === 'UnitCode')?.value ||
          '';
        this.unitCode.set((unitCode || '').trim());
      },
      error: () => {
        this.unitCode.set('');
      },
    });
  }

  loadOrders() {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.api.listOrders().subscribe({
      next: (orders) => {
        const tripIds = Array.from(new Set(orders.map((x) => x.tripId)));
        const detailRequests = tripIds.map((tripId) =>
          this.api.getTrip(tripId).pipe(
            map((trip) => ({ tripId, trip })),
            catchError(() =>
              of({ tripId, trip: null as TravelTripDetailDto | null }),
            ),
          ),
        );

        if (detailRequests.length === 0) {
          this.orders.set([]);
          this.orderPage.set(1);
          this.isLoading.set(false);
          return;
        }

        forkJoin(detailRequests).subscribe({
          next: (details) => {
            const tripMap = new Map(
              details
                .filter((x) => x.trip)
                .map((x) => [x.tripId, x.trip as TravelTripDetailDto]),
            );

            this.orders.set(
              orders
                .map((order) => {
                  const trip = tripMap.get(order.tripId);
                  return {
                    ...order,
                    fromDate: trip?.fromDate,
                    toDate: trip?.toDate,
                    legacyReviewedAt: trip?.legacyReviewedAt,
                    issuedAt: trip?.issuedAt,
                    tripCreatedAt: trip?.createdAt || order.tripCreatedAt,
                    tripStatus: trip?.status,
                  };
                })
                .sort((a, b) =>
                  this.sortByCreatedAtDesc(a.tripCreatedAt, b.tripCreatedAt) ||
                  b.tripId - a.tripId || a.id - b.id,
                ),
            );

            this.orderPage.set(1);
            this.isLoading.set(false);
          },
          error: () => {
            // Fallback to list-only data if trip detail enrichment fails.
            this.orders.set(
              orders
                .map((order) => ({ ...order }))
                .sort((a, b) =>
                  this.sortByCreatedAtDesc(a.tripCreatedAt, b.tripCreatedAt) ||
                  b.tripId - a.tripId || a.id - b.id,
                ),
            );
            this.orderPage.set(1);
            this.isLoading.set(false);
          },
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err?.status === 404) {
          this.orders.set([]);
          return;
        }

        this.errorMsg.set(
          'Tải dữ liệu thất bại: ' + (err?.error?.error || err?.message),
        );
      },
    });
  }

  onViewOrder(orderId: number) {
    this.api.exportOrderPdf(orderId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      },
      error: (err) => {
        this.errorMsg.set(
          'Xem trước thất bại: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  onEditOrder(orderId: number) {
    this.router.navigate(['/travel/orders', orderId, 'edit']);
  }

  onDeleteOrder(orderId: number) {
    if (!window.confirm('Xóa giấy đi đường nháp này?')) return;
    this.errorMsg.set('');
    this.api.deleteOrder(orderId).subscribe({
      next: () => {
        this.selectedOrderIds.update(current => { const next = new Set(current); next.delete(orderId); return next; });
        this.loadOrders();
      },
      error: (err) => this.errorMsg.set('Xóa giấy thất bại: ' + (err?.error?.error || err?.message)),
    });
  }

  onCopyOrder(orderId: number) {
    this.router.navigate(['/travel/create'], { queryParams: { copyFrom: orderId } });
  }

  onExportOrderPdf(orderId: number) {
    this.api.exportOrderPdf(orderId).subscribe({
      next: (blob) => this.printPdf(blob),
      error: (err) => {
        this.errorMsg.set(
          'In giấy thất bại: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  private printPdf(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    const cleanup = () => {
      frame.remove();
      URL.revokeObjectURL(url);
    };
    frame.onload = () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        cleanup();
        this.errorMsg.set('Không mở được hộp thoại in.');
        return;
      }
      printWindow.addEventListener('afterprint', cleanup, { once: true });
      printWindow.focus();
      printWindow.print();
    };
    frame.src = url;
    document.body.appendChild(frame);
    setTimeout(cleanup, 300000);
  }

  onEditTrip(tripId: number) {
    this.router.navigate(['/travel/trips', tripId, 'edit']);
  }

  updateOrderFilter(patch: Partial<OrderFilters>) {
    this.orderFilter.set({ ...this.orderFilter(), ...patch });
    this.orderPage.set(1);
  }

  onDateFilterChange(field: 'fromDate' | 'toDate', value: Date | null): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      this.updateOrderFilter({ [field]: '' });
      return;
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    this.updateOrderFilter({ [field]: `${year}-${month}-${day}` });
  }

  private dateForPicker(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date : null;
  }

  resetOrderFilters() {
    this.orderFilter.set({
      keyword: '',
      status: '',
      signer: '',
      tripNo: '',
      fromDate: '',
      toDate: '',
      orderNo: '',
    });
    this.orderPage.set(1);
  }

  onOrderPageSizeChange(size: string | number) {
    this.orderPageSize.set(Number(size || '5'));
    this.orderPage.set(1);
  }

  goToOrderPage(page: number) {
    const safe = Math.min(Math.max(page, 1), this.orderTotalPages());
    this.orderPage.set(safe);
  }

  onCreateNew() {
    this.router.navigate(['/travel/create']);
  }

  onCreateDemo() {
    this.isCreatingDemo.set(true);
    this.errorMsg.set('');
    this.api.createDemoTrip().subscribe({
      next: () => {
        this.isCreatingDemo.set(false);
        this.loadOrders();
      },
      error: (err) => {
        this.isCreatingDemo.set(false);
        this.errorMsg.set(
          'Tạo demo thất bại: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định'),
        );
      },
    });
  }

  getDisplayNameWithRank(order: TravelOrderListRow): string {
    return (
      order.displayNameWithRank ||
      [order.rankName || order.rankTitle, order.fullName]
        .filter(Boolean)
        .join(' ')
    );
  }

  formatDate(value?: string): string {
    if (!value) {
      return '—';
    }

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    const day = `${d.getDate()}`.padStart(2, '0');
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  normalizedStatus(status?: string): string {
    const key = (status || '').toUpperCase();
    if (key === 'PRINTED') return 'DRAFT';
    if (key === 'SIGNED' || key === 'CLOSED') return 'ISSUED';
    if (key === 'CANCELLED' || key === 'DELETED') return 'ARCHIVED';
    return key;
  }

  statusLabel(status?: string, legacyReviewedAt?: string, issuedAt?: string): string {
    const key = (status || '').toUpperCase();
    if (key === 'DRAFT' || key === 'PRINTED') return 'Bản nháp';
    if (key === 'ISSUED' || key === 'SIGNED' || key === 'CLOSED') return 'Chính thức';
    if (key === 'CANCELLED') return 'Đã thu hồi';
    if (key === 'DELETED') return 'Đã xóa';
    return status || '—';
  }

  statusClass(status?: string): string {
    const key = (status || 'UNKNOWN').toUpperCase();
    if (key === 'PRINTED') return 'status-badge status-DRAFT';
    if (key === 'SIGNED' || key === 'CLOSED') return 'status-badge status-ISSUED';
    return `status-badge status-${key}`;
  }

  statusHint(status?: string, legacyReviewedAt?: string, issuedAt?: string): string {
    if (status === 'PRINTED' || status === 'DRAFT') return 'Bản nháp có thể sửa, xóa. Thao tác in không đổi trạng thái giấy.';
    if (status === 'ISSUED') return 'Giấy đã lấy số, nội dung được khóa. Có thể in bất cứ lúc nào.';
    if (status === 'CANCELLED') return 'Giấy đã thu hồi, chỉ còn để tra cứu.';
    if (status === 'DELETED') return 'Bản nháp đã xóa, chỉ còn để tra cứu.';
    return '';
  }

  /**
   * Format OrderNo for display: "20260013" -> "13/GĐĐ-H05"
   * Input: raw OrderNo in format {yyyy}{seq:D4}
   * Output: {seq}/GĐĐ-{unitCode}
   */
  formatOrderNo(raw?: string): string {
    if (!raw || !/^\d{8,}$/.test(raw)) {
      return raw || 'Chưa lấy số';
    }

    try {
      // Extract sequence from last 4 characters and remove leading zeros
      const seq = parseInt(raw.substring(4), 10).toString();
      const unit = this.unitCode().trim();

      if (!unit) {
        return `${seq}/GĐĐ`;
      }

      return `${seq}/GĐĐ-${unit}`;
    } catch {
      return raw;
    }
  }

  formatSignerName(value?: string): string {
    return value?.trim() ? value : 'Chưa chỉ định';
  }

  isMissingValue(value?: string): boolean {
    return !value?.trim();
  }

  private normalize(value?: string): string {
    return (value || '').trim().toLowerCase();
  }

  private parseDateSafe(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return d;
  }

  private computeTotalPages(totalItems: number, pageSize: number): number {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }

  private paginate<T>(rows: T[], page: number, pageSize: number): T[] {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }

  private extractStatuses<T extends { status?: string }>(rows: T[]): string[] {
    return Array.from(
      new Set(rows.map((x) => (x.status || '').trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'vi'));
  }

  private sortByCreatedAtDesc(a?: string, b?: string): number {
    const first = a ? Date.parse(a) : 0;
    const second = b ? Date.parse(b) : 0;
    return (Number.isNaN(second) ? 0 : second) - (Number.isNaN(first) ? 0 : first);
  }

}
