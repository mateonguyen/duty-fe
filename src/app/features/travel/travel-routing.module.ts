import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TripListComponent } from './pages/trip-list/trip-list.component';
import { TripCreateComponent } from './pages/trip-create.component';
import { TripDetailComponent } from './pages/trip-detail.component';

const routes: Routes = [
  {
    path: '',
    component: TripListComponent,
  },
  {
    path: 'new',
    component: TripCreateComponent,
  },
  {
    path: ':id',
    component: TripDetailComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TravelRoutingModule {}
