import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  Renderer2,
  inject,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Directive({
  selector: '[appPermissionTooltip]',
  standalone: true,
})
export class PermissionTooltipDirective implements OnChanges {
  @Input('appPermissionTooltip') permission!: string;

  private el = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private auth = inject(AuthService);

  ngOnChanges(): void {
    this.apply();
  }

  private apply() {
    const has = this.permission
      ? this.auth.hasPermission(this.permission)
      : true;
    const host = this.el.nativeElement;
    if (!has) {
      this.renderer.setAttribute(
        host,
        'title',
        'Bạn không có quyền thực hiện hành động này'
      );
      this.renderer.addClass(host, 'opacity-60');
      this.renderer.addClass(host, 'cursor-not-allowed');
    } else {
      this.renderer.removeAttribute(host, 'title');
      this.renderer.removeClass(host, 'opacity-60');
      this.renderer.removeClass(host, 'cursor-not-allowed');
    }
  }
}
