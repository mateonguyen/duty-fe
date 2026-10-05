import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TravelApiService } from '../services/travel-api.service';
import {
  PersonnelApiService,
  PersonnelDto,
} from '../services/personnel-api.service';
import { PersonnelStoreService } from '../services/personnel-store.service';
import {
  CreateTravelTripRequest,
  TravelOrderPreviewModel,
} from '../models/travel.models';
import { TravelPreviewPageComponent } from './travel-preview-page.component';

@Component({
  selector: 'app-trip-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TravelPreviewPageComponent],
  template: `
    <div class="split-container">
      <!-- LEFT: PREVIEW PANEL -->
      <div class="preview-panel">
        <div class="preview-header">
          <h3>Xem trước</h3>
          <span class="preview-count" *ngIf="previewPersons().length > 0">
            {{ previewPersons().length }} giấy
          </span>
        </div>
        <div class="preview-scroll">
          <div *ngIf="previewPersons().length === 0" class="preview-empty">
            Thêm cán bộ để xem trước giấy
          </div>
          <div
            *ngFor="let person of previewPersons(); let i = index"
            class="preview-item"
          >
            <app-travel-preview-page
              [data]="buildPreviewModel(person, i)"
            ></app-travel-preview-page>
          </div>
        </div>
      </div>

      <!-- RIGHT: FORM PANEL -->
      <div class="form-panel">
        <form
          [formGroup]="tripForm"
          (ngSubmit)="onSubmit()"
          class="form-wrapper"
        >
          <!-- FORM HEADER -->
          <div class="form-header">
            <h2>Tạo giấy đi đường</h2>
            <button type="button" class="btn btn-link" (click)="onCancel()">
              Quay lại
            </button>
          </div>

          <!-- ERROR MESSAGE -->
          <div *ngIf="errorMsg()" class="alert alert-error">
            {{ errorMsg() }}
          </div>

          <!-- SECTION 1: NGƯỜI DUYỆT -->
          <div class="form-section signer-section">
            <div class="section-header">
              <span class="section-icon">✍️</span>
              <span class="section-title">Người duyệt</span>
              <span class="required-badge">*</span>
            </div>

            <!-- Signer Search Input -->
            <div class="search-wrapper">
              <input
                type="text"
                [formControl]="signerSearchCtrl"
                placeholder="Tìm lãnh đạo..."
                class="input-search"
                (focus)="onSignerSearchFocus()"
                autocomplete="off"
              />

              <!-- Signer Search Dropdown -->
              <div
                class="search-dropdown"
                *ngIf="showSignerDropdown() && signerSearchQuery().length > 0"
              >
                <!-- LOCAL LEADERS -->
                <div *ngIf="signerLocalResults().length > 0">
                  <div
                    class="search-item"
                    *ngFor="let leader of signerLocalResults()"
                    (click)="selectSigner(leader)"
                  >
                    <strong
                      >{{ leader.rankTitle || '' }}
                      {{ leader.fullName }}</strong
                    >
                    <div class="sub">{{ leader.positionTitle }}</div>
                  </div>
                </div>

                <!-- WIDE SEARCH -->
                <div *ngIf="signerWideSearchMode()">
                  <div class="search-divider">Kết quả toàn cơ quan</div>
                  <div *ngIf="signerWideLoading()" class="search-loading">
                    Đang tìm kiếm...
                  </div>
                  <div
                    *ngIf="
                      !signerWideLoading() && signerWideResults().length > 0
                    "
                  >
                    <div
                      class="search-item"
                      *ngFor="let leader of signerWideResults()"
                      (click)="selectSigner(leader)"
                    >
                      <strong
                        >{{ leader.rankTitle || '' }}
                        {{ leader.fullName }}</strong
                      >
                      <div class="sub">{{ leader.positionTitle }}</div>
                    </div>
                  </div>
                  <div class="search-footer">
                    <button
                      type="button"
                      class="link-btn"
                      (click)="exitSignerWideSearch()"
                    >
                      ← Quay lại
                    </button>
                  </div>
                </div>

                <!-- WIDE SEARCH BUTTON -->
                <div
                  *ngIf="
                    !signerWideSearchMode() && signerLocalResults().length === 0
                  "
                  class="search-footer"
                >
                  <button
                    type="button"
                    class="link-btn"
                    (click)="enterSignerWideSearch()"
                  >
                    🔍 Không thấy? Tìm toàn cơ quan
                  </button>
                </div>
              </div>
            </div>

            <!-- Signer Card (Selected) -->
            <div *ngIf="selectedSigner()" class="signer-card">
              <div class="signer-main">
                <strong
                  >{{ selectedSigner()!.rankTitle || '' }}
                  {{ selectedSigner()!.fullName }}</strong
                >
                <div class="signer-title">
                  {{ selectedSigner()!.positionTitle }}
                </div>
              </div>
              <button type="button" class="btn-change" (click)="clearSigner()">
                Đổi
              </button>
            </div>

            <!-- Validation Error -->
            <div
              *ngIf="
                tripForm.get('signerId')?.hasError('required') &&
                tripForm.get('signerId')?.touched
              "
              class="error-text"
            >
              Bắt buộc chọn người duyệt
            </div>
          </div>

          <!-- SECTION 2: DANH SÁCH CÁN BỘ -->
          <div class="form-section persons-section">
            <div class="section-header">
              <span class="section-icon">👥</span>
              <span class="section-title">Danh sách cán bộ</span>
              <span class="required-badge">*</span>
            </div>

            <!-- Personnel Search Input -->
            <div class="search-wrapper">
              <input
                type="text"
                [formControl]="personnelSearchCtrl"
                placeholder="Tìm cán bộ..."
                class="input-search"
                (focus)="onPersonnelSearchFocus()"
                autocomplete="off"
              />

              <!-- Personnel Search Dropdown -->
              <div
                class="search-dropdown"
                *ngIf="
                  showPersonnelDropdown() && personnelSearchQuery().length > 0
                "
              >
                <!-- LOCAL RESULTS -->
                <div *ngIf="personnelLocalResults().length > 0">
                  <div
                    class="search-item"
                    *ngFor="let person of personnelLocalResults()"
                    (click)="addPerson(person)"
                  >
                    <strong
                      >{{ person.rankTitle || '' }}
                      {{ person.fullName }}</strong
                    >
                    <div class="sub">{{ person.positionTitle }}</div>
                  </div>
                </div>

                <!-- WIDE SEARCH -->
                <div *ngIf="personnelWideSearchMode()">
                  <div class="search-divider">Kết quả toàn cơ quan</div>
                  <div *ngIf="personnelWideLoading()" class="search-loading">
                    Đang tìm kiếm...
                  </div>
                  <div
                    *ngIf="
                      !personnelWideLoading() &&
                      personnelWideResults().length > 0
                    "
                  >
                    <div
                      class="search-item"
                      *ngFor="let person of personnelWideResults()"
                      (click)="addPerson(person)"
                    >
                      <strong
                        >{{ person.rankTitle || '' }}
                        {{ person.fullName }}</strong
                      >
                      <div class="sub">{{ person.positionTitle }}</div>
                    </div>
                  </div>
                  <div class="search-footer">
                    <button
                      type="button"
                      class="link-btn"
                      (click)="exitPersonnelWideSearch()"
                    >
                      ← Quay lại
                    </button>
                  </div>
                </div>

                <!-- WIDE SEARCH BUTTON -->
                <div
                  *ngIf="
                    !personnelWideSearchMode() &&
                    personnelLocalResults().length === 0
                  "
                  class="search-footer"
                >
                  <button
                    type="button"
                    class="link-btn"
                    (click)="enterPersonnelWideSearch()"
                  >
                    🔍 Không thấy? Tìm toàn cơ quan
                  </button>
                </div>
              </div>
            </div>

            <!-- Personnel List -->
            <div class="personnel-list" *ngIf="personsArray.length > 0">
              <div
                class="personnel-row"
                *ngFor="let person of personsArray.controls; let i = index"
                [formGroupName]="i"
              >
                <div class="personnel-info">
                  <strong
                    >{{ person.value.rankTitle || '' }}
                    {{ person.value.fullName }}</strong
                  >
                  <div class="sub">{{ person.value.positionTitle }}</div>
                </div>
                <button
                  type="button"
                  class="btn-delete"
                  (click)="removePerson(i)"
                  title="Xóa"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Validation Error -->
            <div
              *ngIf="personsArray.length === 0 && tripForm.touched"
              class="error-text"
            >
              Phải có ít nhất 1 cán bộ
            </div>
          </div>

          <!-- SECTION 3: THÔNG TIN BỔ SUNG (ACCORDION) -->
          <details class="form-section advanced-section">
            <summary class="section-header">
              <span class="section-icon">📋</span>
              <span class="section-title">Thông tin bổ sung</span>
              <span class="hint">(ít dùng, chỉ mở khi cần)</span>
            </summary>

            <div class="advanced-content">
              <div class="form-row">
                <div class="form-group">
                  <label>Số công lệnh</label>
                  <input
                    type="text"
                    formControlName="missionNo"
                    placeholder="VD: CV/2025/..."
                  />
                </div>
                <div class="form-group">
                  <label>Ngày NV</label>
                  <input type="date" formControlName="missionDate" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Từ ngày</label>
                  <input type="date" formControlName="fromDate" />
                </div>
                <div class="form-group">
                  <label>Đến ngày</label>
                  <input type="date" formControlName="toDate" />
                </div>
                <div class="form-group">
                  <label>Ngày khởi hành</label>
                  <input type="date" formControlName="departureDate" />
                </div>
              </div>
            </div>
          </details>

          <!-- SECTION 4: LỘ TRÌNH (ACCORDION) -->
          <details class="form-section stops-section">
            <summary class="section-header">
              <span class="section-icon">🛣️</span>
              <span class="section-title">Lộ trình/Chặng đi</span>
            </summary>

            <div class="stops-content">
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                (click)="addStop()"
              >
                + Thêm chặng
              </button>

              <div class="table-wrapper" *ngIf="stopsArray.length > 0">
                <table class="form-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Nơi đi</th>
                      <th>Ngày/giờ đi</th>
                      <th>Nơi đến</th>
                      <th>Ngày/giờ đến</th>
                      <th>Phương tiện</th>
                      <th>Xóa</th>
                    </tr>
                  </thead>
                  <tbody formArrayName="stops">
                    <tr
                      *ngFor="let stop of stopsArray.controls; let i = index"
                      [formGroupName]="i"
                    >
                      <td class="text-center">{{ i + 1 }}</td>
                      <td>
                        <input
                          formControlName="fromLocation"
                          placeholder="Nơi khởi hành"
                          class="input-small"
                        />
                      </td>
                      <td>
                        <input
                          type="datetime-local"
                          formControlName="fromDateTime"
                          class="input-small"
                        />
                      </td>
                      <td>
                        <input
                          formControlName="toLocation"
                          placeholder="Nơi đến"
                          class="input-small"
                        />
                      </td>
                      <td>
                        <input
                          type="datetime-local"
                          formControlName="toDateTime"
                          class="input-small"
                        />
                      </td>
                      <td>
                        <input
                          formControlName="transport"
                          placeholder="Máy bay/Ôtô"
                          class="input-small"
                        />
                      </td>
                      <td class="text-center">
                        <button
                          type="button"
                          class="btn-delete"
                          (click)="removeStop(i)"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <!-- SPACER -->
          <div class="form-spacer"></div>
        </form>

        <!-- ACTION BAR (sticky bottom) -->
        <div class="action-bar">
          <button type="button" class="btn btn-secondary" (click)="onCancel()">
            Quay lại
          </button>
          <div class="action-spacer"></div>
          <button
            type="button"
            class="btn btn-primary"
            (click)="onSubmit()"
            [disabled]="isSubmitting()"
          >
            {{ isSubmitting() ? 'Đang xử lý...' : 'Lưu & In' }}
          </button>
        </div>
      </div>
    </div>

    <style>
      :host {
        --color-primary: #007bff;
        --color-primary-dark: #0056b3;
        --color-danger: #dc3545;
        --color-border: #ddd;
        --color-bg-light: #f9f9f9;
        --color-text-muted: #666;
      }

      .split-container {
        display: flex;
        height: calc(100vh - 64px);
        overflow: hidden;
        gap: 0;
        background-color: #f5f7fa;
      }

      .preview-panel {
        width: 42%;
        background-color: white;
        border-right: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
      }

      .form-panel {
        width: 58%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .preview-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #fafafa;
      }

      .preview-header h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #333;
      }

      .preview-count {
        font-size: 11px;
        color: #999;
        background: white;
        padding: 3px 6px;
        border-radius: 3px;
        border: 1px solid #eee;
      }

      .preview-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }

      .preview-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #999;
        font-size: 13px;
        text-align: center;
      }

      .preview-item {
        margin-bottom: 16px;
        page-break-inside: avoid;
      }

      /* FORM PANEL */
      .form-wrapper {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }

      .form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .form-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
      }

      .btn-link {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 13px;
        padding: 0;
        text-decoration: none;
      }

      .btn-link:hover {
        text-decoration: underline;
      }

      /* ALERT */
      .alert {
        padding: 12px 16px;
        border-radius: 4px;
        margin-bottom: 16px;
        font-size: 13px;
      }

      .alert-error {
        background-color: #f8d7da;
        border-left: 4px solid var(--color-danger);
        color: #721c24;
      }

      /* SECTIONS */
      .form-section {
        background: white;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .signer-section {
        background: linear-gradient(
          135deg,
          rgba(0, 123, 255, 0.04) 0%,
          rgba(0, 123, 255, 0.02) 100%
        );
        border-left: 4px solid var(--color-primary);
      }

      .persons-section {
        background: linear-gradient(
          135deg,
          rgba(40, 167, 69, 0.04) 0%,
          rgba(40, 167, 69, 0.02) 100%
        );
        border-left: 4px solid #28a745;
      }

      .advanced-section {
        background: white;
        border-left: 4px solid #ffc107;
      }

      .stops-section {
        background: white;
        border-left: 4px solid #6c757d;
      }

      /* SECTION HEADER */
      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #333;
        cursor: pointer;
        margin-bottom: 12px;
        user-select: none;
      }

      details > summary::-webkit-details-marker {
        display: none;
      }

      details > summary::before {
        content: '▶';
        display: inline-block;
        margin-right: 4px;
        transition: transform 0.2s;
        font-size: 11px;
      }

      details[open] > summary::before {
        transform: rotate(90deg);
      }

      .section-icon {
        font-size: 14px;
      }

      .section-title {
        flex: 1;
      }

      .required-badge {
        color: var(--color-danger);
        font-size: 12px;
      }

      .hint {
        font-size: 11px;
        color: #999;
        font-weight: 400;
      }

      /* SEARCH WRAPPER */
      .search-wrapper {
        position: relative;
        margin-bottom: 12px;
      }

      .input-search {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        box-sizing: border-box;
      }

      .input-search:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
      }

      /* SEARCH DROPDOWN */
      .search-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid var(--color-border);
        border-top: none;
        border-radius: 0 0 4px 4px;
        max-height: 350px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .search-item {
        padding: 10px 12px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background 0.15s;
      }

      .search-item:hover {
        background-color: #f9f9f9;
      }

      .search-item strong {
        display: block;
        color: #333;
        margin-bottom: 2px;
        font-size: 13px;
      }

      .search-item .sub {
        font-size: 12px;
        color: var(--color-text-muted);
      }

      .search-divider {
        padding: 8px 12px;
        font-size: 11px;
        font-weight: 600;
        color: #999;
        background-color: #f9f9f9;
        border-top: 1px solid #eee;
        border-bottom: 1px solid #eee;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .search-loading {
        padding: 12px;
        text-align: center;
        color: var(--color-text-muted);
        font-size: 12px;
      }

      .search-footer {
        padding: 8px 12px;
        border-top: 1px solid #f0f0f0;
        background-color: #fafafa;
        text-align: center;
      }

      .link-btn {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        padding: 0;
        text-decoration: none;
      }

      .link-btn:hover {
        color: var(--color-primary-dark);
        text-decoration: underline;
      }

      /* SIGNER CARD */
      .signer-card {
        padding: 12px;
        background-color: #f0f8ff;
        border: 1px solid #b3d9ff;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
      }

      .signer-main {
        flex: 1;
      }

      .signer-main strong {
        display: block;
        font-size: 14px;
        color: #333;
        margin-bottom: 2px;
      }

      .signer-title {
        font-size: 12px;
        color: var(--color-text-muted);
        font-style: italic;
      }

      .btn-change {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        padding: 0;
        text-decoration: underline;
      }

      .btn-change:hover {
        color: var(--color-primary-dark);
      }

      /* PERSONNEL LIST */
      .personnel-list {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .personnel-row {
        padding: 10px 12px;
        background-color: #f0f8ff;
        border: 1px solid #b3d9ff;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .personnel-info {
        flex: 1;
      }

      .personnel-info strong {
        display: block;
        font-size: 13px;
        color: #333;
        margin-bottom: 2px;
      }

      .personnel-info .sub {
        font-size: 12px;
        color: var(--color-text-muted);
      }

      .btn-delete {
        background: none;
        border: none;
        color: var(--color-danger);
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .btn-delete:hover {
        opacity: 0.7;
      }

      /* FORM ROWS & GROUPS */
      .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 12px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
      }

      .form-group label {
        font-size: 12px;
        font-weight: 500;
        color: #333;
        margin-bottom: 4px;
      }

      .form-group input,
      .form-group textarea {
        padding: 8px 10px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 12px;
        font-family: inherit;
      }

      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
      }

      .error-text {
        font-size: 12px;
        color: var(--color-danger);
        margin-top: 6px;
      }

      /* ACCORDION CONTENT */
      .advanced-content {
        padding-top: 12px;
        border-top: 1px solid #eee;
      }

      .stops-content {
        padding-top: 12px;
      }

      /* TABLE */
      .table-wrapper {
        overflow-x: auto;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        margin-top: 12px;
      }

      .form-table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        font-size: 12px;
      }

      .form-table thead {
        background-color: var(--color-bg-light);
        border-bottom: 2px solid var(--color-border);
      }

      .form-table th {
        padding: 8px 10px;
        text-align: left;
        font-weight: 600;
        color: #333;
      }

      .form-table td {
        padding: 6px 10px;
        border-bottom: 1px solid #eee;
      }

      .input-small {
        padding: 6px 8px;
        border: 1px solid var(--color-border);
        border-radius: 3px;
        font-size: 12px;
        width: 100%;
        box-sizing: border-box;
      }

      .input-small:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
      }

      .text-center {
        text-align: center;
      }

      /* BUTTONS */
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s;
      }

      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-primary {
        background-color: var(--color-primary);
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        background-color: var(--color-primary-dark);
      }

      .btn-secondary {
        background-color: #6c757d;
        color: white;
      }

      .btn-secondary:hover:not(:disabled) {
        background-color: #5a6268;
      }

      .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
      }

      .form-spacer {
        height: 20px;
      }

      /* ACTION BAR (sticky) */
      .action-bar {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 12px 16px;
        background-color: white;
        border-top: 1px solid var(--color-border);
        box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
        flex-shrink: 0;
      }

      .action-spacer {
        flex: 1;
      }

      /* RESPONSIVE */
      @media (max-width: 1200px) {
        .split-container {
          flex-direction: column;
          height: auto;
        }
        .preview-panel {
          width: 100%;
          height: 300px;
          border-right: none;
          border-bottom: 1px solid var(--color-border);
        }
        .form-panel {
          width: 100%;
        }
      }
    </style>
  `,
})
export class TripCreateComponent implements OnInit {
  tripForm!: FormGroup;
  isSubmitting = signal(false);
  errorMsg = signal('');
  previewPersons = signal<any[]>([]);

