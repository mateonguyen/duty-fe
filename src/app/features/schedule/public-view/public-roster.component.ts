import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { RosterApiService } from '../roster-api.service';
import { AssignmentRead, RosterListItem } from '../schedule';
import { MonthBoardComponent } from '../schedule-page/month-board/month-board.component';

interface ShiftOption {
  id: number;
  name: string;
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
    MonthBoardComponent,
    DatePipe,
  ],
  templateUrl: './public-roster.component.html',
})
export class PublicRosterComponent {
  private route = inject(ActivatedRoute);
  private api = inject(RosterApiService);

  roster = signal<RosterListItem | null>(null);
  shifts = signal<ShiftOption[]>([]);
  selectedShiftId = signal<number | null>(null);
  assignments = signal<AssignmentRead[]>([]);
  loading = signal(true);
  options = computed(() =>
    this.shifts().map((s) => ({ label: s.name, value: s.id }))
  );

  periodFrom = computed(() => this.roster()?.periodStart ?? '');
  periodTo = computed(() => this.roster()?.periodEnd ?? '');

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
        // res.days: [{ date: 'YYYY-MM-DD', shifts: [{shiftId, shiftName, assignments: [{userId, fullName, dutyRoleId, dutyRoleName}]}]}]
        const accAssignments: AssignmentRead[] = [];
        const shiftMap = new Map<number, string>();
        for (const day of res.days as any[]) {
          const dateKey: string = day.date; // backend DateOnly serialized as YYYY-MM-DD
          for (const sh of day.shifts as any[]) {
            shiftMap.set(sh.shiftId, sh.shiftName);
            for (const a of sh.assignments as any[]) {
              accAssignments.push({
                date: dateKey,
                shiftId: sh.shiftId,
                userId: a.userId,
                userName: a.fullName,
                dutyRoleName: a.dutyRoleName,
              });
            }
          }
        }
        const shifts: ShiftOption[] = Array.from(shiftMap.entries()).map(
          ([id, name]) => ({ id, name })
        );
        this.shifts.set(shifts);
        this.selectedShiftId.set(shifts.length ? shifts[0].id : null);
        this.assignments.set(accAssignments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
