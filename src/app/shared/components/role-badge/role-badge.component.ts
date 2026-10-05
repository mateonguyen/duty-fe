import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Role badge component with color-coded severity levels.
 * Displays staff role/position with appropriate visual emphasis.
 */
@Component({
  standalone: true,
  selector: 'app-role-badge',
  imports: [CommonModule],
  template: `
    <span class="role-badge" [ngClass]="severityClass">
      {{ label }}
    </span>
  `,
  styleUrls: ['./role-badge.component.scss'],
})
export class RoleBadgeComponent {
  @Input() role = '';

  get label(): string {
    return this.role || 'N/A';
  }

  /**
   * Determine badge color based on role hierarchy.
   * Red: Top leadership (Cục trưởng, Trưởng phòng)
   * Orange: Deputy leadership (Phó Cục trưởng, Phó phòng)
   * Blue: Operational leadership (Chỉ huy trực)
   * Gray: Regular staff
   */
  get severityClass(): string {
    const roleNormalized = (this.role || '').toLowerCase().trim();

    // Top leadership - Red
    if (
      roleNormalized.includes('cục trưởng') &&
      !roleNormalized.includes('phó')
    ) {
      return 'r-danger';
    }
    if (
      roleNormalized.includes('trưởng phòng') ||
      roleNormalized.includes('trưởng ban')
    ) {
      return 'r-danger';
    }

    // Deputy leadership - Orange/Amber
    if (
      roleNormalized.includes('phó cục trưởng') ||
      roleNormalized.includes('phó phòng') ||
      roleNormalized.includes('phó ban')
    ) {
      return 'r-warning';
    }

    // Operational leadership - Blue
    if (
      roleNormalized.includes('chỉ huy trực') ||
      roleNormalized.includes('điều phối') ||
      roleNormalized.includes('trưởng ca')
    ) {
      return 'r-info';
    }

    // Specialist roles - Teal
    if (
      roleNormalized.includes('chuyên viên') ||
      roleNormalized.includes('kỹ sư')
    ) {
      return 'r-success';
    }

    // Regular staff - Gray
    return 'r-normal';
  }
}
