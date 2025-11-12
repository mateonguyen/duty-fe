import { Routes } from '@angular/router';
import { RoleDetailComponent } from './access/role-detail.component';
import { RolesListComponent } from './access/roles-list.component';
import { UserRolesComponent } from './access/user-roles.component';
import { DutyLocationsComponent } from './catalog/duty-locations/duty-locations.component';
import { DutyRolesComponent } from './catalog/duty-roles/duty-roles.component';
import { ShiftsComponent } from './catalog/shifts/shifts.component';
import { AdminLayoutComponent } from './layout/layout.component';
import { SystemConfigComponent } from './system-config/system-config.component';
import { AuthGuardCanActivate } from '../../core/guards/auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuardCanActivate],
    children: [
      {
        path: 'catalog/duty-locations',
        component: DutyLocationsComponent,
        data: { permissions: ['catalog.view'] },
      },
      {
        path: 'catalog/shifts',
        component: ShiftsComponent,
        data: { permissions: ['catalog.view'] },
      },
      {
        path: 'catalog/duty-roles',
        component: DutyRolesComponent,
        data: { permissions: ['catalog.view'] },
      },
      {
        path: 'access/roles',
        component: RolesListComponent,
        data: { permissions: ['role.assign'] },
      },
      {
        path: 'access/roles/:code',
        component: RoleDetailComponent,
        data: { permissions: ['role.assign'] },
      },
      {
        path: 'access/user-roles',
        component: UserRolesComponent,
        data: { permissions: ['role.assign'] },
      },
      {
        path: 'system-config',
        component: SystemConfigComponent,
        data: { permissions: ['system.config'] },
      },
    ],
  },
];
