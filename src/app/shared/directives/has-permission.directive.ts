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

@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnDestroy {
  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private hasView = false;
  private requiredPermissions: string[] = [];

  // Setup effect in field initializer (injection context is available here)
  private permissionChangeEffect = effect(() => {
    // Depend on roles signal so directive re-evaluates when permissions change
    const currentPerms = this.auth.permissions();
    void currentPerms;
    this.updateView();
  });

  @Input() set hasPermission(permission: string | string[]) {
    this.requiredPermissions = Array.isArray(permission)
      ? permission
      : [permission];
    this.updateView();
  }

  ngOnDestroy() {
    this.viewContainer.clear();
  }

  private updateView() {
    const hasPermission = this.auth.hasAnyPermission(this.requiredPermissions);

    if (hasPermission && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasPermission && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
