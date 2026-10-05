import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AccountService } from '../account.service';

@Component({
  standalone: true,
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
  ],
  providers: [MessageService],
})
export class ChangePasswordComponent {
  private fb = inject(FormBuilder);
  private api = inject(AccountService);
  private toast = inject(MessageService);

  form = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
      ],
    ],
    confirmPassword: ['', [Validators.required]],
  });

  passwordStrength = computed(() => {
    const v = this.form.controls.newPassword.value || '';
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (score <= 1) return { level: 'Yếu', color: '#ef4444', value: 1 };
    if (score === 2) return { level: 'Trung bình', color: '#f59e0b', value: 2 };
    return { level: 'Mạnh', color: '#10b981', value: 3 };
  });

  get passwordsMismatch(): boolean {
    const n = this.form.controls.newPassword.value;
    const c = this.form.controls.confirmPassword.value;
    return !!n && !!c && n !== c;
  }

  reset(): void {
    this.form.reset({
      currentPassword: this.form.controls.currentPassword.value,
    });
  }

  submit(): void {
    if (this.form.invalid || this.passwordsMismatch) return;
    const { currentPassword, newPassword, confirmPassword } = this.form
      .value as any;
    this.form.disable();
    this.api
      .changePassword({ currentPassword, newPassword, confirmPassword })
      .subscribe({
        next: () =>
          this.toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đổi mật khẩu thành công',
          }),
        complete: () => this.form.enable(),
      });
  }
}
