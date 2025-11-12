import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PanelMenuModule } from 'primeng/panelmenu';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  standalone: true,
  selector: 'app-admin-layout',
  templateUrl: './layout.component.html',
  imports: [
    RouterLink,
    RouterOutlet,
    RouterLinkActive,
    PanelMenuModule,
    ButtonModule,
    CommonModule,
    HasPermissionDirective,
  ],
})
export class AdminLayoutComponent {
  openCatalog = signal(true);
  openAccess = signal(true);
  year = new Date().getFullYear();

  onActivate(comp: any) {
    console.log('Activated:', comp?.constructor?.name);
  }
}
