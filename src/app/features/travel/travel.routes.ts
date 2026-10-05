import { Routes } from '@angular/router';
import { TripListComponent } from './pages/trip-list/trip-list.component';
import { TripCreateComponent } from './pages/trip-create.component';

export const TRAVEL_ROUTES: Routes = [
  {
    path: '',
    component: TripListComponent,
  },
  {
    path: 'create',
    component: TripCreateComponent,
  },
  {
    path: 'trips/:tripId/edit',
    component: TripCreateComponent,
  },
  {
    path: 'orders/:orderId/edit',
    component: TripCreateComponent,
  },
  {
    path: 'trips',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'trips/new',
    redirectTo: '/travel/create',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
