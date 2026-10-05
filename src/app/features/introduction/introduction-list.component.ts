import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePickerModule } from 'primeng/datepicker';
import { UiSelectComponent } from '../../shared/components/ui-select/ui-select.component';
import { IntroductionApiService, IntroductionGroup, IntroductionLetter, printIntroductionPdf } from './introduction-api.service';

@Component({
  selector: 'app-introduction-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePickerModule, UiSelectComponent],
  template: `
    <main class="page">
      <header class="heading">
        <div class="heading-title"><h1>Danh sách giấy giới thiệu</h1><p>Lưu nháp, lấy số và in theo bộ giấy.</p></div>
        <div class="heading-actions"><div class="metrics" aria-label="Thống kê giấy giới thiệu"><span><strong>{{ totalAllLetters() }}</strong> Giấy</span><span><strong>{{ groups().length }}</strong> Bộ giấy</span></div><a class="primary" routerLink="create"><i class="pi pi-plus"></i> Tạo mới</a></div>
      </header>
      <div class="toolbar">
        <label class="search"><i class="pi pi-search"></i><input aria-label="Tìm giấy giới thiệu" placeholder="Tìm số giấy, cán bộ, bộ giấy, nơi đến..." [ngModel]="keyword()" (ngModelChange)="keyword.set($event); page.set(1)" /></label>
        <label class="date-field"><span>Từ</span><p-datepicker [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event); page.set(1)" dateFormat="dd/mm/yy" placeholder="Chọn ngày" [showIcon]="true" [showClear]="true" appendTo="body" /></label>
        <label class="date-field"><span>Đến</span><p-datepicker [ngModel]="toDate()" (ngModelChange)="toDate.set($event); page.set(1)" dateFormat="dd/mm/yy" placeholder="Chọn ngày" [showIcon]="true" [showClear]="true" appendTo="body" /></label>
        <button type="button" class="secondary clear" [disabled]="!keyword() && !fromDate() && !toDate()" (click)="clearFilters()"><i class="pi pi-filter-slash"></i> Xóa lọc</button>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <button type="button" class="secondary print-selected" [disabled]="!selected().size || busy()" (click)="printSelected()"><i class="pi pi-print"></i> In đã chọn ({{ selected().size }})</button>
      </div>
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      <div class="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Chọn trang" [checked]="allPageSelected()" (change)="togglePage($any($event.target).checked)" /></th><th>Số giấy</th><th>Cán bộ</th><th>Kính gửi / nơi đến</th><th>Người cấp giấy</th><th>Ngày cấp</th><th>Hiệu lực đến</th><th>Thao tác</th></tr></thead>
        <tbody>
          @for (group of paged(); track group.id) {
            <tr class="group-row"><td><input type="checkbox" [attr.aria-label]="'Chọn ' + group.displayBatchNo" [checked]="groupSelected(group)" (change)="toggleGroup(group, $any($event.target).checked)" /></td><td colspan="7"><div class="group-content"><span><i class="pi pi-folder"></i> <strong>Bộ giấy giới thiệu</strong> <b class="group-number">{{ group.displayBatchNo }}</b> <small>{{ group.letters.length }} giấy</small> <small class="group-status">{{ group.letters[0].status === 'DRAFT' ? 'Bản nháp' : 'Đã lấy số' }}</small></span><span class="group-actions">@if (group.canEdit) { <a [routerLink]="['groups',group.id,'edit']"><i class="pi pi-pencil"></i> Sửa bộ</a> } @if (group.canTakeNumber) { <button class="take-number" (click)="numberingGroup.set(group)"><i class="pi pi-check"></i> Lấy số giấy</button> } <button (click)="printGroup(group)"><i class="pi pi-print"></i> In cả bộ</button><button title="Xóa bộ" [disabled]="!group.canEdit" (click)="removeGroup(group)"><i class="pi pi-trash"></i></button></span></div></td></tr>
            @for (row of group.letters; track row.id) {
              <tr><td><input type="checkbox" [attr.aria-label]="'Chọn giấy ' + row.displayNumber" [checked]="selected().has(row.id)" (change)="toggle(row.id, $any($event.target).checked)" /></td>
                <td><strong class="number">{{ row.displayNumber }}</strong></td><td><strong>{{ row.rankName }} {{ row.fullName }}</strong><small>{{ row.positionTitle }} · {{ row.unitName }}</small></td>
                <td>{{ row.recipientAgency }}<small>{{ row.destination }}</small></td><td>{{ row.signerName }}<small>{{ row.signerPositionTitle }}</small></td>
                <td>{{ row.issueDate | date:'dd/MM/yyyy' }}</td><td>{{ row.validUntil ? (row.validUntil | date:'dd/MM/yyyy') : '—' }}</td>
                <td class="actions"><button title="Xem PDF" (click)="open(row)"><i class="pi pi-eye"></i></button><button title="In giấy" (click)="print(row)"><i class="pi pi-print"></i></button>@if (row.canEdit) { <a [routerLink]="[row.id,'edit']" title="Sửa giấy"><i class="pi pi-pencil"></i></a> }<button title="Sao chép sang bộ mới" (click)="copy(row)"><i class="pi pi-copy"></i></button><button title="Xóa giấy" [disabled]="!row.canDelete" (click)="remove(row)"><i class="pi pi-trash"></i></button></td>
              </tr>
            }
          } @empty { <tr><td colspan="8" class="empty">{{ loading() ? 'Đang tải...' : 'Chưa có giấy giới thiệu phù hợp.' }}</td></tr> }
        </tbody></table>
        <div class="footer"><span>Bộ <strong>{{ filtered().length ? (page()-1)*pageSize()+1 : 0 }}–{{ Math.min(page()*pageSize(), filtered().length) }}</strong> / {{ filtered().length }} · {{ totalLetters() }} giấy phù hợp</span><div class="footer-controls"><label>Bộ/trang <app-ui-select label="Bộ mỗi trang" [options]="pageSizeChoices" [searchable]="false" [ngModel]="pageSize()" (ngModelChange)="pageSize.set($event); page.set(1)" /></label><span>Trang {{ page() }} / {{ pageCount() }}</span><button (click)="page.set(page()-1)" [disabled]="page() === 1" aria-label="Trang trước">‹</button><button (click)="page.set(page()+1)" [disabled]="page() >= pageCount()" aria-label="Trang sau">›</button></div></div>
      </div>
      @if (numberingGroup(); as group) {
        <div class="dialog-backdrop" (click)="closeNumbering()">
          <section class="numbering-dialog" role="dialog" aria-modal="true" aria-labelledby="numbering-title" (click)="$event.stopPropagation()">
            <header><div><small>GIẤY GIỚI THIỆU</small><h2 id="numbering-title">Lấy số cho bộ giấy</h2><p>Kiểm tra từng giấy trước khi cấp số tự động.</p></div><button type="button" aria-label="Đóng" (click)="closeNumbering()">×</button></header>
            <div class="dialog-body"><div class="dialog-summary"><span>Mã bộ <strong>{{ group.displayBatchNo }}</strong></span><span>Số giấy <strong>{{ group.letters.length }}</strong></span></div>
              <p class="dialog-note">Mỗi giấy nhận một số riêng. Sau khi lấy số, nội dung của cả bộ sẽ bị khóa; thao tác in vẫn dùng được bất kỳ lúc nào.</p>
              <h3>Danh sách giấy trong bộ</h3><div class="dialog-list">@for (row of group.letters; track row.id) { <div><span class="dialog-index">{{ $index + 1 }}</span><span><strong>{{ row.rankName }} {{ row.fullName }}</strong><small>{{ row.unitName }} · Đến {{ row.destination }}</small></span><em>Cấp số khi xác nhận</em></div> }</div>
              @if (numberingError()) { <p class="error" role="alert">{{ numberingError() }}</p> }</div>
            <footer><button type="button" class="secondary" [disabled]="busy()" (click)="closeNumbering()">Hủy</button><button type="button" class="primary" [disabled]="busy()" (click)="takeNumbers(group)">{{ busy() ? 'Đang lấy số…' : 'Lấy số tự động' }}</button></footer>
          </section>
        </div>
      }
    </main>`,
  styleUrls: ['./introduction-list.component.scss'],
})
export class IntroductionListComponent implements OnInit {
  groups = signal<IntroductionGroup[]>([]); loading = signal(false); busy = signal(false); error = signal('');
  numberingGroup = signal<IntroductionGroup | null>(null); numberingError = signal('');
  private printAfterNumbering = false;
  keyword = signal(''); fromDate = signal<Date | null>(null); toDate = signal<Date | null>(null);
  page = signal(1); pageSize = signal(5); selected = signal<Set<number>>(new Set());
  readonly pageSizeChoices = [5, 10, 20].map(value => ({ value, label: String(value) }));
  readonly Math = Math;
  filtered = computed(() => {
    const q = this.keyword().trim().toLocaleLowerCase('vi');
    return this.groups().filter(g => {
      const text = [g.batchNo,g.displayBatchNo,...g.letters.flatMap(x => [x.number,x.displayNumber,x.fullName,x.signerName,x.recipientAgency,x.destination,x.purpose])].join(' ').toLocaleLowerCase('vi');
      return (!q || text.includes(q)) && g.letters.some(x => (!this.fromDate() || x.issueDate >= this.iso(this.fromDate()!)) && (!this.toDate() || x.issueDate <= this.iso(this.toDate()!)));
    });
  });
  totalLetters = computed(() => this.filtered().reduce((sum,g) => sum + g.letters.length, 0));
  totalAllLetters = computed(() => this.groups().reduce((sum,g) => sum + g.letters.length, 0));
  pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  paged = computed(() => this.filtered().slice((this.page()-1)*this.pageSize(), this.page()*this.pageSize()));
  private pendingIssueAndPrintId = 0;
  constructor(private api: IntroductionApiService, private router: Router, private route: ActivatedRoute) {}
  ngOnInit(): void {
    this.pendingIssueAndPrintId = Number(this.route.snapshot.queryParamMap.get('issueAndPrintGroup')) || 0;
    if (this.pendingIssueAndPrintId) this.router.navigate([], { relativeTo: this.route, queryParams: { issueAndPrintGroup: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.load();
  }
  clearFilters(): void { this.keyword.set(''); this.fromDate.set(null); this.toDate.set(null); this.page.set(1); }
  private iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  load(): void { this.loading.set(true); this.api.groups().subscribe({next: x => {
    this.groups.set(x); this.loading.set(false);
    if (this.pendingIssueAndPrintId) {
      const group = x.find(item => item.id === this.pendingIssueAndPrintId);
      this.pendingIssueAndPrintId = 0;
      if (group?.canTakeNumber) { this.printAfterNumbering = true; this.numberingGroup.set(group); }
      else this.error.set('Bộ giấy đã lưu nhưng hiện chưa thể lấy số. Hãy kiểm tra quyền và trạng thái giấy.');
    }
  },error: e => {this.error.set(this.message(e));this.loading.set(false)}}); }
  toggle(id: number, yes: boolean): void { const set = new Set(this.selected()); yes ? set.add(id) : set.delete(id); this.selected.set(set); }
  toggleGroup(g: IntroductionGroup, yes: boolean): void { const set = new Set(this.selected()); for (const x of g.letters) yes ? set.add(x.id) : set.delete(x.id); this.selected.set(set); }
  togglePage(yes: boolean): void { const set = new Set(this.selected()); for (const g of this.paged()) for (const x of g.letters) yes ? set.add(x.id) : set.delete(x.id); this.selected.set(set); }
  groupSelected(g: IntroductionGroup): boolean { return g.letters.length > 0 && g.letters.every(x => this.selected().has(x.id)); }
  allPageSelected(): boolean { return this.paged().length > 0 && this.paged().every(g => this.groupSelected(g)); }
  printSelected(): void { if (!this.selected().size) return; this.busy.set(true); this.api.batch([...this.selected()]).subscribe({next: b => {this.busy.set(false);printIntroductionPdf(b)},error: e => {this.busy.set(false);this.error.set(this.message(e))}}); }
  printGroup(g: IntroductionGroup): void { this.api.groupPdf(g.id).subscribe({next: printIntroductionPdf,error:e=>this.error.set(this.message(e))}); }
  closeNumbering(): void { if (!this.busy()) { this.numberingGroup.set(null); this.numberingError.set(''); this.printAfterNumbering = false; } }
  takeNumbers(group: IntroductionGroup): void {
    this.busy.set(true); this.numberingError.set('');
    this.api.takeNumbers(group.id).subscribe({
      next: () => { const print = this.printAfterNumbering; this.busy.set(false); this.numberingGroup.set(null); this.printAfterNumbering = false; if (print) this.printGroup(group); this.load(); },
      error: e => { this.busy.set(false); this.numberingError.set(this.message(e)); }
    });
  }
  print(row: IntroductionLetter): void { this.api.pdf(row.id).subscribe({next: printIntroductionPdf,error: e => this.error.set(this.message(e))}); }
  open(row: IntroductionLetter): void { this.api.pdf(row.id).subscribe({next: blob => {const url=URL.createObjectURL(blob);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),300000)},error: e => this.error.set(this.message(e))}); }
  copy(row: IntroductionLetter): void { sessionStorage.setItem('introduction-copy', JSON.stringify(row)); this.router.navigate(['/introduction-letters/create']); }
  remove(row: IntroductionLetter): void { if (!confirm(`Xóa giấy ${row.displayNumber}?`)) return; this.api.delete(row.id).subscribe({next:()=>this.load(),error:e=>this.error.set(this.message(e))}); }
  removeGroup(g: IntroductionGroup): void { if (!confirm(`Xóa ${g.displayBatchNo} cùng ${g.letters.length} giấy?`)) return; this.api.deleteGroup(g.id).subscribe({next:()=>this.load(),error:e=>this.error.set(this.message(e))}); }
  private message(e: any): string { return e?.error?.error || e?.message || 'Thao tác thất bại.'; }
}
