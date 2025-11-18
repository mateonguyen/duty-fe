import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarModule } from 'primeng/calendar';
import { ScopePickerComponent } from '../../shared/components/scope-picker/scope-picker.component';
import { RosterApiService } from '../schedule/roster-api.service';
import { ScopeService, ScopeRef } from '../../core/services/scope.service';

@Component({
  standalone: true,
  selector: 'app-public-schedule',
  imports: [CommonModule, CalendarModule, ScopePickerComponent],
  templateUrl: './public-schedule.component.html',
  styleUrls: ['./public-schedule.component.scss'],
})
export class PublicScheduleComponent implements OnInit {
  viewMode = signal<'month' | 'week'>('month');
  scopes = signal<ScopeRef[]>([]);
  activeScope = computed(() => this.scopeService.getActiveScope('roster.view'));
  rosters = signal<any[]>([]);
  loading = signal(false);

  constructor(
    private api: RosterApiService,
    private scopeService: ScopeService
  ) {}

  ngOnInit() {
    this.scopeService.load('roster.view').subscribe({
      next: (items) => {
        this.scopes.set(items);
        this.scopeService.ensureActive('roster.view');
        this.loadRosters();
      },
    });
  }

  onScopeChange(scope: ScopeRef | null) {
    if (scope) {
      this.scopeService.setActiveScope('roster.view', scope);
      this.loadRosters();
    }
  }

  setViewMode(mode: 'month' | 'week') {
    this.viewMode.set(mode);
  }

  loadRosters() {
    this.loading.set(true);
    const scopeCode = this.activeScope()?.orgId;
    if (!scopeCode) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;
    this.api.getPublicByMonth(scopeCode, month).subscribe({
      next: (data) => {
        this.rosters.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
