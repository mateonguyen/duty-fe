import { Routes } from '@angular/router';
import { PublicRosterComponent } from './public-view/public-roster.component';
import { PublicScheduleComponent } from './public-view/public-schedule.component';
import { SchedulePageComponent } from './schedule-page/schedule-page.component';
import { RosterListComponent } from './roster-list/roster-list.component';
import { AuthGuardCanActivate } from '../../core/guards/auth.guard';
import { LiveMonitorComponent } from './monitoring/live-monitor.component';

export const SCHEDULE_ROUTES: Routes = [
  { path: '', redirectTo: 'rosters', pathMatch: 'full' },
  { path: 'public', component: PublicScheduleComponent },
  {
    path: 'rosters',
    component: RosterListComponent,
    canActivate: [AuthGuardCanActivate],
    data: { permissions: ['roster.view'] },
  },
  {
    path: 'rosters/new',
    component: SchedulePageComponent,
    canActivate: [AuthGuardCanActivate],
    data: { permissions: ['roster.create'] },
  },
  {
    path: 'rosters/:id/edit',
    component: SchedulePageComponent,
    canActivate: [AuthGuardCanActivate],
    data: { permissions: ['roster.edit'] },
  },
  { path: 'view/:id', component: PublicRosterComponent },
  { path: 'monitoring', component: LiveMonitorComponent },
];
