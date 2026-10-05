import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TravelOrderPreviewModel } from '../models/travel.models';

/**
 * Preview component render giấy đi đường A4 theo mẫu
 * Input: data from form or OrderViewDto
 * Render HTML/CSS bám mẫu doc, support page-break & print-to-PDF
 */
@Component({
  selector: 'app-travel-preview-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="travel-doc-page">
      <!-- Header cơ quan -->
      <div class="doc-header">
        <div class="header-left">
          <div class="org-logo">BCA</div>
        </div>
        <div class="header-center">
          <div class="org-name">BỘ CÔNG AN</div>
          <div class="org-title">CỤC QUẢN LÝ XUẤT NHẬP CẢNG</div>
        </div>
        <div class="header-right"></div>
      </div>

      <!-- Tiêu đề GIẤY ĐI ĐƯỜNG -->
      <div class="doc-title">
        <h1>GIẤY ĐI ĐƯỜNG</h1>
        <div *ngIf="data" class="doc-number">
          Số: {{ data.orderNo || '(chưa lưu)' }}
        </div>
      </div>

      <!-- Phần 1: Thông tin cán bộ & công lệnh -->
      <div *ngIf="data" class="doc-section-1">
        <p class="section-text">
          <strong>Cấp cho đồng chí:</strong>
          <span class="field-value">{{ getDisplayNameWithRank(data) }}</span>
        </p>
        <p class="section-text">
          <span *ngIf="data.positionTitle" class="field-label">Chức vụ:</span>
          <span class="field-value">{{ data.positionTitle || '-' }}</span>
          <span
            *ngIf="data.rankTitle"
            class="field-label"
            style="margin-left: 20px;"
            >Cấp bậc:</span
          >
          <span *ngIf="data.rankTitle" class="field-value">{{
            data.rankTitle
          }}</span>
        </p>
        <p class="section-text">
          <strong>Đơn vị:</strong>
          <span class="field-value">{{ data.unitName }}</span>
        </p>

        <p class="section-text" *ngIf="data.purpose">
          <strong>Được cử đi công tác tại:</strong>
          <span class="field-value">{{ data.purpose }}</span>
        </p>

        <p class="section-text" *ngIf="data.missionNo || data.missionDate">
          <strong>Theo công lệnh số</strong>
          <span *ngIf="data.missionNo" class="field-value">{{
            data.missionNo
          }}</span>
          <strong *ngIf="data.missionDate" style="margin-left: 10px;"
            >ngày</strong
          >
          <span *ngIf="data.missionDate" class="field-value">{{
            formatDate(data.missionDate)
          }}</span>
        </p>

        <p class="section-text" *ngIf="data.fromDate || data.toDate">
          <strong>Từ ngày:</strong>
          <span class="field-value">{{ formatDate(data.fromDate) }}</span>
          <strong style="margin-left: 20px;">Đến ngày:</strong>
          <span class="field-value">{{ formatDate(data.toDate) }}</span>
        </p>

        <p class="section-text" *ngIf="data.departureDate">
          <strong>Ngày khởi hành:</strong>
          <span class="field-value">{{ formatDate(data.departureDate) }}</span>
        </p>
      </div>

      <!-- Phần 2: Bảng lộ trình -->
      <div
        *ngIf="data && data.stops && data.stops.length > 0"
        class="doc-section-2"
      >
        <h3>LỘ TRÌNH ĐI CÔNG TÁC</h3>
        <table class="doc-table">
          <thead>
            <tr>
              <th class="col-idx">STT</th>
              <th class="col-from-to">Nơi đi</th>
              <th class="col-date-time">Ngày giờ đi</th>
              <th class="col-from-to">Nơi đến</th>
              <th class="col-date-time">Ngày giờ đến</th>
              <th class="col-transport">Phương tiện</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let stop of data.stops; let i = index">
              <td class="col-idx">{{ i + 1 }}</td>
              <td class="col-from-to">{{ stop.fromLocation }}</td>
              <td class="col-date-time">
                {{ formatDateTime(stop.fromDateTime) }}
              </td>
              <td class="col-from-to">{{ stop.toLocation || '-' }}</td>
              <td class="col-date-time">
                {{ formatDateTime(stop.toDateTime) }}
              </td>
              <td class="col-transport">{{ stop.transport || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phần 3: Ký tên -->
      <div *ngIf="data" class="doc-section-3">
        <div class="signature-block">
          <div class="sig-col">
            <p class="sig-label">Người đề nghị</p>
            <div class="sig-space"></div>
            <p class="sig-name"></p>
          </div>
          <div class="sig-col">
            <p class="sig-label">Người phê duyệt</p>
            <div class="sig-space"></div>
            <p class="sig-name">{{ data.signerName || '(chưa kí)' }}</p>
            <p class="sig-title">{{ data.signerTitle || '' }}</p>
            <p class="sig-unit">{{ data.signerUnitName || '' }}</p>
          </div>
        </div>
        <div class="doc-date">Ngày ...... tháng ...... năm ......</div>
      </div>
    </div>

    <style>
      .travel-doc-page {
        width: 210mm;
        height: 297mm;
        padding: 15mm;
        margin: 0 auto 20px;
        background: white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border: 1px solid #ddd;
        font-family: 'Times New Roman', serif;
        font-size: 13px;
        line-height: 1.4;
        color: #000;
        box-sizing: border-box;
      }

      .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #000;
      }

      .header-left {
        width: 15%;
      }
      .header-center {
        width: 70%;
        text-align: center;
      }
      .header-right {
        width: 15%;
      }

      .org-logo {
        font-size: 20px;
        font-weight: bold;
        text-align: center;
      }

      .org-name {
        font-weight: bold;
        font-size: 14px;
        margin-bottom: 2px;
      }

      .org-title {
        font-size: 12px;
      }

      .doc-title {
        text-align: center;
        margin: 20px 0;
      }

      .doc-title h1 {
        margin: 0;
        font-size: 18px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .doc-number {
        font-size: 12px;
        margin-top: 5px;
      }

      .doc-section-1 {
        margin-bottom: 20px;
      }

      .section-text {
        margin: 8px 0;
        padding: 0;
      }

      .field-label {
        font-weight: 500;
        margin-right: 10px;
      }

      .field-value {
        border-bottom: 1px dotted #000;
        padding: 0 5px;
        min-width: 100px;
        display: inline-block;
      }

      .doc-section-2 {
        margin: 25px 0;
      }

      .doc-section-2 h3 {
        margin: 0 0 10px 0;
        font-size: 13px;
        font-weight: bold;
        text-align: center;
        text-transform: uppercase;
      }

      .doc-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 15px;
      }

      .doc-table thead {
        background-color: #f0f0f0;
      }

      .doc-table th {
        border: 1px solid #000;
        padding: 6px;
        text-align: center;
        font-weight: bold;
        font-size: 11px;
      }

      .doc-table td {
        border: 1px solid #000;
        padding: 6px;
        text-align: left;
        font-size: 12px;
      }

      .col-idx {
        width: 5%;
      }
      .col-from-to {
        width: 20%;
      }
      .col-date-time {
        width: 18%;
      }
      .col-transport {
        width: 15%;
      }

      .doc-section-3 {
        margin-top: 30px;
      }

      .signature-block {
        display: flex;
        justify-content: space-around;
        margin-bottom: 20px;
      }

      .sig-col {
        text-align: center;
        width: 35%;
      }

      .sig-label {
        font-weight: bold;
        margin-bottom: 40px;
      }

      .sig-space {
        height: 50px;
        border-bottom: 1px solid #000;
        margin: 20px 0;
      }

      .sig-name {
        margin: 10px 0 0 0;
        font-weight: bold;
      }

      .sig-title {
        font-size: 11px;
        margin: 2px 0;
      }

      .sig-unit {
        font-size: 11px;
        margin: 2px 0 0 0;
      }

      .doc-date {
        text-align: center;
        margin-top: 20px;
        font-style: italic;
        font-size: 12px;
      }

      @media print {
        .travel-doc-page {
          page-break-after: always;
          box-shadow: none;
          border: none;
          margin: 0;
          padding: 15mm;
        }
      }

      @page {
        size: A4;
        margin: 0;
      }
    </style>
  `,
})
export class TravelPreviewPageComponent {
  @Input() data: TravelOrderPreviewModel | null = null;

  getDisplayNameWithRank(data: TravelOrderPreviewModel | null): string {
    if (!data) return '';
    return (
      data.displayNameWithRank ||
      [data.rankName || data.rankTitle, data.fullName].filter(Boolean).join(' ')
    );
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '______/______/______';
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  }

  formatDateTime(dateTimeStr?: string): string {
    if (!dateTimeStr) return '-';
    try {
      const date = new Date(dateTimeStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    } catch {
      return dateTimeStr;
    }
  }
}
