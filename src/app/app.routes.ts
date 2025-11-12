import { Routes } from '@angular/router';
import {
  AuthGuardCanMatch,
  AuthGuardCanActivate,
} from './core/guards/auth.guard';
import { AppLayoutComponent } from './core/layouts/app-layout/app-layout.component';
import { LoginComponent } from './core/auth/login.component';
import { HomeComponent } from './features/home/home.component';

// Unified AuthGuard used for both matching and activating routes

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent },
      { path: '', component: HomeComponent },
      {
        path: 'admin',
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
        canMatch: [AuthGuardCanMatch],
      },
      {
        path: 'schedule',
        loadChildren: () =>
          import('./features/schedule/schedule.routes').then(
            (m) => m.SCHEDULE_ROUTES
          ),
        canMatch: [AuthGuardCanMatch],
      },
      {
        path: '403',
        loadComponent: () =>
          import('./core/auth/forbidden.component').then(
            (m) => m.ForbiddenComponent
          ),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
