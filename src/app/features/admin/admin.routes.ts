import { Routes } from '@angular/router';
import { RoleDetailComponent } from './access/role-detail.component';
import { RolesListComponent } from './access/roles-list.component';
import { DutyLocationsComponent } from './catalog/duty-locations/duty-locations.component';
import { ShiftsComponent } from './catalog/shifts/shifts.component';
import { AdminLayoutComponent } from './layout/layout.component';
import { SystemConfigComponent } from './system-config/system-config.component';
import { AuthGuardCanActivate, AuthGuardCanActivateChild } from '../../core/guards/auth.guard';
import { directoryUnsavedGuard } from './directory/directory-unsaved.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuardCanActivate],
    canActivateChild: [AuthGuardCanActivateChild],
    children: [
      {
        path: 'directory',
        loadComponent: () => import('./directory/local-directory.component').then(m => m.LocalDirectoryComponent),
        canActivate: [AuthGuardCanActivate],
        canDeactivate: [directoryUnsavedGuard],
        data: { permissions: ['system.config', 'role.assign'] },
      },
      {
        path: 'directory-sync',
        loadComponent: () => import('./directory-sync/directory-sync.component').then(m => m.DirectorySyncComponent),
        canActivate: [AuthGuardCanActivate],
        data: { permissions: ['system.config'] },
      },
      {
        path: 'directory/:kind',
        loadComponent: () => import('./directory/local-directory.component').then(m => m.LocalDirectoryComponent),
        canActivate: [AuthGuardCanActivate],
        canDeactivate: [directoryUnsavedGuard],
        data: { permissions: ['system.config', 'role.assign'] },
      },
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
      { path: 'catalog/duty-roles', redirectTo: 'catalog/shifts', pathMatch: 'full' },
      {
        path: 'access/roles',
        component: RolesListComponent,
        data: { permissions: ['user.manage'] },
      },
      {
        path: 'access/roles/:code',
        component: RoleDetailComponent,
        data: { permissions: ['user.manage'] },
      },
      { path: 'access/user-roles', redirectTo: 'directory/personnel', pathMatch: 'full' },
      {
        path: 'system-config',
        component: SystemConfigComponent,
        data: { permissions: ['system.config'] },
      },
    ],
  },
];
