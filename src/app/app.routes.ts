import { Routes } from '@angular/router';
import {
  AuthGuardCanMatch,
  AuthGuardCanActivate,
} from './core/guards/auth.guard';
import { AppLayoutComponent } from './core/layouts/app-layout/app-layout.component';
import { HomeComponent } from './features/home/home.component';
import { DocsLayoutComponent } from './features/docs/docs-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        component: HomeComponent,
        canActivate: [AuthGuardCanActivate],
      },
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
            (m) => m.SCHEDULE_ROUTES,
          ),
        canMatch: [AuthGuardCanMatch],
      },
      {
        path: 'account',
        loadChildren: () =>
          import('./features/account/account.routes').then(
            (m) => m.ACCOUNT_ROUTES,
          ),
        canMatch: [AuthGuardCanMatch],
      },
      {
        path: 'travel',
        loadChildren: () =>
          import('./features/travel/travel.routes').then(
            (m) => m.TRAVEL_ROUTES,
          ),
        canMatch: [AuthGuardCanMatch],
      },
      {
        path: 'introduction-letters',
        loadChildren: () => import('./features/introduction/introduction.routes').then(m => m.INTRODUCTION_ROUTES),
        canMatch: [AuthGuardCanMatch],
      },
      {
        path: 'session-error',
        loadComponent: () => import('./core/auth/session-error.component').then(m => m.SessionErrorComponent),
      },
      {
        path: '403',
        loadComponent: () =>
          import('./core/auth/forbidden.component').then(
            (m) => m.ForbiddenComponent,
          ),
      },
      {
        path: 'component-demo',
        loadComponent: () =>
          import('./features/demo/component-demo.component').then(
            (m) => m.ComponentDemoComponent,
          ),
      },
      {
        path: 'help/user-guide',
        loadComponent: () =>
          import('./features/help/user-guide.component').then(
            (m) => m.UserGuideComponent,
          ),
        title: 'Hướng dẫn sử dụng',
      },
      {
        path: 'docs',
        children: [
          { path: '', component: DocsLayoutComponent },
          { path: '**', component: DocsLayoutComponent },
        ],
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
