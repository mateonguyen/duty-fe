import { Component, OnInit } from '@angular/core';
import { DutyApiService } from '../../../../core/api/duty-api.service';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FormsModule, NgForm } from '@angular/forms';
import {
  DutyLocationReadDto,
  DutyLocationWriteDto,
} from '../../../../shared/models/duty-location';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';

@Component({
  standalone: true,
  selector: 'app-duty-locations',
  templateUrl: './duty-locations.component.html',
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputSwitchModule,
    FormsModule,
    ToastModule,
    ConfirmDialogModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
})
export class DutyLocationsComponent implements OnInit {
  rows: DutyLocationReadDto[] = [];
  loading = false;
  selected: DutyLocationReadDto[] = [];

  // dialog state
  dlgOpen = false;
  dlgTitle = 'Thêm địa điểm';
  editId: number | null = null;
  form: DutyLocationWriteDto = { code: '', name: '', active: true };

  constructor(
    private api: DutyApiService,
    private msg: MessageService,
    private confirm: ConfirmationService
  ) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.rows = (await firstValueFrom(this.api.getDutyLocations())) ?? [];
    } finally {
      this.loading = false;
    }
  }

  add() {
    this.editId = null;
    this.form = { code: '', name: '', active: true };
    this.dlgTitle = 'Thêm địa điểm';
    this.dlgOpen = true;
  }

  edit(r: DutyLocationReadDto) {
    this.editId = r.id;
    this.form = { code: r.code, name: r.name, active: r.active };
    this.dlgTitle = 'Sửa địa điểm';
    this.dlgOpen = true;
  }

  async save(f: NgForm) {
    if (f.invalid) return;
    // client-side duplicate code check
    const code = this.form.code?.trim();
    const dup = this.rows.some(
      (r) =>
        r.code.toLowerCase() === code.toLowerCase() &&
        (this.editId ? r.id !== this.editId : true)
    );
    if (dup) {
      this.msg.add({
        severity: 'error',
        summary: 'Mã đã tồn tại',
        detail: `Code "${code}" đã tồn tại.`,
      });
      return;
    }
    try {
      if (this.editId)
        await this.api.updateDutyLocation(this.editId, this.form).toPromise();
      else await this.api.createDutyLocation(this.form).toPromise();

      this.msg.add({
        severity: 'success',
        summary: 'Thành công',
        detail: 'Đã lưu',
      });
      this.dlgOpen = false;
      await this.load();
    } catch (e: any) {
      const backendMsg = e?.error?.message || e?.message;
      this.msg.add({
        severity: 'error',
        summary: 'Lỗi',
        detail: backendMsg ?? 'Không lưu được',
      });
    }
  }

  remove(r: DutyLocationReadDto) {
    this.confirm.confirm({
      message: `Xóa “${r.name}”?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.api.deleteDutyLocation(r.id).toPromise();
        this.msg.add({ severity: 'success', summary: 'Đã xóa' });
        await this.load();
      },
    });
  }

  removeMany() {
    if (!this.selected?.length) return;
    this.confirm.confirm({
      message: `Xóa ${this.selected.length} mục đã chọn?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          await Promise.all(
            this.selected.map((r) =>
              this.api.deleteDutyLocation(r.id).toPromise()
            )
          );
          this.msg.add({ severity: 'success', summary: 'Đã xóa' });
          this.selected = [];
          await this.load();
        } catch (e) {
          this.msg.add({ severity: 'error', summary: 'Lỗi khi xóa' });
        }
      },
    });
  }

  async toggleMany() {
    if (!this.selected.length) return;
    try {
      await Promise.all(
        this.selected.map((r) =>
          this.api
            .updateDutyLocation(r.id, {
              code: r.code,
              name: r.name,
              active: !r.active,
            })
            .toPromise()
        )
      );
      this.msg.add({ severity: 'success', summary: 'Đã cập nhật trạng thái' });
      this.selected = [];
      await this.load();
    } catch (e) {
      this.msg.add({ severity: 'error', summary: 'Lỗi khi cập nhật' });
    }
  }
}
