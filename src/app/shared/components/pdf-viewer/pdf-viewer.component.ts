import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Reusable PDF Viewer Component
 * Wraps native browser PDF viewer (embedded object)
 * Supports: zoom, print, download via browser's built-in controls
 */
@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="pdf-viewer-container">
      <div class="pdf-viewer-toolbar" *ngIf="showToolbar">
        <div class="toolbar-title">{{ fileName }}</div>
        <div class="toolbar-actions">
          <button
            pButton
            type="button"
            icon="pi pi-download"
            class="p-button-sm p-button-text"
            (click)="downloadPdf()"
            title="Tải xuống"
          ></button>
          <button
            pButton
            type="button"
            icon="pi pi-print"
            class="p-button-sm p-button-text"
            (click)="printPdf()"
            title="In"
          ></button>
        </div>
      </div>
      <object
        *ngIf="safeSrc"
        [data]="safeSrc"
        type="application/pdf"
        class="pdf-object"
      >
        <p>
          PDF viewer không được hỗ trợ.
          <a [href]="effectiveSrc" download>Tải xuống</a>
        </p>
      </object>
      <div *ngIf="!safeSrc" class="pdf-placeholder">
        <i class="pi pi-file-pdf"></i>
        <p>Không có PDF để xem</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        width: 100%;
      }

      .pdf-viewer-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
      }

      .pdf-viewer-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: white;
        border-bottom: 1px solid #e0e0e0;
        flex-shrink: 0;
      }

      .toolbar-title {
        font-size: 13px;
        color: #666;
        font-weight: 500;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .toolbar-actions {
        display: flex;
        gap: 4px;
        margin-left: 12px;
      }

      .pdf-object {
        flex: 1;
        width: 100%;
        height: 100%;
        border: none;
      }

      .pdf-placeholder {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        flex: 1;
        color: #999;
        font-size: 14px;
      }

      .pdf-placeholder i {
        font-size: 48px;
        margin-bottom: 12px;
        color: #ddd;
      }
    `,
  ],
})
export class PdfViewerComponent implements OnChanges {
  // New preferred input
  @Input() src: string | null = null;
  // Backward-compatibility: still accept pdfBlobUrl, but will be deprecated
  @Input() pdfBlobUrl: string | null = null;
  @Input() fileName: string = 'document.pdf';
  @Input() showToolbar = true;
  @Output() download = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();

  safeSrc: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  get effectiveSrc(): string | null {
    return this.src ?? this.pdfBlobUrl;
  }

  ngOnChanges(changes: SimpleChanges) {
    const src = this.effectiveSrc;
    this.safeSrc = src
      ? this.sanitizer.bypassSecurityTrustResourceUrl(src)
      : null;
  }

  downloadPdf() {
    this.download.emit();
  }

  printPdf() {
    this.print.emit();
  }
}