  // Signer (người duyệt) search signals
  signerSearchCtrl = new FormControl('');
  signerSearchQuery = signal('');
  showSignerDropdown = signal(false);
  signerWideSearchMode = signal(false);
  signerWideLoading = signal(false);
  signerLocalResults = signal<PersonnelDto[]>([]);
  signerWideResults = signal<PersonnelDto[]>([]);
  selectedSigner = signal<PersonnelDto | null>(null);

  // Personnel search signals
  personnelSearchCtrl = new FormControl('');
  personnelSearchQuery = signal('');
  showPersonnelDropdown = signal(false);
  personnelWideSearchMode = signal(false);
  personnelWideLoading = signal(false);
  personnelLocalResults = signal<PersonnelDto[]>([]);
  personnelWideResults = signal<PersonnelDto[]>([]);

  constructor(
    private fb: FormBuilder,
    private api: TravelApiService,
    private personnelApi: PersonnelApiService,
    private personnelStore: PersonnelStoreService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.tripForm.valueChanges.subscribe(() => this.updatePreview());

    // Preload scope personnel
    this.personnelStore.preloadScopePersonnel().subscribe();

    // Setup signer search with debounce
    this.signerSearchCtrl.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged())
      .subscribe((query) => {
        this.onSignerSearchChange(query || '');
      });

