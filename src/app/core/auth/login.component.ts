import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = '';
  password = '';
  loading = false;
  error: string | null = null;

  submit() {
    this.error = null;
    this.loading = true;
    this.auth
      .login({ username: this.username, password: this.password })
      .subscribe({
        next: () => {
          // Login now handles bootstrap internally
          const returnUrl =
            this.route.snapshot.queryParamMap.get('returnUrl') || '/admin';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.error = err?.error || 'Login failed';
          this.loading = false;
        },
        complete: () => (this.loading = false),
      });
  }
}
