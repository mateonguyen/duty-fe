import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuService } from '../../../core/services/menu.service';

@Component({
  standalone: true,
  selector: 'app-admin-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  imports: [
    RouterLink,
    RouterOutlet,
    RouterLinkActive,
    CommonModule,
  ],
})
export class AdminLayoutComponent {
  private menuService = inject(MenuService);

  // Collapse state for each section
  openCatalog = signal(true);
  openAccess = signal(true);
  mobileNavigation = signal(false);
  year = new Date().getFullYear();

  // Reactive menu items filtered by permissions (same logic as top-bar)
  catalogItems = this.menuService.filterMenuByGroup('ADMIN_CATALOG');
  accessItems = this.menuService.filterMenuByGroup('ADMIN_ACCESS');

  // Check if sections should be visible (at least one item passes permission check)
  showCatalogSection = this.menuService.hasVisibleItemsInGroup('ADMIN_CATALOG');
  showAccessSection = this.menuService.hasVisibleItemsInGroup('ADMIN_ACCESS');

}
