import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { RosterApiService } from '../roster-api.service';
import { RosterListItem } from '../schedule';
import { ScopePickerComponent } from '../../../shared/components/scope-picker/scope-picker.component';
import { ScopeRef, ScopeService } from '../../../core/services/scope.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-public-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardModule,
    DropdownModule,
    CalendarModule,
    ButtonModule,
    TableModule,
    TagModule,
    ProgressSpinnerModule,
    ToastModule,
    ScopePickerComponent,
    LoadingSpinnerComponent,
  ],
  providers: [MessageService],
  templateUrl: './public-schedule.component.html',
})
export class PublicScheduleComponent implements OnInit {
  private api = inject(RosterApiService);
  private scopeService = inject(ScopeService);
  private msg = inject(MessageService);
  private router = inject(Router);

  scopes = signal<ScopeRef[]>([]);
  selectedScope = signal<ScopeRef | null>(null);
  selectedMonthValue: Date = new Date();

  get selectedMonth(): Date {
    return this.selectedMonthValue;
  }

  set selectedMonth(value: Date) {
    this.selectedMonthValue = value;
  }

  rosters = signal<RosterListItem[]>([]);
  loading = signal(false);

  monthString = computed(() => {
    const d = this.selectedMonthValue;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  ngOnInit(): void {
    // Load scopes for public roster viewing
    this.scopeService.load('roster.view').subscribe({
      next: (data: ScopeRef[]) => {
        this.scopes.set(data);
        if (data.length > 0) {
          this.selectedScope.set(data[0]);
          this.loadRosters();
        }
      },
      error: () => {
        this.msg.add({
          severity: 'error',
          detail: 'Không tải được danh sách phạm vi',
        });
      },
    });
  }

  onScopeChange(scope: ScopeRef | null): void {
    this.selectedScope.set(scope);
    if (scope) this.loadRosters();
  }

  onMonthChange(): void {
    this.loadRosters();
  }

  loadRosters(): void {
    const scope = this.selectedScope();
    if (!scope) return;

    this.loading.set(true);
    this.api.getPublicByMonth(scope.orgId, this.monthString()).subscribe({
      next: (data) => {
        this.rosters.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.msg.add({
          severity: 'error',
          detail: 'Không tải được lịch công khai',
        });
        this.rosters.set([]);
        this.loading.set(false);
      },
    });
  }

  viewRoster(roster: RosterListItem): void {
    this.router.navigate(['/schedule/view', roster.id]);
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'LOCKED':
        return 'info';
      case 'DRAFT':
        return 'warning';
      default:
        return 'secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PUBLISHED':
        return 'Đã công khai';
      case 'LOCKED':
        return 'Đã khóa';
      case 'DRAFT':
        return 'Bản nháp';
      default:
        return status;
    }
  }
}
