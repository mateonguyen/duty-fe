import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="forbidden-wrapper">
      <h1>403 - Không có quyền truy cập</h1>
      <p>{{ auth.sessionError() || 'Bạn không đủ quyền để truy cập chức năng hoặc trang này.' }}</p>
      <p *ngIf="auth.sessionState() === 'forbidden'">Nhờ quản trị thêm tài khoản SSO vào danh mục cán bộ và cấp quyền phù hợp.</p>
      <a *ngIf="auth.isAuthenticated()" routerLink="/" class="back-link">Về trang chủ</a>
      <button *ngIf="auth.sessionState() === 'forbidden'" (click)="auth.logout()">Đăng xuất / đổi tài khoản</button>
    </div>
  `,
  styles: [
    `
      .forbidden-wrapper {
        padding: 3rem;
        text-align: center;
      }
      h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
      }
      p {
        color: #666;
        margin-bottom: 1.5rem;
      }
      .back-link {
        color: var(--primary-color);
        text-decoration: none;
        font-weight: 600;
      }
      .back-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class ForbiddenComponent { public auth = inject(AuthService); }
