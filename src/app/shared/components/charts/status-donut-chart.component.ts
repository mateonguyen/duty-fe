import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-donut-chart', standalone: true, imports: [CommonModule],
  template: `
    <figure class="status-chart" [attr.aria-label]="label">
      <div class="donut" role="img" [style.background]="background" [attr.aria-label]="description">
        <div class="center ui-numeric"><strong>{{ total }}</strong><span>tổng số giấy</span></div>
      </div>
      <figcaption><ul class="legend"><li *ngFor="let item of data"><span class="swatch" [style.background]="color(item.code)" aria-hidden="true"></span><span>{{ item.name }}</span><strong class="ui-numeric">{{ item.count }}</strong></li></ul></figcaption>
    </figure>
    <details><summary class="ui-link">Xem bảng số liệu giấy</summary><table class="ui-data-table"><caption class="ui-sr-only">{{ label }}</caption><thead><tr><th scope="col">Trạng thái</th><th scope="col">Số giấy</th></tr></thead><tbody><tr *ngFor="let item of data"><td>{{ item.name }}</td><td class="ui-numeric">{{ item.count }}</td></tr></tbody></table></details>`,
  styles: [`
    :host{display:block;min-width:0}.status-chart{display:flex;align-items:center;justify-content:center;gap:24px;margin:var(--ui-chart-top-gap,28px) 0 12px}.donut{width:var(--ui-chart-donut-size,154px);height:var(--ui-chart-donut-size,154px);border-radius:50%;position:relative;display:grid;place-items:center;flex-shrink:0}.donut:before{content:'';position:absolute;inset:19px;background:var(--ui-surface);border-radius:50%}.center{position:relative;text-align:center}.center strong{display:block;font-size:30px;line-height:1.2;font-weight:600}.center span{font-size:12px;color:var(--ui-text-muted)}figcaption{flex:1;min-width:110px}.legend{margin:0;padding:0;list-style:none}.legend li{display:flex;gap:8px;align-items:center;padding:6px 0;font-size:13px}.legend strong{margin-left:auto;font-weight:600}.swatch{width:9px;height:9px;border-radius:3px;flex-shrink:0}summary{cursor:pointer;min-height:36px;line-height:36px;font-size:13px}
    @media(max-width:1100px) and (min-width:801px){.status-chart{flex-wrap:wrap;gap:16px}figcaption{min-width:140px}}@media(max-width:500px){.status-chart{gap:16px}.donut{width:130px;height:130px}.legend li{font-size:12px}}`],
})
export class StatusDonutChartComponent {
  @Input() data: { code: string; name: string; count: number }[] = [];
  @Input() label = 'Giấy đi đường theo trạng thái';
  get total(): number { return this.data.reduce((sum, x) => sum + x.count, 0); }
  get description(): string { return `${this.label}: ${this.total} giấy. ${this.data.map(x => `${x.name}: ${x.count}`).join('; ')}`; }
  color(code: string): string {
    return ({ DRAFT: 'var(--ui-chart-4)', ISSUED: '#876896', CANCELLED: 'var(--ui-chart-5)', DELETED: 'var(--ui-chart-3)', OTHER: 'var(--ui-chart-2)' } as Record<string, string>)[code] || '#876896';
  }
  get background(): string {
    if (!this.total) return 'var(--ui-border)';
    let end = 0;
    const stops = this.data.map(item => { const start = end; end += item.count / this.total * 100; return `${this.color(item.code)} ${start}% ${end}%`; });
    return `conic-gradient(${stops.join(',')})`;
  }
}