    // Setup personnel search with debounce
    this.personnelSearchCtrl.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged())
      .subscribe((query) => {
        this.onPersonnelSearchChange(query || '');
      });
  }

  initializeForm() {
    this.tripForm = this.fb.group({
      // Removed: tripNo, purpose
      signerId: ['', Validators.required],
      signerName: [''],
      signerRankTitle: [''],
      signerTitle: [''],
      missionNo: [''],
      missionDate: [''],
      fromDate: [''],
      toDate: [''],
      departureDate: [''],
      stops: this.fb.array([]),
      persons: this.fb.array([]),
    });
  }

  createStopGroup() {
    return this.fb.group({
      fromLocation: ['', Validators.required],
      fromDateTime: [''],
      toLocation: [''],
      toDateTime: [''],
      transport: [''],
    });
  }

  createPersonGroup() {
    return this.fb.group({
      fullName: [''],
      personCode: [''],
      positionTitle: [''],
      rankTitle: [''],
      unitName: [''],
      unitCode: [''],
    });
  }

  get stopsArray(): FormArray {
    return this.tripForm.get('stops') as FormArray;
  }

  get personsArray(): FormArray {
    return this.tripForm.get('persons') as FormArray;
  }

  addStop() {
    this.stopsArray.push(this.createStopGroup());
  }

  removeStop(index: number) {
    this.stopsArray.removeAt(index);
  }

  removePerson(index: number) {
    this.personsArray.removeAt(index);
  }

  // ── SIGNER SEARCH ──
  onSignerSearchFocus() {
    if (this.signerSearchQuery().length > 0) {
      this.showSignerDropdown.set(true);
    }
  }

  onSignerSearchChange(query: string) {
    query = query.trim().toLowerCase();
    this.signerSearchQuery.set(query);

    if (query.length === 0) {
      this.showSignerDropdown.set(false);
      this.signerLocalResults.set([]);
      this.signerWideResults.set([]);
      this.signerWideSearchMode.set(false);
      return;
    }

    // Filter leaders from scope
    const scopeList = this.personnelStore.getScopePersonnel();
    const leaders = scopeList.filter((p) => p.isLeader);
    const filtered = this.filterLocal(leaders, query);
    this.signerLocalResults.set(filtered);
    this.showSignerDropdown.set(true);
  }

  enterSignerWideSearch() {
    const query = this.signerSearchQuery();
    if (query.length === 0) return;

    this.signerWideSearchMode.set(true);
    this.signerWideLoading.set(true);
    this.signerWideResults.set([]);

    this.personnelApi.searchPersonnel(query, 'leader', 1, 50).subscribe({
      next: (result) => {
        this.signerWideResults.set(result.items);
        this.signerWideLoading.set(false);
      },
      error: () => {
        this.signerWideLoading.set(false);
        this.signerWideResults.set([]);
      },
    });
  }

  exitSignerWideSearch() {
    this.signerWideSearchMode.set(false);
    this.signerWideResults.set([]);
    this.signerWideLoading.set(false);
  }

  selectSigner(signer: PersonnelDto) {
    this.selectedSigner.set(signer);
    this.tripForm.patchValue({
      signerId: signer.username,
      signerName: signer.fullName,
      signerRankTitle: signer.rankTitle,
      signerTitle: signer.positionTitle,
    });
    this.signerSearchCtrl.setValue('');
    this.signerSearchQuery.set('');
    this.showSignerDropdown.set(false);
    this.signerLocalResults.set([]);
    this.signerWideResults.set([]);
    this.signerWideSearchMode.set(false);
  }

  clearSigner() {
    this.selectedSigner.set(null);
    this.tripForm.patchValue({
      signerId: '',
      signerName: '',
      signerRankTitle: '',
      signerTitle: '',
    });
  }

  // ── PERSONNEL SEARCH ──
  onPersonnelSearchFocus() {
    if (this.personnelSearchQuery().length > 0) {
      this.showPersonnelDropdown.set(true);
    }
  }

  onPersonnelSearchChange(query: string) {
    query = query.trim().toLowerCase();
    this.personnelSearchQuery.set(query);

    if (query.length === 0) {
      this.showPersonnelDropdown.set(false);
      this.personnelLocalResults.set([]);
      this.personnelWideResults.set([]);
      this.personnelWideSearchMode.set(false);
      return;
    }

    // Filter from scope
    const scopeList = this.personnelStore.getScopePersonnel();
    const filtered = this.filterLocal(scopeList, query);
    this.personnelLocalResults.set(filtered);
    this.showPersonnelDropdown.set(true);
  }

  enterPersonnelWideSearch() {
    const query = this.personnelSearchQuery();
    if (query.length === 0) return;

    this.personnelWideSearchMode.set(true);
    this.personnelWideLoading.set(true);
    this.personnelWideResults.set([]);

    this.personnelApi.searchPersonnel(query, undefined, 1, 50).subscribe({
      next: (result) => {
        this.personnelWideResults.set(result.items);
        this.personnelWideLoading.set(false);
      },
      error: () => {
        this.personnelWideLoading.set(false);
        this.personnelWideResults.set([]);
      },
    });
  }

  exitPersonnelWideSearch() {
    this.personnelWideSearchMode.set(false);
    this.personnelWideResults.set([]);
    this.personnelWideLoading.set(false);
  }

  addPerson(person: PersonnelDto) {
    const personGroup = this.createPersonGroup();
    personGroup.patchValue({
      fullName: person.fullName,
      personCode: person.username,
      positionTitle: person.positionTitle,
      rankTitle: person.rankTitle,
      unitName: person.unitName,
      unitCode: person.orgCode,
    });

    this.personsArray.push(personGroup);
    this.personnelSearchCtrl.setValue('');
    this.personnelSearchQuery.set('');
    this.showPersonnelDropdown.set(false);
    this.personnelLocalResults.set([]);
    this.personnelWideResults.set([]);
    this.personnelWideSearchMode.set(false);
  }

  private filterLocal(list: PersonnelDto[], query: string): PersonnelDto[] {
    return list.filter(
      (p) =>
        p.fullName?.toLowerCase().includes(query) ||
        false ||
        p.positionTitle?.toLowerCase().includes(query) ||
        false ||
        p.unitName?.toLowerCase().includes(query) ||
        false
    );
  }

  updatePreview() {
    const formValue = this.tripForm.value;
    this.previewPersons.set(
      formValue.persons.map((person: any) => ({
        ...person,
        signerName: this.selectedSigner()?.fullName,
        signerTitle: this.selectedSigner()?.positionTitle,
        signerRankTitle: this.selectedSigner()?.rankTitle,
        missionNo: formValue.missionNo,
        missionDate: formValue.missionDate,
        fromDate: formValue.fromDate,
        toDate: formValue.toDate,
        departureDate: formValue.departureDate,
        stops: formValue.stops,
      }))
    );
  }

  buildPreviewModel(person: any, index: number): TravelOrderPreviewModel {
    return {
      orderNo: `(${index + 1})`,
      tripNo: '', // Will be generated by backend
      fullName: person.fullName,
      positionTitle: person.positionTitle,
      rankTitle: person.rankTitle,
      unitName: person.unitName,
      missionNo: person.missionNo,
      missionDate: person.missionDate,
      purpose: '', // Removed
      fromDate: person.fromDate,
      toDate: person.toDate,
      departureDate: person.departureDate,
      signerName: person.signerName,
      signerTitle: person.signerTitle,
      signerUnitName: '', // Removed
      stops: (this.tripForm.get('stops') as FormArray).value.map(
        (stop: any, i: number) => ({
          stopIndex: i,
          ...stop,
        })
      ),
    };
  }

  onCancel() {
    if (confirm('Bạn có chắc muốn hủy? Dữ liệu chưa lưu sẽ mất.')) {
      this.router.navigate(['/travel/trips']);
    }
  }

  onSubmit() {
    // Validate
    if (!this.selectedSigner()) {
      this.errorMsg.set('Bắt buộc chọn người duyệt');
      return;
    }

    if (this.personsArray.length === 0) {
      this.errorMsg.set('Phải có ít nhất 1 cán bộ');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMsg.set('');

    const formValue = this.tripForm.value;
    const request: CreateTravelTripRequest = {
      tripNo: '', // Backend generates
      purpose: '', // Removed
      missionNo: formValue.missionNo || null,
      missionDate: formValue.missionDate || null,
      fromDate: formValue.fromDate || null,
      toDate: formValue.toDate || null,
      departureDate: formValue.departureDate || null,
      signerName: this.selectedSigner()!.fullName,
      signerTitle: this.selectedSigner()!.positionTitle,
      signerUnitName: '', // Removed
      stops: formValue.stops.map((stop: any, index: number) => ({
        ...stop,
        stopIndex: index,
      })),
      persons: formValue.persons.map((person: any, index: number) => ({
        ...person,
        orderNo: `ORD-${index + 1}`,
        stopOverrides: [],
      })),
    };

    this.api.createTrip(request).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/travel/trips', res.tripId]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMsg.set(
          'Tạo đợt thất bại: ' +
            (err?.error?.error || err?.message || 'Lỗi không xác định')
        );
      },
    });
  }
}
