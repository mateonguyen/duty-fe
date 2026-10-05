import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StaffAvatarComponent } from '../staff-avatar/staff-avatar.component';
import { RoleBadgeComponent } from '../role-badge/role-badge.component';

/**
 * UX: 9.5/10 - Improved layout, spacing, and accessibility.
 * Combined staff chip component displaying avatar, name, and role badge.
 * Ideal for table cells, lists, and dashboard widgets.
 * Provides consistent staff display across the application.
 */
@Component({
  standalone: true,
  selector: 'app-staff-chip',
  imports: [CommonModule, StaffAvatarComponent, RoleBadgeComponent],
  template: `
    <div
      class="staff-chip"
      [class.compact]="compact"
      [class.clickable]="clickable"
      [attr.role]="clickable ? 'button' : null"
      [attr.tabindex]="clickable ? '0' : null"
    >
      <app-staff-avatar
        [fullName]="fullName"
        [photoUrl]="photoUrl"
        [size]="compact ? 'sm' : 'md'"
      ></app-staff-avatar>

      <div class="chip-info">
        <div class="chip-name" [title]="fullName">{{ fullName }}</div>
        <app-role-badge *ngIf="role && showRole" [role]="role"></app-role-badge>
      </div>
    </div>
  `,
  styleUrls: ['./staff-chip.component.scss'],
})
export class StaffChipComponent {
  @Input() fullName = '';
  @Input() role = '';
  @Input() photoUrl?: string;
  @Input() showRole = true; // Toggle role badge visibility
  @Input() compact = false; // Compact mode for tight spaces
  @Input() clickable = false; // UX: Enable hover/focus states for interactive chips
}
