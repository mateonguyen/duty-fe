import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

export interface TocNode {
  title: string;
  slug?: string; // undefined for group nodes
  children?: TocNode[];
}

@Injectable({ providedIn: 'root' })
export class DocsService {
  private http = inject(HttpClient);
  private toc$?: Observable<TocNode[]>;
  private markdownCache = new Map<string, ReplaySubject<string>>();

  getToc(): Observable<TocNode[]> {
    if (!this.toc$) {
      this.toc$ = this.http
        .get<TocNode[]>('assets/docs/toc.json')
        .pipe(shareReplay(1));
    }
    return this.toc$;
  }

  getMarkdown(slug: string): Observable<string> {
    const norm = slug.trim();
    if (!norm) return of('# Missing slug');
    if (!this.markdownCache.has(norm)) {
      const sub = new ReplaySubject<string>(1);
      this.http
        .get(`assets/docs/${norm}.md`, { responseType: 'text' })
        .subscribe({
          next: (txt) => sub.next(txt),
          error: () => sub.next('# 404\n\nTài liệu chưa tồn tại.'),
        });
      this.markdownCache.set(norm, sub);
    }
    return this.markdownCache.get(norm)!;
  }

  // Flatten TOC to linear ordered list of slugs
  flatten(nodes: TocNode[]): string[] {
    const result: string[] = [];
    const walk = (n: TocNode[]) => {
      for (const node of n) {
        if (node.slug) result.push(node.slug);
        if (node.children) walk(node.children);
      }
    };
    walk(nodes);
    return result;
  }

  // Find breadcrumb path (nodes) for slug
  findPath(nodes: TocNode[], slug: string): TocNode[] {
    const path: TocNode[] = [];
    const dfs = (list: TocNode[]): boolean => {
      for (const n of list) {
        path.push(n);
        if (n.slug === slug) return true;
        if (n.children && dfs(n.children)) return true;
        path.pop();
      }
      return false;
    };
    dfs(nodes);
    return path.filter((p) => p.slug || p.children); // clean
  }

  // Accent insensitive search over titles
  filter(nodes: TocNode[], term: string): TocNode[] {
    const t = this.normalize(term);
    if (!t) return nodes;
    const matchNode = (n: TocNode): boolean =>
      this.normalize(n.title).includes(t);
    const recur = (list: TocNode[]): TocNode[] => {
      const out: TocNode[] = [];
      for (const n of list) {
        const childMatches = n.children ? recur(n.children) : [];
        if (matchNode(n) || childMatches.length) {
          out.push({
            ...n,
            children: childMatches.length ? childMatches : n.children,
          });
        }
      }
      return out;
    };
    return recur(nodes);
  }

  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd');
  }
}
