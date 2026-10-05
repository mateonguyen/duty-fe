import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TravelApiService } from '../services/travel-api.service';
import {
  TravelTripDetailDto,
  ChangeTripStatusRequest,
  TravelOrderPreviewModel,
} from '../models/travel.models';
import { TravelPreviewPageComponent } from './travel-preview-page.component';
import { NumberingDialogComponent } from './numbering-dialog.component';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, TravelPreviewPageComponent, NumberingDialogComponent],
  template: `
    <div class="split-container">
      <!-- LEFT: PREVIEW PANEL (sticky) -->
      <div class="preview-panel" *ngIf="trip()">
        <div class="preview-header">
          <h3>Xem trước</h3>
          <span class="preview-count" *ngIf="trip()!.orders.length > 0">
            {{ trip()!.orders.length }} giấy
          </span>
        </div>
        <div class="preview-scroll">
          <div
            *ngFor="let order of trip()!.orders; let i = index"
            class="preview-item"
          >
            <app-travel-preview-page
              [data]="buildPreviewForOrder(order, i)"
            ></app-travel-preview-page>
          </div>
          <div *ngIf="trip()!.orders.length === 0" class="preview-empty">
            Chưa có cán bộ nào trong đợt
          </div>
        </div>
      </div>

      <!-- RIGHT: DETAIL PANEL -->
      <div class="detail-panel">
        <div class="detail-header">
          <h2>Chi tiết giấy đi đường</h2>
          <button class="btn btn-secondary" (click)="onBack()">Quay lại</button>
        </div>

        <div *ngIf="isLoading()" class="alert alert-info">
          Đang tải dữ liệu...
        </div>
        <div *ngIf="errorMsg()" class="alert alert-error">{{ errorMsg() }}</div>

        <div *ngIf="trip() && !isLoading()" class="detail-content">
          <!-- HEADER INFO -->
          <div class="info-section header-section">
            <p *ngIf="trip()!.replacesTripId">Bản thay thế cho bộ cũ. Bản cũ chỉ bị hủy khi bản này được lấy số. <button class="btn btn-xs btn-info" type="button" (click)="openReplacedTrip()">Xem bộ cũ</button></p>
            <p *ngIf="trip()!.issuedAt">Lấy số lúc {{ trip()!.issuedAt | date: 'dd/MM/yyyy HH:mm' }} bởi {{ trip()!.issuedBy }}</p>
            <p *ngIf="trip()!.cancellationReason">Lý do hủy: {{ trip()!.cancellationReason }}</p>
            <div class="info-row">
              <div class="info-item">
                <label>Mã đợt</label>
                <span class="value">{{ trip()!.tripNo }}</span>
              </div>
              <div class="info-item">
                <label>Trạng thái</label>
                <span [ngClass]="'status-badge ' + 'status-' + trip()!.status">
                  {{ statusDisplay(trip()!.status) }}
                </span>
              </div>
            </div>
          </div>

          <!-- TRIP INFO CARD -->
          <div class="detail-card">
            <h4>Thông tin chuyến đi</h4>
            <div class="info-grid">
              <div class="info-item" *ngIf="trip()!.missionNo">
                <label>Mã NV</label>
                <span>{{ trip()!.missionNo }}</span>
              </div>
              <div class="info-item" *ngIf="trip()!.missionDate">
                <label>Ngày NV</label>
                <span>{{ trip()!.missionDate | date: 'dd/MM/yyyy' }}</span>
              </div>
              <div class="info-item" *ngIf="trip()!.purpose">
                <label>Mục đích</label>
                <span>{{ trip()!.purpose }}</span>
              </div>
              <div class="info-item" *ngIf="trip()!.fromDate">
                <label>Từ ngày</label>
                <span>{{ trip()!.fromDate | date: 'dd/MM/yyyy' }}</span>
              </div>
              <div class="info-item" *ngIf="trip()!.toDate">
                <label>Đến ngày</label>
                <span>{{ trip()!.toDate | date: 'dd/MM/yyyy' }}</span>
              </div>
              <div class="info-item" *ngIf="trip()!.departureDate">
                <label>Ngày khởi hành</label>
                <span>{{ trip()!.departureDate | date: 'dd/MM/yyyy' }}</span>
              </div>
            </div>
          </div>

          <!-- STOPS SECTION -->
          <div class="detail-card" *ngIf="trip()!.stops.length > 0">
            <h4>Lộ trình ({{ trip()!.stops.length }} chặng)</h4>
            <div class="table-wrapper">
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>Từ</th>
                    <th>Ngày/Giờ đi</th>
                    <th>Đến</th>
                    <th>Ngày/Giờ đến</th>
                    <th>Phương tiện</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let stop of trip()!.stops">
                    <td>{{ stop.fromLocation }}</td>
                    <td>{{ stop.fromDateTime | date: 'dd/MM HH:mm' }}</td>
                    <td>{{ stop.toLocation || '-' }}</td>
                    <td>{{ stop.toDateTime | date: 'dd/MM HH:mm' }}</td>
                    <td>{{ stop.transport || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ORDERS SECTION -->
          <div class="detail-card" *ngIf="trip()!.orders.length > 0">
            <h4>Danh sách cán bộ ({{ trip()!.orders.length }})</h4>
            <div class="table-wrapper">
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Chức vụ</th>
                    <th>Cấp bậc</th>
                    <th>Đơn vị</th>
                    <th>Trạng thái</th>
                    <th style="width: 200px">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let order of trip()!.orders">
                    <td>
                      <strong>{{ getDisplayNameWithRank(order) }}</strong>
                    </td>
                    <td>{{ order.positionTitle || '-' }}</td>
                    <td>{{ order.rankTitle || '-' }}</td>
                    <td>{{ order.unitName }}</td>
                    <td>
                      <span
                        [ngClass]="'order-status ' + 'status-' + order.status"
                      >
                        {{ statusDisplay(order.status) }}
                      </span>
                    </td>
                    <td class="action-buttons">
                      <button
                        class="btn btn-xs btn-info"
                        (click)="onDownloadPdf(order.id)"
                        title="Tải PDF"
                      >
                        📥 PDF
                      </button>
                      <button
                        *ngIf="trip()!.status === 'DRAFT' && order.status === 'DRAFT'"
                        class="btn btn-xs btn-warning"
                        (click)="onEditOrder(order.id)"
                      >
                        ✏️ Sửa
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ACTIONS SECTION -->
          <div class="detail-card actions-card">
            <h4>Quản lý đợt</h4>
             <p>Có thể in bất cứ lúc nào. Lấy số giấy sẽ khóa nội dung; bản nháp có dấu nhận biết.</p>
            <div class="action-buttons">
               <button *ngIf="trip()!.canTakeNumber && (trip()!.status === 'DRAFT' || trip()!.status === 'PRINTED')" class="btn btn-info" (click)="issueTrip()">✓ Lấy số giấy</button>
              <button *ngIf="trip()!.status !== 'DELETED'"
                class="btn btn-info"
                (click)="onPrintTrip()"
              >
                 🖨️ In bộ
              </button>
              <button *ngIf="trip()!.status === 'ISSUED' || trip()!.status === 'SIGNED'" class="btn btn-danger" (click)="markCancelled()">✕ Thu hồi giấy</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <app-numbering-dialog *ngIf="numberingOpen()" [tripId]="tripId"
      (closed)="numberingOpen.set(false)" (numbered)="loadTrip()" />

    <style>
      .split-container {
        display: flex;
        height: calc(100vh - 64px); /* Subtract header height */
        overflow: hidden; /* No outer scroll */
        gap: 0;
        background-color: #f5f7fa;
      }
      .preview-panel {
        width: 45%;
        background-color: #fff;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        position: relative;
        height: 100%; /* Fill container height */
        overflow: hidden; /* Control scroll in child */
      }
      .detail-panel {
        width: 55%;
        height: 100%; /* Fill container height */
        overflow-y: auto; /* Only right panel scrolls */
        padding: 20px;
      }

      .preview-header {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .preview-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }
      .preview-count {
        font-size: 12px;
        color: #999;
        background: #f0f0f0;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .preview-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }
      .preview-item {
        margin-bottom: 20px;
      }
      .preview-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #999;
        font-style: italic;
      }

      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .detail-header h2 {
        margin: 0;
      }

      .alert {
        padding: 12px 16px;
        border-radius: 4px;
        margin-bottom: 20px;
      }
      .alert-info {
        background-color: #d1ecf1;
        border-left: 4px solid #17a2b8;
        color: #0c5460;
      }
      .alert-error {
        background-color: #f8d7da;
        border-left: 4px solid #dc3545;
        color: #721c24;
      }

      .detail-content {
      }

      .info-section {
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 15px;
      }

      .header-section {
        background: linear-gradient(
          135deg,
          rgba(0, 123, 255, 0.08) 0%,
          rgba(0, 123, 255, 0.04) 100%
        );
        border-left: 4px solid #007bff;
      }

      .info-row {
        display: flex;
        gap: 20px;
      }
      .info-item {
        flex: 1;
      }
      .info-item label {
        font-size: 12px;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
      }
      .info-item .value {
        display: block;
        margin-top: 5px;
        font-size: 16px;
        font-weight: 600;
      }

      .detail-card {
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 18px;
        margin-bottom: 15px;
      }

      .detail-card h4 {
        margin: 0 0 15px 0;
        font-size: 14px;
        font-weight: 600;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .info-grid .info-item label {
        color: #999;
        font-size: 11px;
      }
      .info-grid .info-item span {
        margin-top: 2px;
        font-size: 13px;
      }

      .table-wrapper {
        overflow-x: auto;
        border-radius: 4px;
        border: 1px solid #ddd;
      }
      .detail-table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        font-size: 12px;
      }
      .detail-table thead {
        background-color: #f9f9f9;
        border-bottom: 2px solid #ddd;
      }
      .detail-table th {
        padding: 10px;
        text-align: left;
        font-weight: 600;
        color: #333;
      }
      .detail-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #eee;
      }

      .status-badge {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
      }

      .status-DRAFT {
        background-color: #e9ecef;
        color: #495057;
      }
      .status-PRINTED {
        background-color: #e9ecef;
        color: #495057;
      }
      .status-ISSUED {
        background-color: #d1e7dd;
        color: #0f5132;
      }
      .status-SIGNED {
        background-color: #d1e7dd;
        color: #0f5132;
      }
      .status-CLOSED {
        background-color: #d3d8dd;
        color: #383d41;
      }
      .status-CANCELLED {
        background-color: #f8d7da;
        color: #721c24;
      }
      .status-DELETED {
        background-color: #e9ecef;
        color: #495057;
      }

      .order-status {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
      }

      .order-status.status-NEW {
        background-color: #fff3cd;
        color: #856404;
      }
      .order-status.status-MODIFIED {
        background-color: #cfe2ff;
        color: #084298;
      }
      .order-status.status-SIGNED {
        background-color: #d1e7dd;
        color: #0f5132;
      }

      .actions-card {
        background: linear-gradient(
          135deg,
          rgba(40, 167, 69, 0.06) 0%,
          rgba(40, 167, 69, 0.03) 100%
        );
        border-left: 4px solid #28a745;
      }
      .actions-card .action-buttons {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
      }
      .btn {
        padding: 8px 14px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-primary {
        background-color: #007bff;
        color: white;
      }
      .btn-primary:hover {
        background-color: #0056b3;
      }
      .btn-secondary {
        background-color: #6c757d;
        color: white;
      }
      .btn-secondary:hover {
        background-color: #5a6268;
      }
      .btn-info {
        background-color: #17a2b8;
        color: white;
      }
      .btn-info:hover {
        background-color: #138496;
      }
      .btn-success {
        background-color: #28a745;
        color: white;
      }
      .btn-success:hover {
        background-color: #218838;
      }
      .btn-warning {
        background-color: #ffc107;
        color: #333;
      }
      .btn-warning:hover {
        background-color: #e0a800;
      }
      .btn-danger {
        background-color: #dc3545;
        color: white;
      }
      .btn-danger:hover {
        background-color: #c82333;
      }
      .btn-xs {
        padding: 4px 8px;
        font-size: 11px;
      }

      @media (max-width: 1200px) {
        .split-container {
          flex-direction: column;
          height: auto;
        }
        .preview-panel {
          width: 100%;
          height: 300px;
          border-right: none;
          border-bottom: 1px solid #ddd;
        }
        .detail-panel {
          width: 100%;
        }
      }
    </style>
  `,
})
export class TripDetailComponent implements OnInit {
  tripId!: number;
  trip = signal<TravelTripDetailDto | null>(null);
  isLoading = signal(false);
  errorMsg = signal('');
  numberingOpen = signal(false);

