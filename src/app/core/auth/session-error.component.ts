import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  standalone: true,
  template: `<section><h1>Chưa truy cập được hệ thống</h1><p>{{ auth.sessionError() }}</p>
    <p>Hệ thống đã dừng chuyển hướng tự động.</p>
    <button (click)="retry()" [disabled]="auth.loading()">Kiểm tra lại kết nối</button>
    <button (click)="login()">Đăng nhập lại</button></section>`,
  styles: [`section{max-width:650px;margin:2rem auto;padding:2rem}button{padding:.75rem 1rem;margin:.5rem;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer}`],
})
export class SessionErrorComponent {
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private get returnUrl(): string {
    const path = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/session-error') ? path : '/';
  }
  async retry(): Promise<void> {
    await this.auth.loadMe(true);
    if (this.auth.isAuthenticated()) await this.router.navigateByUrl(this.returnUrl);
    else if (this.auth.sessionState() === 'forbidden') await this.router.navigateByUrl('/403');
  }
  login(): void { this.auth.login(window.location.origin + this.returnUrl); }
}
