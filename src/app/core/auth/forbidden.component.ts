import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="forbidden-wrapper">
      <h1>403 - Không có quyền truy cập</h1>
      <p>Bạn không đủ quyền để truy cập chức năng hoặc trang này.</p>
      <a routerLink="/" class="back-link">Về trang chủ</a>
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
export class ForbiddenComponent {}