  constructor(
    private route: ActivatedRoute,
    private api: TravelApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.tripId = Number(params.get('id'));
      this.loadTrip();
    });
  }

  loadTrip() {
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.api.getTrip(this.tripId).subscribe({
      next: (res) => {
        this.trip.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMsg.set(
          'Tải dữ liệu thất bại: ' + (err?.error?.error || err?.message),
        );
      },
    });
  }

  buildPreviewForOrder(order: any, index: number): TravelOrderPreviewModel {
    const trip = this.trip()!;
    return {
      orderNo: `(${index + 1})`,
      tripNo: trip.tripNo,
      fullName: order.fullName,
      displayNameWithRank: this.getDisplayNameWithRank(order),
      rankName: order.rankName || order.rankTitle,
      positionTitle: order.positionTitle,
      rankTitle: order.rankTitle,
      unitName: order.unitName,
      missionNo: trip.missionNo,
      missionDate: trip.missionDate,
      purpose: trip.purpose,
      fromDate: trip.fromDate,
      toDate: trip.toDate,
      departureDate: trip.departureDate,
      signerName: trip.signerName,
      signerTitle: trip.signerTitle,
      signerUnitName: trip.signerUnitName,
      stops: trip.stops.map((stop, i) => ({
        stopIndex: i,
        fromLocation: stop.fromLocation,
        fromDateTime: stop.fromDateTime,
        toLocation: stop.toLocation || '',
        toDateTime: stop.toDateTime || '',
        transport: stop.transport || '',
      })),
    };
  }

  getDisplayNameWithRank(order: {
    fullName?: string;
    displayNameWithRank?: string;
    rankName?: string;
    rankTitle?: string;
  }): string {
    return (
      order.displayNameWithRank ||
      [order.rankName || order.rankTitle, order.fullName]
        .filter(Boolean)
        .join(' ')
    );
  }

  onDownloadPdf(orderId: number) {
    this.api.exportOrderPdf(orderId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `giay-di-duong-${orderId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.errorMsg.set(
          'Tải PDF thất bại: ' + (err?.error?.error || err?.message),
        );
      },
    });
  }

  onPrintTrip() {
    this.api.exportTripPdf(this.tripId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0' });
        const cleanup = () => { frame.remove(); URL.revokeObjectURL(url); };
        frame.onload = () => {
          const printWindow = frame.contentWindow;
          if (!printWindow) { cleanup(); this.errorMsg.set('Không mở được hộp thoại in.'); return; }
          printWindow.addEventListener('afterprint', cleanup, { once: true });
          printWindow.focus();
          printWindow.print();
        };
        frame.src = url;
        document.body.appendChild(frame);
        setTimeout(cleanup, 300000);
      },
      error: err => this.errorMsg.set('In bộ giấy thất bại: ' + (err?.error?.error || err?.message)),
    });
  }

  statusDisplay(status: string): string {
    return ({ DRAFT: 'Bản nháp', PRINTED: 'Bản nháp', ISSUED: 'Chính thức', SIGNED: 'Chính thức', CLOSED: 'Chính thức', CANCELLED: 'Đã thu hồi', DELETED: 'Đã xóa' } as Record<string, string>)[status] || status;
  }

  markCancelled() {
    const reason = window.prompt('Lý do thu hồi bộ giấy đã lấy số:')?.trim();
    if (reason) this.changeStatus({ status: 'CANCELLED', cancellationReason: reason });
  }

  issueTrip() {
    this.numberingOpen.set(true);
  }

  replaceTrip() {
    const reason = window.prompt('Lý do tạo bản thay thế (bản cũ chỉ bị hủy khi bản mới được lấy số):')?.trim();
    if (!reason) return;
    this.api.createReplacement(this.tripId, reason).subscribe({
      next: result => this.router.navigate(['/travel/trips', result.tripId, 'edit']),
      error: err => this.errorMsg.set(err?.error?.error || err?.message || 'Không tạo được bản thay thế.'),
    });
  }

  openReplacedTrip() {
    const oldTripId = this.trip()?.replacesTripId;
    if (oldTripId) this.router.navigate(['/travel/trips', oldTripId]);
  }

  changeStatus(request: ChangeTripStatusRequest) {
    this.api.changeTripStatus(this.tripId, request).subscribe({
      next: () => {
        this.loadTrip();
      },
      error: (err) => {
        this.errorMsg.set(
          'Cập nhật thất bại: ' + (err?.error?.error || err?.message),
        );
      },
    });
  }

  onEditOrder(orderId: number) {
    this.router.navigate(['/travel/orders', orderId, 'edit']);
  }

  onBack() {
    this.router.navigate(['/travel/trips']);
  }
}
