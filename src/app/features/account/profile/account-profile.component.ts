import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AccountService } from '../account.service';
import { AccountProfile, UserRoleInfo } from '../account.models';
import { AvatarModule } from 'primeng/avatar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  standalone: true,
  selector: 'app-account-profile',
  templateUrl: './account-profile.component.html',
  styleUrls: ['./account-profile.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    ToastModule,
    AvatarModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService],
})
export class AccountProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AccountService);
  private toast = inject(MessageService);

  loading = signal(true);
  profile = signal<AccountProfile | null>(null);

  form = this.fb.group({
    phoneNumber: ['', [Validators.pattern(/^\d{10,11}$/)]],
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getMyProfile().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.form.patchValue({ phoneNumber: p.phoneNumber || '' });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[MyProfile] load failed', err);
        this.toast.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không tải được hồ sơ người dùng',
        });
        this.loading.set(false);
      },
    });
  }

  get initials(): string {
    const name = this.profile()?.fullName || '';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.charAt(0) ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase() || 'US';
  }

  formatRole(r: UserRoleInfo): string {
    const scope = r.scopeUnitName
      ? `${r.scopeUnitName} (${r.scopeUnitCode})${
          r.includeChildren ? ' + đơn vị con' : ''
        }`
      : 'Toàn cục';
    return `${r.roleName} — ${scope}`;
  }

  reset(): void {
    const original = this.profile();
    this.form.reset({ phoneNumber: original?.phoneNumber || '' });
  }

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.value;
    this.form.disable();
    this.api
      .updateMyProfile({ phoneNumber: value.phoneNumber || '' })
      .subscribe({
        next: () => {
          const p = this.profile();
          if (p) {
            this.profile.set({ ...p, phoneNumber: value.phoneNumber || '' });
          }
          this.toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Cập nhật hồ sơ thành công',
          });
        },
        error: (err) => {
          console.error('[MyProfile] update failed', err);
          this.toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không cập nhật được hồ sơ',
          });
          this.form.enable();
        },
        complete: () => this.form.enable(),
      });
  }
}
