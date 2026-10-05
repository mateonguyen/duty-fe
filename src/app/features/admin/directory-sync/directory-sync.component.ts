import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface SyncSettings {
  rootSourceOrgId: string; rootOrgCode: string; enabled: boolean;
  intervalMinutes: number; maxRemovalPercent: number; lastSuccessAt: string | null;
}
interface SyncRun {
  id: number; requestedBy: string; requestedAt: string; status: string;
  organizationCount: number; personnelCount: number; message: string;
}
interface SyncStatus {
  mode?: string;
  settings: SyncSettings; runs: SyncRun[]; organizationCount: number;
  personnelCount: number; positionCount: number; rankCount: number;
}
interface Person { username: string; fullName: string; orgCode: string; unitName: string; positionName: string; }
interface Organization { sourceId: string; code: string; name: string; parentSourceId: string | null; }

@Component({
  standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <div class="directory-page">
      <header><div><h1>Đồng bộ danh mục cán bộ</h1><p>Dữ liệu dùng chung cho lịch trực, giấy đi đường và giấy giới thiệu.</p></div>
        <button type="button" (click)="refresh()" [disabled]="loading">Làm mới</button></header>
      <p *ngIf="error" class="notice error" role="alert">{{ error }}</p>
      <p *ngIf="message" class="notice success" role="status">{{ message }}</p>
      <p class="notice" *ngIf="status?.mode === 'Local'">Phần mềm chính dùng danh mục PostgreSQL. Chọn nguồn, ánh xạ và chạy đồng bộ VBĐH trong app quản trị vận hành DutyRoster Ops; trạng thái và kết quả đã ghi được theo dõi tại đây.</p>
      <p class="notice" *ngIf="status && status.mode !== 'Local' && !status.settings.lastSuccessAt">Chưa đồng bộ thành công. Nhập ID đơn vị gốc trên VBĐH, lưu cấu hình rồi chạy lần đầu.</p>
      <section class="metrics" *ngIf="status">
        <article><span>Đơn vị hoạt động</span><strong>{{ status.organizationCount }}</strong></article>
        <article><span>Cán bộ hoạt động</span><strong>{{ status.personnelCount }}</strong></article>
        <article><span>Chức vụ / cấp bậc</span><strong>{{ status.positionCount }} / {{ status.rankCount }}</strong></article>
        <article><span>Thành công gần nhất</span><strong class="date">{{ (status.settings.lastSuccessAt | date:'dd/MM/yyyy HH:mm') || 'Chưa đồng bộ' }}</strong></article>
      </section>
      <section class="panel" *ngIf="status?.mode !== 'Local'">
        <h2>Cấu hình phạm vi và lịch chạy</h2>
        <form (ngSubmit)="save()" #settingsForm="ngForm">
          <div class="fields">
            <label>ID đơn vị gốc trên VBĐH<input name="root" [(ngModel)]="settings.rootSourceOrgId" required maxlength="50" [readonly]="!!status?.settings?.lastSuccessAt || busy" placeholder="ID thực tế của Cục, ví dụ ID của H04" />
              <small>ID nguồn khác với mã hiển thị. Phạm vi được cố định sau lần đồng bộ thành công đầu tiên.</small></label>
            <label>Khoảng chạy (phút)<input name="interval" type="number" [(ngModel)]="settings.intervalMinutes" required min="1" max="1440" /></label>
            <label>Ngưỡng loại bỏ tối đa (%)<input name="removal" type="number" [(ngModel)]="settings.maxRemovalPercent" required min="0" max="100" />
              <small>Job dừng nếu tỷ lệ cán bộ hoặc đơn vị bị loại bỏ vượt ngưỡng. Kiểm tra nguồn trước khi tăng.</small></label>
          </div>
          <label class="toggle"><input name="enabled" type="checkbox" [(ngModel)]="settings.enabled" /> Tự động đồng bộ định kỳ</label>
          <div class="actions"><button type="submit" [disabled]="saving || busy || settingsForm.invalid">{{ saving ? 'Đang lưu…' : 'Lưu cấu hình' }}</button>
            <button type="button" class="primary" (click)="run()" [disabled]="saving || busy || !status?.settings?.rootSourceOrgId">{{ busy ? 'Đang chờ / đang chạy…' : 'Chạy đồng bộ ngay' }}</button></div>
        </form>
        <p class="muted">Phạm vi: {{ status?.settings?.rootOrgCode || 'Chưa xác định' }}. Khi nguồn gián đoạn, dữ liệu thành công gần nhất được giữ lại.</p>
      </section>
      <section class="panel" *ngIf="status?.mode !== 'Local'"><h2>Lịch sử đồng bộ</h2><p class="muted">30 lần gần nhất. Tự cập nhật mỗi 5 giây.</p>
        <div class="table-wrap"><table><thead><tr><th>Thời điểm</th><th>Người chạy</th><th>Trạng thái</th><th>Đơn vị / cán bộ</th><th>Kết quả</th></tr></thead>
          <tbody><tr *ngFor="let item of status?.runs"><td>{{ item.requestedAt | date:'dd/MM/yyyy HH:mm:ss' }}</td><td>{{ item.requestedBy }}</td>
            <td><span class="badge" [class.failed]="item.status === 'Failed'" [class.done]="item.status === 'Succeeded'">{{ statusLabel(item.status) }}</span></td>
            <td>{{ item.organizationCount }} / {{ item.personnelCount }}</td><td>{{ item.message || 'Đang xử lý' }}</td></tr>
            <tr *ngIf="!status?.runs?.length"><td colspan="5">Chưa có lần đồng bộ nào.</td></tr></tbody></table></div>
      </section>
      <section class="panel"><h2>Danh mục cán bộ nội bộ</h2><p class="muted">Chỉ hiển thị cán bộ hoạt động trong phạm vi đã cấu hình.</p>
        <form class="search" (ngSubmit)="search(1)"><label>Tìm theo tên hoặc tài khoản<input name="query" [(ngModel)]="query" placeholder="Họ tên hoặc username" /></label><button type="submit">Tìm kiếm</button></form>
        <div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Đơn vị</th><th>Chức vụ</th></tr></thead><tbody>
          <tr *ngFor="let person of people"><td>{{ person.username }}</td><td>{{ person.fullName }}</td><td>{{ person.unitName }} <small>{{ person.orgCode }}</small></td><td>{{ person.positionName }}</td></tr>
          <tr *ngIf="!people.length"><td colspan="4">Không có cán bộ phù hợp.</td></tr></tbody></table></div>
        <div class="actions"><button (click)="search(page - 1)" [disabled]="page <= 1">Trang trước</button><span>Trang {{ page }} · {{ total }} cán bộ</span><button (click)="search(page + 1)" [disabled]="page * 50 >= total">Trang sau</button></div>
      </section>
      <details class="panel"><summary>Danh mục đơn vị nội bộ ({{ organizations.length }})</summary>
        <div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên đơn vị</th><th>ID nguồn</th><th>ID cha</th></tr></thead><tbody>
          <tr *ngFor="let org of organizations"><td>{{ org.code }}</td><td>{{ org.name }}</td><td>{{ org.sourceId }}</td><td>{{ org.parentSourceId || 'Đơn vị gốc' }}</td></tr>
          <tr *ngIf="!organizations.length"><td colspan="4">Chưa có đơn vị hoạt động được đồng bộ.</td></tr></tbody></table></div>
      </details>
    </div>`,
  styles: [`
    .directory-page{max-width:1200px;margin:auto;padding:1.5rem;color:var(--text-color,#172033)}
    header,.actions{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}h1{font-size:1.65rem;margin:0}h2{font-size:1.15rem;margin:0 0 1rem}p,small,.muted{color:var(--text-color-secondary,#617083)}
    .panel,.metrics article{background:var(--surface-card,#fff);border:1px solid var(--surface-border,#dfe5ed);border-radius:12px;padding:1.3rem}.panel{margin-top:1.25rem}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-top:1rem}.metrics span{display:block;font-size:.9rem;color:var(--text-color-secondary,#617083)}strong{display:block;font-size:1.75rem;margin-top:.5rem}strong.date{font-size:1rem}
    .fields{display:grid;grid-template-columns:2fr 1fr 1fr;gap:1rem}label{display:flex;flex-direction:column;gap:.45rem;font-weight:500}small{font-weight:400;font-size:.8rem;display:block}input{border:1px solid var(--surface-border,#cbd5e1);border-radius:6px;padding:.7rem;background:var(--surface-ground,#f8fafc);color:inherit;width:100%;box-sizing:border-box}input[readonly]{opacity:.7}.toggle{flex-direction:row;align-items:center;margin:1rem 0}.toggle input{width:auto}
    button{border:1px solid var(--surface-border,#cbd5e1);background:var(--surface-card,#fff);color:inherit;padding:.65rem 1rem;border-radius:6px;cursor:pointer}.primary{background:#2563eb;color:white;border-color:#2563eb}button:disabled{opacity:.5;cursor:default}.notice{background:#eff6ff;color:#1e40af;padding:1rem;border-radius:8px}.error{background:#fef2f2;color:#991b1b}.success{background:#ecfdf5;color:#065f46}
    .table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:.8rem;border-bottom:1px solid var(--surface-border,#e2e8f0)}th{color:var(--text-color-secondary,#617083);white-space:nowrap}.badge{padding:.25rem .5rem;border-radius:4px;background:#eff6ff;color:#1e40af;white-space:nowrap}.failed{background:#fef2f2;color:#991b1b}.done{background:#ecfdf5;color:#065f46}.search{display:flex;gap:1rem;align-items:flex-end;margin-bottom:1rem}.search label{flex:1}.actions{margin-top:1rem;justify-content:flex-start}
    @media(max-width:800px){.metrics{grid-template-columns:repeat(2,1fr)}.fields{grid-template-columns:1fr}.directory-page{padding:1rem}}`],
})
export class DirectorySyncComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private api = `${environment.apiBaseUrl}/api/directory-sync`;
  private polling?: Subscription;
  status?: SyncStatus;
  settings: SyncSettings = { rootSourceOrgId: '', rootOrgCode: '', enabled: false, intervalMinutes: 15, maxRemovalPercent: 20, lastSuccessAt: null };
  loading = false; saving = false; error = ''; message = '';
  people: Person[] = []; query = ''; page = 1; total = 0;
  organizations: Organization[] = [];
  get busy(): boolean { return !!this.status?.runs.some(x => x.status === 'Queued' || x.status === 'Running'); }
  ngOnInit(): void { this.refresh(true); this.search(1); this.polling = timer(5000, 5000).subscribe(() => this.refresh()); }
  ngOnDestroy(): void { this.polling?.unsubscribe(); }
  refresh(reset = false): void {
    if (this.loading) return;
    this.loading = true;
    this.http.get<SyncStatus>(this.api).subscribe({ next: value => {
      const changed = value.settings.lastSuccessAt !== this.status?.settings.lastSuccessAt;
      const first = !this.status;
      if (first || reset) this.settings = { ...value.settings };
      this.status = value; this.loading = false;
      if (changed) this.search(this.page);
      if (changed || first || reset) this.http.get<Organization[]>(`${this.api}/organizations`).subscribe({
        next: organizations => this.organizations = organizations,
        error: () => this.error = 'Không tải được danh mục đơn vị.' });
    }, error: err => { this.loading = false; this.error = err.error?.error || 'Không tải được trạng thái đồng bộ.'; } });
  }
  save(): void {
    this.saving = true; this.error = ''; this.message = '';
    this.http.put<SyncSettings>(`${this.api}/settings`, this.settings, { headers: { 'X-Duty-Admin': '1' } }).subscribe({ next: value => {
      this.settings = { ...value }; if (this.status) this.status.settings = value;
      this.saving = false; this.message = 'Đã lưu cấu hình đồng bộ.';
    }, error: err => { this.saving = false; this.error = err.error?.error || 'Không lưu được cấu hình. Kiểm tra ID gốc và các giá trị nhập.'; } });
  }
  run(): void {
    this.saving = true; this.error = ''; this.message = '';
    this.http.post(`${this.api}/run`, {}, { headers: { 'X-Duty-Admin': '1' } }).subscribe({ next: () => {
      this.saving = false; this.message = 'Đã đưa job vào hàng đợi.'; this.refresh();
    }, error: err => { this.saving = false; this.error = err.error?.error || 'Không thể chạy đồng bộ.'; } });
  }
  search(page: number): void {
    this.http.get<{ items: Person[]; total: number; page: number }>(`${this.api}/personnel`, { params: { q: this.query, page } })
      .subscribe({ next: value => { this.people = value.items; this.total = value.total; this.page = value.page; },
        error: err => { this.error = err.error?.error || 'Không tải được danh mục cán bộ.'; } });
  }
  statusLabel(status: string): string { return ({ Queued: 'Chờ chạy', Running: 'Đang chạy', Succeeded: 'Thành công', Failed: 'Thất bại' } as Record<string, string>)[status] || status; }
}
