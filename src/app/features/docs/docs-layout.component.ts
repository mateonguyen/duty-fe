import { Component, inject, signal, computed, effect } from '@angular/core';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DocsService, TocNode } from './docs.service';
import { DocsNavTreeComponent } from './docs-nav-tree.component';
import { DocsViewerComponent } from './docs-viewer.component';

@Component({
  standalone: true,
  selector: 'app-docs-layout',
  templateUrl: './docs-layout.component.html',
  styleUrls: ['./docs-layout.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    DocsNavTreeComponent,
    DocsViewerComponent,
  ],
})
export class DocsLayoutComponent {
  private svc = inject(DocsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  toc = signal<TocNode[]>([]);
  search = signal('');
  filtered = computed(() => this.svc.filter(this.toc(), this.search()));

  // current slug (captures remainder after /docs)
  slug = signal<string>('');

  constructor() {
    this.svc.getToc().subscribe((t) => {
      this.toc.set(t);
      this.initSlug();
    });
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.initSlug();
      });
    // effect moved to field initializer
  }

  // persist search (optional future)
  private _persistSearchEffect = effect(() => {
    // persist search (optional future)
  });

  private initSlug() {
    const url = this.router.url; // e.g. /docs, /docs/intro, /docs/admin/catalogs/shifts
    let part = url.replace(/^\/docs\/?/, '');
    if (!part) part = 'intro';
    this.slug.set(part);
    localStorage.setItem('docs.lastSlug', part);
  }

  onNavigate(slug: string) {
    this.router.navigate(['/docs', slug]);
    this.slug.set(slug);
    localStorage.setItem('docs.lastSlug', slug);
  }
}
