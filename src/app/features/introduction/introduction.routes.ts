import { Routes } from '@angular/router';
import { IntroductionListComponent } from './introduction-list.component';
import { IntroductionFormComponent } from './introduction-form.component';

export const INTRODUCTION_ROUTES: Routes = [
  { path: '', component: IntroductionListComponent },
  { path: 'create', component: IntroductionFormComponent },
  { path: 'groups/:id/edit', component: IntroductionFormComponent },
  { path: ':id/edit', component: IntroductionFormComponent },
];
