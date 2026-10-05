import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfJsViewerModule } from 'ng2-pdfjs-viewer';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

/**
 * FileConfig interface for file preview
 */
export interface FileConfig {
  filePath: string; // blob:... URL only
  fileName: string;
  isBlobUrl?: boolean;
  fileObject?: File;
}

/**
 * Reusable File View Component
 * Supports PDF preview using ng2-pdfjs-viewer (PDF.js)
 * No iframe/object; unified viewer UI with header, states
 */
@Component({
  selector: 'app-file-view',
  standalone: true,
  imports: [CommonModule, PdfJsViewerModule, ButtonModule, TooltipModule],
  templateUrl: './file-view.component.html',
  styleUrls: ['./file-view.component.scss'],
})
export class FileViewComponent implements OnChanges {
  @Input() fileConfig: FileConfig | null = null;
  @Input() showHeader = false;
  @Input() visible = true;
  @Input() allowPrint = true;
  @Input() allowDownload = true;

  @ViewChild('pdfViewer') pdfViewer: any;

  // Component state
  selectedPdfSrc: string | null = null;
  currentFileName: string | null = null;
  currentFileType: 'pdf' | 'word' | 'excel' | 'other' = 'pdf';
  isLoading = false;
  hasError = false;
  errorMessage = '';

  isValidSource(): boolean {
    const fc = this.fileConfig;
    const url = fc?.filePath ?? '';
    const valid = !!fc && typeof url === 'string' && url.length > 0;
    if (fc && !valid) {
      console.error('[FileView] invalid source for preview', fc);
    }
    return valid;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['fileConfig']) {
      console.debug('[FileView] config changed:', this.fileConfig);
      this.loadFile();
    }
  }

  private loadFile() {
    this.hasError = false;
    this.errorMessage = '';

    if (!this.fileConfig) {
      this.selectedPdfSrc = null;
      this.currentFileName = null;
      return;
    }

    this.isLoading = true;
    this.currentFileName = this.fileConfig.fileName;
    this.currentFileType = this.detectFileType(this.fileConfig.fileName);

    try {
      // Set PDF source from blob URL or file path
      this.selectedPdfSrc = this.fileConfig.filePath;
      this.isLoading = false;
    } catch (error) {
      console.error('[FileView] Error loading file:', error);
      this.hasError = true;
      this.errorMessage = 'Không thể tải file. Vui lòng thử lại.';
      this.isLoading = false;
    }
  }

  private detectFileType(fileName: string): 'pdf' | 'word' | 'excel' | 'other' {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'doc' || ext === 'docx') return 'word';
    if (ext === 'xls' || ext === 'xlsx') return 'excel';
    return 'other';
  }

  downloadFile() {
    if (!this.fileConfig) return;

    const link = document.createElement('a');
    link.href = this.fileConfig.filePath;
    link.download = this.fileConfig.fileName;
    link.click();
  }

  retryLoad() {
    this.loadFile();
  }
}
