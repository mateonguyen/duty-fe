import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  OnDestroy,
  effect,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Structural directive to conditionally show/hide elements based on user roles.
 *
 * Purpose: Provide role-based UI visibility control similar to *ngIf,
 * but specifically for role checking. Optimized with reactive updates.
 *
 * Usage:
 * ```html
 * <!-- Single role -->
 * <button *appHasRole="'Admin'">Delete User</button>
 *
 * <!-- Multiple roles (OR logic - user has ANY of these) -->
 * <button *appHasRole="['Admin', 'Manager']">Edit Roster</button>
 *
 * <!-- Complex example with other directives -->
 * <div *appHasRole="['Leader', 'Coordinator']" class="admin-panel">
 *   <p-button label="Publish" (onClick)="publish()"></p-button>
 * </div>
 * ```
 *
 * Benefits:
 * - Completely hides HTML when user doesn't have role (no DOM flicker)
 * - Reactive: automatically updates when user roles change
 * - Performance: uses ViewContainerRef for efficient DOM manipulation
 * - Type-safe: TypeScript will catch invalid role arrays
 *
 * @example
 * ```html
 * <!-- Only Admin can see delete button -->
 * <button *appHasRole="'Admin'" pButton label="Delete"></button>
 *
 * <!-- Manager OR Leader can approve -->
 * <button *appHasRole="['Manager', 'Leader']">Approve</button>
 * ```
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective implements OnDestroy {
  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private hasView = false;
  private requiredRoles: string[] = [];

  // Setup effect in field initializer (injection context is available here)
  private roleChangeEffect = effect(() => {
    // Depend on roles signal and isAuthenticated - reactive updates
    const currentRoles = this.auth.roles();
    const isAuth = this.auth.isAuthenticated();
    void currentRoles; // Mark as used
    void isAuth;
    this.updateView();
  });

  /**
   * Accepts single role or array of roles.
   * Uses OR logic: user needs at least ONE of the roles to see the content.
   */
  @Input() set appHasRole(role: string | string[]) {
    this.requiredRoles = Array.isArray(role) ? role : [role];
    this.updateView();
  }

  ngOnDestroy() {
    this.viewContainer.clear();
  }

  /**
   * Core logic: Check if user has required role and show/hide content.
   * Uses ViewContainerRef for optimal performance.
   */
  private updateView() {
    const hasRequiredRole = this.auth.hasAnyRole(this.requiredRoles);

    if (hasRequiredRole && !this.hasView) {
      // User has role and view not shown yet -> create view
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasRequiredRole && this.hasView) {
      // User lost role or never had it -> clear view
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
