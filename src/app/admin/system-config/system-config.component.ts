import { Component, OnInit, signal } from '@angular/core';
import { SystemConfigService, SystemConfig } from './system-config.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-system-config',
  templateUrl: './system-config.component.html',
  styleUrls: ['./system-config.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class SystemConfigComponent implements OnInit {
  saving = false;
  message = '';
  configs;
  loading;
  errors: Record<string, string> = {};
  savingLeader = false;
  leaderMessage = '';
  leaderError: string | null = null;
  savingMaxAssignable = false;
  maxAssignableMessage = '';
  maxAssignableError: string | null = null;
  constructor(public svc: SystemConfigService) {
    this.configs = this.svc.configs;
    this.loading = this.svc.loading;
  }

  ngOnInit(): void {
    this.svc.fetchAll().subscribe((cfgs) => {
      this.svc.configs.set(cfgs);
      this.svc.loading.set(false);
    });
  }

  leaderConfig(): SystemConfig | undefined {
    return this.configs().find(
      (c: SystemConfig) => c.key === 'LeaderPositionLevelRange'
    );
  }

  maxAssignableConfig(): SystemConfig | undefined {
    return this.configs().find(
      (c: SystemConfig) => c.key === 'MaxAssignableCLevel'
    );
  }

  save() {
    // Validate all configs first
    this.errors = {};
    const configs = this.configs();
    let valid = true;
    configs.forEach((cfg) => {
      const err = this.validateConfig(cfg);
      if (err) {
        this.errors[cfg.key] = err;
        valid = false;
      }
    });

    if (!valid) {
      this.message = 'Vui lòng sửa các trường lỗi trước khi lưu.';
      return;
    }

    this.saving = true;
    this.message = '';
    let count = 0;
    configs.forEach((cfg) => {
      this.svc.update(cfg).subscribe({
        next: () => {
          count++;
          if (count === configs.length) {
            this.saving = false;
            this.message = 'Lưu cấu hình thành công!';
          }
        },
        error: () => {
          this.saving = false;
          this.message = 'Có lỗi khi lưu cấu hình!';
        },
      });
    });
  }

  private validateConfig(cfg: SystemConfig): string | null {
    const key = (cfg.key || '').toLowerCase();
    const value = cfg.value ?? '';
    // Numeric fields
    if (
      key.includes('max') ||
      key.includes('days') ||
      key.includes('range') ||
      key.includes('leader') ||
      key.includes('positionlevel')
    ) {
      if (value === null || value === '') return 'Giá trị bắt buộc.';
      const n = Number(value);
      if (!Number.isFinite(n) || !Number.isInteger(n))
        return 'Phải là số nguyên.';
      if (
        key.includes('leader') ||
        key.includes('positionlevel') ||
        key.includes('range')
      ) {
        if (n < 1) return 'Phải là số lớn hơn hoặc bằng 1.';
      }
    }

    // boolean-ish fields
    if (key.includes('enable') || key.includes('public')) {
      if (!(value === 'true' || value === 'false' || value === null))
        return 'Phải là true/false.';
    }

    return null;
  }

  async saveLeader() {
    const cfg = this.leaderConfig();
    if (!cfg) return;
    this.leaderError = this.validateConfig(cfg);
    if (this.leaderError) {
      this.leaderMessage = 'Vui lòng sửa lỗi trước khi lưu.';
      return;
    }

    this.savingLeader = true;
    this.leaderMessage = '';
    try {
      await this.svc.update(cfg).toPromise();
      this.leaderMessage = 'Lưu LeaderPositionLevelRange thành công.';
    } catch (e) {
      this.leaderMessage = 'Có lỗi khi lưu cấu hình lãnh đạo.';
    } finally {
      this.savingLeader = false;
    }
  }

  async saveMaxAssignable() {
    const cfg = this.maxAssignableConfig();
    if (!cfg) return;
    this.maxAssignableError = this.validateConfig(cfg);
    if (this.maxAssignableError) {
      this.maxAssignableMessage = 'Vui lòng sửa lỗi trước khi lưu.';
      return;
    }

    this.savingMaxAssignable = true;
    this.maxAssignableMessage = '';
    try {
      await this.svc.update(cfg).toPromise();
      this.maxAssignableMessage = 'Lưu MaxAssignableCLevel thành công.';
      // Reload configs to update the computed signal
      this.svc.loadConfigs();
    } catch (e) {
      this.maxAssignableMessage = 'Có lỗi khi lưu ngưỡng C_LEVEL.';
    } finally {
      this.savingMaxAssignable = false;
    }
  }

  getInputType(key: string) {
    if (
      key.toLowerCase().includes('enable') ||
      key.toLowerCase().includes('public')
    )
      return 'checkbox';
    if (
      key.toLowerCase().includes('max') ||
      key.toLowerCase().includes('days') ||
      key.toLowerCase().includes('range') ||
      key.toLowerCase().includes('leader') ||
      key.toLowerCase().includes('positionlevel')
    )
      return 'number';
    return 'text';
  }
}
