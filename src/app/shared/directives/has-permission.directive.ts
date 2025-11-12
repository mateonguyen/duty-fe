import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  OnInit,
  OnDestroy,
  effect,
  Injector,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private injector = inject(Injector);
  private hasView = false;
  private requiredPermissions: string[] = [];

  @Input() set hasPermission(permission: string | string[]) {
    this.requiredPermissions = Array.isArray(permission)
      ? permission
      : [permission];
    this.updateView();
  }

  ngOnInit() {
    // Setup effect within injection context
    effect(
      () => {
        // Depend on snapshot & token so directive re-evaluates when whoami or token changes
        const currentPerms = this.auth.getAllPermissions();
        void currentPerms;
        this.updateView();
      },
      { injector: this.injector }
    );
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
