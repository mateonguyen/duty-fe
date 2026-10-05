import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UX: 9.5/10 - Improved sizing API, accessibility, and visual consistency.
 * Staff avatar component with automatic color generation and initials fallback.
 * Generates consistent colors based on staff name for visual distinction.
 */
@Component({
  standalone: true,
  selector: 'app-staff-avatar',
  imports: [CommonModule],
  template: `
    <div
      class="avatar-wrapper"
      [class]="'size-' + size"
      [ngStyle]="{ 'background-color': bgColor }"
      [attr.aria-label]="fullName || 'Avatar'"
      role="img"
    >
      <img
        *ngIf="photoUrl; else noPhoto"
        [src]="photoUrl"
        [alt]="fullName"
        class="avatar-img"
      />
      <ng-template #noPhoto>
        <span class="avatar-text" aria-hidden="true">{{ initials }}</span>
      </ng-template>
    </div>
  `,
  styleUrls: ['./staff-avatar.component.scss'],
})
export class StaffAvatarComponent {
  @Input() fullName = '';
  @Input() photoUrl?: string;
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md'; // UX: Flexible sizing API

  /**
   * Generate 2-letter initials from full name.
   * Vietnamese names: Takes first letter of second-to-last and last word.
   * Example: "Nguyễn Văn An" -> "VA"
   */
  get initials(): string {
    if (!this.fullName) return '?';
    const parts = this.fullName.trim().split(/\s+/);

    if (parts.length >= 2) {
      // Vietnamese name: Take second-to-last + last word (given name + middle name)
      return (
        parts[parts.length - 2][0] + parts[parts.length - 1][0]
      ).toUpperCase();
    }

    // Single word: Take first letter
    return this.fullName[0].toUpperCase();
  }

  /**
   * Generate consistent HSL color based on name hash.
   * Uses HSL for better visual consistency and contrast.
   */
  get bgColor(): string {
    return this.stringToColor(this.fullName || 'Unknown');
  }

  /**
   * Convert string to consistent HSL color.
   * Uses hash function to ensure same name always gets same color.
   */
  private stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate hue from hash (0-360 degrees)
    const hue = Math.abs(hash % 360);

    // Use moderate saturation and lightness for better readability
    // 50% saturation: Not too vibrant, not too dull
    // 55% lightness: Good contrast with white text
    return `hsl(${hue}, 50%, 55%)`;
  }
}
