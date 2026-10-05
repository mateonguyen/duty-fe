import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnInit, Output, signal } from '@angular/core';
import { TravelTripDetailDto } from '../models/travel.models';
import { TravelApiService } from '../services/travel-api.service';
import { SystemConfigService } from '../../admin/system-config/system-config.service';

@Component({
  selector: 'app-numbering-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="numbering-backdrop" (mousedown)="dismiss()">
      <section class="numbering-dialog" role="dialog" aria-modal="true" aria-labelledby="numbering-title" (mousedown)="$event.stopPropagation()">
        <header class="numbering-header">
          <div>
            <div class="numbering-kicker">GIẤY ĐI ĐƯỜNG</div>
            <h2 id="numbering-title">{{ completed() ? 'Đã lấy số giấy' : 'Lấy số cho bộ giấy' }}</h2>
            <p>{{ completed() ? 'Các số vừa cấp được ghi dưới đây.' : 'Kiểm tra các giấy trong bộ trước khi cấp số tự động.' }}</p>
          </div>
          <button type="button" class="numbering-close" aria-label="Đóng" (click)="dismiss()">×</button>
        </header>
        <div class="numbering-body" *ngIf="trip() as item; else loadingState">
          <div class="numbering-summary">
            <div><span>Mã bộ</span><strong>{{ item.tripNo }}</strong></div>
            <div><span>Số giấy</span><strong>{{ item.orders.length }}</strong></div>
            <div><span>Công lệnh</span><strong>{{ item.missionNo || 'Chưa có' }}</strong></div>
            <div><span>Người ký</span><strong>{{ item.signerName || 'Chưa có' }}</strong></div>
            <div><span>Thời gian công tác</span><strong>{{ item.fromDate ? (item.fromDate | date:'dd/MM/yyyy') : '—' }} – {{ item.toDate ? (item.toDate | date:'dd/MM/yyyy') : '—' }}</strong></div>
            <div><span>Nội dung</span><strong>{{ item.purpose || 'Chưa có' }}</strong></div>
          </div>
          <div class="numbering-warning" *ngIf="!completed()">
            Mỗi giấy sẽ nhận một số riêng. Sau khi lấy số, nội dung bị khóa; nếu sai cần thu hồi và ghi lý do. In giấy không thay đổi trạng thái.
          </div>
          <div class="numbering-section-title">Danh sách giấy trong bộ</div>
          <div class="numbering-list">
            <div class="numbering-row" *ngFor="let order of item.orders; let i = index">
              <span class="numbering-index">{{ i + 1 }}</span>
              <div class="numbering-person"><strong>{{ order.displayNameWithRank || order.fullName }}</strong><small>{{ order.unitName }}</small></div>
              <div class="numbering-number"><small>Số giấy</small><strong>{{ completed() ? formatOrderNo(order.orderNo) : 'Cấp tự động khi xác nhận' }}</strong></div>
            </div>
          </div>
          <div class="numbering-issued" *ngIf="completed()">Lấy số lúc {{ item.issuedAt | date:'dd/MM/yyyy HH:mm' }} · {{ item.issuedBy }}</div>
        </div>
        <ng-template #loadingState><div class="numbering-loading">{{ loading() ? 'Đang tải bộ giấy…' : 'Không tải được bộ giấy.' }}</div></ng-template>
        <p class="numbering-error" *ngIf="error()" role="alert">{{ error() }}</p>
        <footer class="numbering-footer">
          <button type="button" class="numbering-secondary" (click)="dismiss()">{{ completed() ? 'Đóng' : 'Hủy' }}</button>
          <button *ngIf="!completed()" type="button" class="numbering-primary" [disabled]="loading() || saving() || !trip()?.canTakeNumber || !trip()?.orders?.length" (click)="takeNumbers()">
            {{ saving() ? 'Đang cấp số…' : 'Lấy số tự động' }}
          </button>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    .numbering-backdrop{position:fixed;inset:0;z-index:1100;background:rgba(16,35,30,.48);display:grid;place-items:center;padding:20px}
    .numbering-dialog{width:min(700px,100%);max-height:min(780px,calc(100vh - 40px));display:flex;flex-direction:column;background:#fff;border-radius:16px;box-shadow:0 22px 65px rgba(0,0,0,.24);color:#183128}
    .numbering-header{display:flex;justify-content:space-between;gap:20px;padding:22px 24px 16px;border-bottom:1px solid #e2ebe5}
    .numbering-kicker{font-size:11px;font-weight:750;letter-spacing:.08em;color:#006843}
    h2{font-size:21px;margin:5px 0 4px}p{margin:0}.numbering-header p{font-size:13px;color:#64756b}
    .numbering-close{border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#607268;align-self:flex-start}
    .numbering-body{padding:18px 24px;overflow:auto;min-height:0}
    .numbering-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}
    .numbering-summary>div{border:1px solid #e1eae4;border-radius:9px;padding:9px 12px;display:flex;flex-direction:column;gap:3px;min-width:0}
    .numbering-summary span,.numbering-number small{font-size:11px;color:#718075}.numbering-summary strong{font-size:13px;overflow-wrap:anywhere}
    .numbering-warning{font-size:12px;line-height:1.5;background:#fff7e8;border:1px solid #f2dfb8;border-radius:9px;padding:11px 12px;margin-bottom:18px}
    .numbering-section-title{font-weight:700;font-size:13px;margin:0 0 9px}.numbering-list{border:1px solid #e1eae4;border-radius:10px;overflow:auto;max-height:330px}
    .numbering-row{display:flex;align-items:center;gap:12px;padding:11px 12px}.numbering-row+.numbering-row{border-top:1px solid #edf2ee}
    .numbering-index{flex:0 0 25px;height:25px;display:grid;place-items:center;border-radius:50%;background:#e8f4ed;color:#006843;font-size:12px;font-weight:700}
    .numbering-person{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.numbering-person strong{font-size:13px}.numbering-person small{color:#64756b}
    .numbering-number{min-width:150px;display:flex;flex-direction:column;align-items:flex-end;gap:2px;text-align:right}.numbering-number strong{font-size:12px;color:#006843}
    .numbering-issued{font-size:12px;color:#526b5d;margin-top:12px}.numbering-loading{padding:35px;text-align:center;color:#64756b}
    .numbering-error{color:#b42318;background:#fff0ee;margin:0 24px 10px;padding:10px;border-radius:8px;font-size:12px}
    .numbering-footer{padding:14px 24px 20px;display:flex;justify-content:flex-end;gap:9px;border-top:1px solid #e2ebe5}
    .numbering-footer button{border-radius:8px;padding:9px 15px;font:inherit;font-size:13px;font-weight:650;cursor:pointer}
    .numbering-secondary{background:#fff;border:1px solid #b8d0c1;color:#145c3d}.numbering-primary{background:#006843;border:1px solid #006843;color:#fff}.numbering-primary:disabled{opacity:.55;cursor:default}
    @media(max-width:550px){.numbering-summary{grid-template-columns:1fr}.numbering-row{flex-wrap:wrap}.numbering-number{align-items:flex-start;text-align:left;margin-left:37px}}
  `],
})
export class NumberingDialogComponent implements OnInit {
  @Input({ required: true }) tripId!: number;
  @Output() closed = new EventEmitter<void>();
  @Output() numbered = new EventEmitter<void>();
  trip = signal<TravelTripDetailDto | null>(null);
  loading = signal(true);
  saving = signal(false);
  completed = signal(false);
  error = signal('');
  unitCode = signal('');

  constructor(private api: TravelApiService, private configs: SystemConfigService) {}

  ngOnInit(): void {
    this.configs.fetchAll().subscribe({
      next: configs => this.unitCode.set((configs.find(x => x.key === 'CucCode')?.value || configs.find(x => x.key === 'UnitCode')?.value || '').trim()),
      error: () => this.unitCode.set(''),
    });
    this.api.getTrip(this.tripId).subscribe({
      next: trip => { this.trip.set(trip); this.loading.set(false); },
      error: err => { this.error.set(err?.error?.error || err?.message || 'Không tải được bộ giấy.'); this.loading.set(false); },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.dismiss(); }

  dismiss(): void { if (!this.saving()) this.closed.emit(); }

  formatOrderNo(raw: string): string {
    if (!raw || !/^\d{8,}$/.test(raw)) return raw || '—';
    const suffix = this.unitCode();
    return `${Number(raw.slice(4))}/GĐĐ${suffix ? '-' + suffix : ''}`;
  }

  takeNumbers(): void {
    if (this.saving() || !this.trip()?.canTakeNumber) return;
    this.saving.set(true);
    this.error.set('');
    this.api.changeTripStatus(this.tripId, { status: 'ISSUED' }).subscribe({
      next: trip => { this.trip.set(trip); this.saving.set(false); this.completed.set(true); this.numbered.emit(); },
      error: err => { this.saving.set(false); this.error.set(err?.error?.error || err?.message || 'Lấy số giấy thất bại.'); },
    });
  }
}
