import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocsService, TocNode } from './docs.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { marked } from 'marked';

@Component({
  standalone: true,
  selector: 'app-docs-viewer',
  imports: [CommonModule],
  templateUrl: './docs-viewer.component.html',
  styleUrls: ['./docs-viewer.component.scss'],
})
export class DocsViewerComponent implements OnChanges {
  private svc = inject(DocsService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  @Input() slug: string = '';
  @Input() toc: TocNode[] = [];
  @Output() navigate = new EventEmitter<string>();

  html = signal<SafeHtml>('');
  path = signal<TocNode[]>([]);
  orderedSlugs: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['toc'] && this.toc.length) {
      this.orderedSlugs = this.svc.flatten(this.toc);
    }
    if (changes['slug'] && this.slug) {
      this.load();
    }
  }

  load() {
    this.path.set(this.svc.findPath(this.toc, this.slug));
    this.svc.getMarkdown(this.slug).subscribe((md) => {
      // marked.parse can return Promise; ensure string usage
      const rendered = marked.parse(md) as string;
      const anchored = this.injectAnchors(rendered);
      this.html.set(this.sanitizer.bypassSecurityTrustHtml(anchored));
    });
  }

  injectAnchors(html: string): string {
    return html.replace(/<h([23])>([^<]+)<\/h[23]>/g, (m, level, text) => {
      const id = text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link">#</a> ${text}</h${level}>`;
    });
  }

  prevSlug(): string | null {
    const idx = this.orderedSlugs.indexOf(this.slug);
    if (idx > 0) return this.orderedSlugs[idx - 1];
    return null;
  }
  nextSlug(): string | null {
    const idx = this.orderedSlugs.indexOf(this.slug);
    if (idx >= 0 && idx < this.orderedSlugs.length - 1)
      return this.orderedSlugs[idx + 1];
    return null;
  }

  goPrev() {
    const p = this.prevSlug();
    if (p) this.navigate.emit(p);
  }
  goNext() {
    const n = this.nextSlug();
    if (n) this.navigate.emit(n);
  }
}
