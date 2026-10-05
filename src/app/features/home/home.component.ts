import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HomeOverviewService } from './home-overview.service';
import { HomeAssignment, HomeOverviewDto, SectionState, TravelStatusCount } from './home-overview.model';
import { NotificationService } from '../../shared/services/notification.service';
import { NotificationDto } from '../../shared/models/notification.model';
import { DailyBarChartComponent } from '../../shared/components/charts/daily-bar-chart.component';
import { StatusDonutChartComponent } from '../../shared/components/charts/status-donut-chart.component';
import { UiSelectComponent, UiSelectOption } from '../../shared/components/ui-select/ui-select.component';

@Component({
  selector: 'app-home', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DailyBarChartComponent, StatusDonutChartComponent, UiSelectComponent],
  templateUrl: './home.component.html', styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private readonly service = inject(HomeOverviewService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  overview?: HomeOverviewDto;
  scopeOptions: { code: string; name: string }[] = [];
  scopeCode = '';
  period = '';
  loading = true;
  error = '';
  activeTab: 'today' | 'upcoming' = 'today';
  notifications: NotificationDto[] = [];
  totalUnread = 0;
  loadingNotifications = false;
  notificationError = '';
  readonly skeletons = [0, 1, 2, 3];

  ngOnInit(): void { this.loadOverview(); this.loadNotifications(); }

  loadOverview(): void {
    this.request?.unsubscribe();
    this.loading = true; this.error = ''; this.overview = undefined;
    this.request = this.service.getOverview(this.scopeCode || undefined, this.period || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false))
      .subscribe({ next: data => {
        if (!data?.roster || !data?.travel || !data?.capabilities || !Array.isArray(data.scopes)) {
          this.error = 'Dữ liệu tổng quan chưa đúng định dạng. Hãy kiểm tra phiên bản backend.'; return;
        }
        this.overview = data; this.scopeOptions = data.scopes; this.scopeCode = data.scopeCode; this.period = data.period;
      }, error: err => {
        this.error = err.status === 401 ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại từ menu tài khoản.'
          : err.status === 403 ? 'Bạn không có quyền xem phạm vi đã chọn. Hãy chọn công việc của tôi hoặc liên hệ quản trị.'
          : err.status === 400 ? 'Kỳ báo cáo hoặc phạm vi không hợp lệ. Kiểm tra bộ lọc rồi thử lại.'
          : 'Không tải được tổng quan. Kiểm tra kết nối rồi thử lại.';
      } });
  }

  get personal(): boolean { return this.overview?.scopeCode === 'mine'; }
  get scopeChoices(): UiSelectOption[] { return [{ value: 'mine', label: 'Công việc của tôi', detail: 'Lịch và giấy của tài khoản đăng nhập' }, ...this.scopeOptions.map(x => ({ value: x.code, label: x.name, detail: x.code }))]; }
  get periodChoices(): UiSelectOption[] { return this.periodOptions.map(x => ({ value: x.value, label: x.label })); }
  get assignments(): HomeAssignment[] { return (this.activeTab === 'today' ? this.overview?.roster.todayAssignments : this.overview?.roster.upcomingAssignments) || []; }
  get assignmentCount(): number { return (this.activeTab === 'today' ? this.overview?.roster.todayCount : this.overview?.roster.upcomingCount) || 0; }
  get hasDailyCounts(): boolean { return !!this.overview?.roster.dailyCounts.some(x => x.count > 0); }
  sectionHint(state: SectionState): string { return state === 'error' ? 'Chưa tải được dữ liệu' : state === 'unavailable' ? 'Chưa có quyền xem trong phạm vi này' : ''; }
  unsignedTravelCount(statuses: TravelStatusCount[]): number { return statuses.filter(x => ['DRAFT', 'PRINTED'].includes(x.code)).reduce((total, x) => total + x.count, 0); }
  displayTravelStatuses(statuses: TravelStatusCount[]): TravelStatusCount[] {
    const groups: TravelStatusCount[] = [
      { code: 'DRAFT', name: 'Bản nháp', count: 0 },
      { code: 'ISSUED', name: 'Chính thức', count: 0 },
      { code: 'CANCELLED', name: 'Đã thu hồi', count: 0 },
      { code: 'DELETED', name: 'Đã xóa', count: 0 },
      { code: 'OTHER', name: 'Trạng thái khác', count: 0 },
    ];
    const byCode = new Map(groups.map(group => [group.code, group]));
    for (const item of statuses) {
      const code = item.code.toUpperCase();
      const groupCode = code === 'PRINTED' ? 'DRAFT'
        : code === 'SIGNED' || code === 'CLOSED' ? 'ISSUED'
        : byCode.has(code) ? code : 'OTHER';
      byCode.get(groupCode)!.count += item.count;
    }
    return groups.filter(group => group.count > 0);
  }
  dateOnly(value: string): string { return value ? value.split('-').reverse().join('/') : ''; }
  get todayLabel(): string {
    const day = this.overview?.today;
    return day ? new Date(`${day}T12:00:00+07:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) : 'Tổng quan lịch trực và giấy đi đường';
  }
  get periodLabel(): string { return this.period ? `tháng ${this.period.slice(5)}/${this.period.slice(0, 4)}` : 'kỳ đã chọn'; }
  get periodOptions(): { value: string; label: string }[] {
    const today = this.overview?.today || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const [year, month] = today.split('-').map(Number);
    const options = Array.from({ length: 27 }, (_, i) => {
      const date = new Date(Date.UTC(year, month - 1 + 3 - i, 1));
      const value = date.toISOString().slice(0, 7);
      return { value, label: `Tháng ${value.slice(5)}/${value.slice(0, 4)}` };
    });
    if (this.period && !options.some(x => x.value === this.period)) options.push({ value: this.period, label: `Tháng ${this.period.slice(5)}/${this.period.slice(0, 4)}` });
    return options;
  }
  shortName(name: string): string { const parts = name.trim().split(/\s+/); return (parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : name.slice(0, 2)).toLocaleUpperCase('vi-VN'); }
  tabKey(event: KeyboardEvent): void {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); this.activeTab = event.key === 'Home' ? 'today' : event.key === 'End' ? 'upcoming' : this.activeTab === 'today' ? 'upcoming' : 'today';
      document.getElementById(`duty-${this.activeTab}-tab`)?.focus();
    }
  }
  loadNotifications(): void {
    if (this.loadingNotifications) return;
    this.loadingNotifications = true; this.notificationError = '';
    this.notificationService.getMyNotifications(3).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingNotifications = false))
      .subscribe({ next: data => { this.notifications = data.items || []; this.totalUnread = data.totalUnread || 0; }, error: () => { this.notificationError = 'Không tải được thông báo. Bạn có thể thử lại.'; } });
  }
  onNotificationClick(item: NotificationDto): void {
    if (!item.isRead) this.notificationService.markAsRead(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { item.isRead = true; this.totalUnread = Math.max(0, this.totalUnread - 1); },
      error: () => this.notificationError = 'Chưa đánh dấu được thông báo đã đọc. Hãy thử lại.'
    });
    if (item.linkUrl?.startsWith('/') && !item.linkUrl.startsWith('//')) this.router.navigateByUrl(item.linkUrl);
  }
}
