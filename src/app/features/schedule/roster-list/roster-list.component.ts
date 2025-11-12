import {
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
  ElementRef,
  computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Table } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { RosterListItem, RosterStatus } from '../schedule';
import { RosterApiService } from '../roster-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ScopeService } from '../../../core/services/scope.service';
import { DiagnosticsService } from '../../../core/diagnostics/diagnostics.service';

@Component({
  standalone: true,
  selector: 'app-roster-list',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    DropdownModule,
    InputTextModule,
    TooltipModule,
    DatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './roster-list.component.html',
  styleUrls: ['./roster-list.component.scss'],
})
export class RosterListComponent implements OnInit {
  private confirm = inject(ConfirmationService);
  private api = inject(RosterApiService);
  private toast = inject(MessageService);
  private auth = inject(AuthService);
  private scopeService = inject(ScopeService);
  private router = inject(Router);
  private diag = inject(DiagnosticsService, { optional: true });

  @ViewChild('dt') table!: Table;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  rosters = signal<RosterListItem[]>([]);
  loading = signal(false);

  // Active scope for roster.view
  activeScope = computed(() => this.scopeService.getActiveScope('roster.view'));
  activeOrgId = computed(() => this.activeScope()?.orgId || null);

  // Filter controls
  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth() + 1;
  selectedStatus: RosterStatus | 'ALL' = 'ALL';

  yearOptions: { label: string; value: number }[] = [];
  monthOptions = [
    { label: 'Tháng 1', value: 1 },
    { label: 'Tháng 2', value: 2 },
    { label: 'Tháng 3', value: 3 },
    { label: 'Tháng 4', value: 4 },
    { label: 'Tháng 5', value: 5 },
    { label: 'Tháng 6', value: 6 },
    { label: 'Tháng 7', value: 7 },
    { label: 'Tháng 8', value: 8 },
    { label: 'Tháng 9', value: 9 },
    { label: 'Tháng 10', value: 10 },
    { label: 'Tháng 11', value: 11 },
    { label: 'Tháng 12', value: 12 },
  ];
  statusOptions = [
    { label: 'Tất cả trạng thái', value: 'ALL' },
    { label: 'Bản thảo', value: 'DRAFT' },
    { label: 'Đã công bố', value: 'PUBLISHED' },
    { label: 'Đã khóa', value: 'LOCKED' },
  ];

  ngOnInit() {
    this.initYearOptions();
    this.initializeAndLoadRosters();
  }

  async initializeAndLoadRosters() {
    // Guard ensures authentication; proceed directly
    // if (!this.auth.isAuthenticated()) {
    //   this.router.navigate(['/login']);
    //   return;
    // }

    // Runtime scopes: load from API then ensure active selection
    this.scopeService.load('roster.view').subscribe({
      next: () => {
        this.scopeService.ensureActive('roster.view');
        const scope = this.scopeService.getActiveScope('roster.view');
        if (!scope) {
          console.warn('[RosterList] No active scope after load');
          return; // render friendly empty state
        }
        this.loadRosters();
      },
      error: (err) => {
        console.error(
          '[RosterList] Failed to load scopes for roster.view:',
          err
        );
      },
    });
  }

  initYearOptions() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      this.yearOptions.push({ label: `Năm ${i}`, value: i });
    }
  }

  loadRosters() {
    this.loading.set(true);

    // Get orgId from active scope
    const orgId = this.activeOrgId();
    if (!orgId) {
      console.warn('[RosterList] No active orgId - cannot load rosters');
      this.loading.set(false);
      return;
    }

    console.debug(
      `[RosterList] Loading rosters for orgId=${orgId}, year=${this.selectedYear}, month=${this.selectedMonth}`
    );

    // RosterApiService expects number unitId; if orgId string contains non-digits we skip load
    const numericId = /^[0-9]+$/.test(orgId) ? Number(orgId) : null;
    if (numericId === null) {
      console.warn(
        '[RosterList] orgId is non-numeric; skipping roster load:',
        orgId
      );
      this.loading.set(false);
      return;
    }

    this.api
      .getByMonth(numericId, this.selectedYear, this.selectedMonth)
      .subscribe({
        next: (data) => {
          console.debug('[RosterList] Loaded rosters:', data);
          this.rosters.set(data);
          this.loading.set(false);
          this.diag?.incRosterLoad();
        },
        error: (err) => {
          console.error('[RosterList] Load rosters failed:', err);
          this.toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không thể tải danh sách lịch trực',
          });
          this.loading.set(false);
        },
      });
  }

  get filteredRosters() {
    let result = this.rosters();
    if (this.selectedStatus !== 'ALL') {
      result = result.filter((r) => r.status === this.selectedStatus);
    }
    return result;
  }

  onFilterChange() {
    this.loadRosters();
  }

  onSearch(value: string) {
    this.table?.filterGlobal(value, 'contains');
  }

  getSeverity(s: RosterStatus) {
    switch (s) {
      case 'DRAFT':
        return 'warning';
      case 'PUBLISHED':
        return 'success';
      case 'LOCKED':
        return 'secondary';
    }
  }

  getStatusLabel(s: RosterStatus) {
    switch (s) {
      case 'DRAFT':
        return 'Bản thảo';
      case 'PUBLISHED':
        return 'Đã công bố';
      case 'LOCKED':
        return 'Đã khóa';
      default:
        return s;
    }
  }

  publish(row: RosterListItem) {
    this.confirm.confirm({
      header: 'Công bố lịch',
      message: `Công bố "${row.name}" cho toàn đơn vị?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Công bố',
      rejectLabel: 'Hủy',
      accept: () => {
        this.api.publish(row.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã công bố lịch trực',
            });
            this.loadRosters();
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: err.error || 'Không thể công bố lịch',
            });
          },
        });
      },
    });
  }

  unpublish(row: RosterListItem) {
    this.confirm.confirm({
      header: 'Hủy công bố',
      message: `Hủy công bố "${row.name}"? Nhân viên sẽ không còn thấy lịch này.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Hủy công bố',
      rejectLabel: 'Đóng',
      accept: () => {
        this.api.unpublish(row.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã hủy công bố lịch',
            });
            this.loadRosters();
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: err.error || 'Không thể hủy công bố',
            });
          },
        });
      },
    });
  }

  lock(row: RosterListItem) {
    this.confirm.confirm({
      header: 'Khóa lịch',
      message: `Khóa "${row.name}" (chỉ đọc)?`,
      icon: 'pi pi-lock',
      acceptLabel: 'Khóa',
      rejectLabel: 'Hủy',
      accept: () => {
        this.api.lock(row.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã khóa lịch trực',
            });
            this.loadRosters();
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: err.error || 'Không thể khóa lịch',
            });
          },
        });
      },
    });
  }

  delete(row: RosterListItem) {
    this.confirm.confirm({
      header: 'Xóa lịch',
      message: `Xóa vĩnh viễn "${row.name}"? Hành động không thể hoàn tác.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      accept: () => {
        this.api.delete(row.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Đã xóa lịch trực',
            });
            this.loadRosters();
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Lỗi',
              detail: err.error || 'Không thể xóa lịch',
            });
          },
        });
      },
    });
  }
}
