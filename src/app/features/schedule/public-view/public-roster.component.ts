import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { RosterApiService } from '../roster-api.service';
import { AssignmentRead, RosterListItem, DutyLocation } from '../schedule';
import { MonthBoardComponent } from '../schedule-page/month-board/month-board.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ScheduleTableViewComponent } from './schedule-table-view.component';
import { AuthService } from '../../../core/auth/auth.service';

interface ShiftOption {
  id: number;
  name: string;
  timeRange?: string; // e.g., "07:30 - 11:30"
}

@Component({
  standalone: true,
  selector: 'app-public-roster',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    DropdownModule,
    CardModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    ToastModule,
    MonthBoardComponent,
    DatePipe,
    LoadingSpinnerComponent,
    ScheduleTableViewComponent,
  ],
  providers: [MessageService],
  templateUrl: './public-roster.component.html',
  styleUrls: ['./public-roster.component.scss'],
})
export class PublicRosterComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private api = inject(RosterApiService);
  private auth = inject(AuthService);
  private toast = inject(MessageService);

  roster = signal<RosterListItem | null>(null);
  locations = signal<DutyLocation[]>([]);
  selectedLocationId = signal<number | null>(null);
  shifts = signal<ShiftOption[]>([]);
  selectedShiftId = signal<number | null>(null);
  assignments = signal<AssignmentRead[]>([]);
  loading = signal(true);
  viewMode = signal<'calendar' | 'table'>('calendar');
  options = computed(() =>
    this.shifts().map((s) => ({ label: s.name, value: s.id }))
  );

  // Computed: enabled locations for view (all locations from roster)
  enabledLocations = computed(() => this.locations());

  // Computed: location configs for location-tabs (all enabled in view mode)
  locationConfigs = computed(() =>
    this.locations().map((loc) => ({
      id: loc.id,
      name: loc.name,
      isEnabled: true,
    }))
  );

  // Computed: current/selected location (for pills display)
  currentLocation = computed(() => {
    const locations = this.enabledLocations();
    if (locations.length === 0) return null;
    const selectedId = this.selectedLocationId();
    return locations.find((loc) => loc.id === selectedId) || locations[0];
  });

  // Computed: current/selected shift (for pills display)
  currentShift = computed(() => {
    const allShifts = this.shifts();
    if (allShifts.length === 0) return null;
    const selectedId = this.selectedShiftId();
    return allShifts.find((s) => s.id === selectedId) || allShifts[0];
  });

  periodFrom = computed(() => this.roster()?.periodStart ?? '');
  periodTo = computed(() => this.roster()?.periodEnd ?? '');

  // Format period as "Tháng 11/2025"
  formatPeriodMonth = computed(() => {
    const dateStr = this.roster()?.periodStart;
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
  });

  // Permission checks
  canEdit = computed(() => this.auth.hasPermission('roster.update'));
  canPublish = computed(() => this.auth.hasPermission('roster.publish'));

  // Publish button state
  isPublished = computed(() => this.roster()?.status === 'PUBLISHED');
  publishButtonLabel = computed(() =>
    this.isPublished() ? 'Đã công bố' : 'Xuất bản'
  );
  publishButtonDisabled = computed(() => this.isPublished());

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) return;

    this.loading.set(true);
    this.api.getById(id).subscribe({
      next: (meta) => {
        this.roster.set(meta);
      },
      error: () => {
        this.loading.set(false);
      },
    });

    this.api.getMatrix(id).subscribe({
      next: (res) => {
        // SNAPSHOT DATA: res.days contains snapshot shift info (shiftName, shiftTimeRange)
        // This ensures we display shift data as it was at assignment time,
        // even if master Shift definitions have changed since.
        const accAssignments: AssignmentRead[] = [];
        const shiftMap = new Map<
          number,
          { name: string; timeRange?: string }
        >();
        const locationMap = new Map<number, DutyLocation>();

        for (const day of res.days as any[]) {
          const dateKey: string = day.date; // backend DateOnly serialized as YYYY-MM-DD
          for (const sh of day.shifts as any[]) {
            // Store both name and timeRange from snapshot
            if (!shiftMap.has(sh.shiftId)) {
              shiftMap.set(sh.shiftId, {
                name: sh.shiftName,
                timeRange: sh.shiftTimeRange,
              });
            }

            for (const a of sh.assignments as any[]) {
              accAssignments.push({
                id: a.id,
                date: dateKey,
                shiftId: sh.shiftId,
                userId: a.id, // stable numeric for view-only; not used for editing
                userName: a.fullName,
                orgUnitName: a.unitName,
                shiftName: sh.shiftName,
                shiftTimeRange: sh.shiftTimeRange,
                positionTitle: a.positionTitle, // Snapshot staff position (historical data)
                positionLevel: a.positionLevel, // Snapshot C_LEVEL for sorting
                isLeader: a.isLeader, // Snapshot leader status
                dutyRoleName: a.dutyRoleName,
                locationId: a.locationId,
              });

              // Extract location info from assignment if available
              if (
                a.locationId &&
                a.locationName &&
                !locationMap.has(a.locationId)
              ) {
                locationMap.set(a.locationId, {
                  id: a.locationId,
                  name: a.locationName,
                });
              }
            }
          }
        }

        const shifts: ShiftOption[] = Array.from(shiftMap.entries()).map(
          ([id, data]) => ({ id, name: data.name, timeRange: data.timeRange })
        );
        const locations: DutyLocation[] = Array.from(locationMap.values());

        this.shifts.set(shifts);
        this.selectedShiftId.set(shifts.length ? shifts[0].id : null);
        this.locations.set(locations);
        this.selectedLocationId.set(locations.length ? locations[0].id : null);
        this.assignments.set(accAssignments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
  // Debug signals to verify filters/data across views
  _debug = effect(() => {
    // Only log when data is present
    const total = this.assignments().length;
    if (!total) return;
    const loc = this.selectedLocationId();
    const sh = this.selectedShiftId();
    const calCount = this.assignments().filter(
      (a) =>
        (loc == null || a.locationId === loc) &&
        (sh == null || a.shiftId === sh)
    ).length;
    const tableCount = this.assignments().filter(
      (a) => loc == null || a.locationId === loc
    ).length;
    // eslint-disable-next-line no-console
    console.debug('[PublicRoster] state', {
      viewMode: this.viewMode(),
      selectedLocationId: loc,
      selectedShiftId: sh,
      assignmentsTotal: total,
      calendarVisibleAssignments: calCount,
      tableVisibleAssignments: tableCount,
    });
  });

  goBack() {
    this.location.back();
  }

  /**
   * Navigate to monitoring screen for this roster
   */
  goToMonitoring() {
    const roster = this.roster();
    if (!roster) return;

    this.router.navigate(['/schedule/monitoring'], {
      queryParams: {
        unitId: roster.scopeUnitId,
        rosterId: roster.id,
      },
    });
  }

  goToEdit() {
    const id = this.roster()?.id;
    if (id) {
      this.router.navigate(['/schedule/rosters', id, 'edit']);
    }
  }

  handlePublish() {
    const id = this.roster()?.id;
    if (!id || this.isPublished()) return;

    this.api.publish(id).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: 'Thành công',
          detail: 'Đã xuất bản lịch trực',
        });
        // Reload roster to update status
        this.api.getById(id).subscribe({
          next: (meta) => this.roster.set(meta),
        });
      },
      error: (err) => {
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: err.error?.message || 'Không thể xuất bản lịch',
        });
      },
    });
  }
}
