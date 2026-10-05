import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TocNode } from './docs.service';

@Component({
  standalone: true,
  selector: 'app-docs-nav-tree',
  imports: [CommonModule],
  templateUrl: './docs-nav-tree.component.html',
  styleUrls: ['./docs-nav-tree.component.scss'],
})
export class DocsNavTreeComponent implements OnChanges {
  @Input() toc: TocNode[] = [];
  @Input() activeSlug: string = '';
  @Output() navigate = new EventEmitter<string>();

  expanded = new Set<string>(
    JSON.parse(localStorage.getItem('docs.expanded') || '[]')
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeSlug'] && this.activeSlug) {
      // Auto-expand path to active slug
      const pathNodes = this.findPath(this.toc, this.activeSlug);
      for (const n of pathNodes) {
        if (n.children) {
          this.expanded.add(this.nodeKey(n));
        }
      }
      localStorage.setItem(
        'docs.expanded',
        JSON.stringify(Array.from(this.expanded))
      );
    }
  }

  toggle(node: TocNode) {
    const key = this.nodeKey(node);
    if (this.expanded.has(key)) this.expanded.delete(key);
    else this.expanded.add(key);
    localStorage.setItem(
      'docs.expanded',
      JSON.stringify(Array.from(this.expanded))
    );
  }

  private findPath(nodes: TocNode[], slug: string): TocNode[] {
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
    return [...path];
  }

  nodeKey(n: TocNode) {
    return n.title + '|' + (n.slug || 'group');
  }

  onClick(node: TocNode) {
    if (node.slug) this.navigate.emit(node.slug);
  }

  isExpanded(n: TocNode) {
    return this.expanded.has(this.nodeKey(n));
  }
}
