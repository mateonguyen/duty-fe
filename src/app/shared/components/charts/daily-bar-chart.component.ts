import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-daily-bar-chart', standalone: true, imports: [CommonModule],
  template: `
    <figure class="bar-chart" [attr.aria-label]="label">
      <figcaption class="ui-sr-only">{{ label }}. Đơn vị: lượt. Bảng số liệu ở bên dưới.</figcaption>
      <div class="plot" aria-hidden="true">
        <div class="grid"><div *ngFor="let tick of ticks"><span>{{ tick }}</span></div></div>
        <div class="bars" [style.grid-template-columns]="'repeat(' + data.length + ', minmax(0, 1fr))'">
          <div class="cell" *ngFor="let item of data; let i = index">
            <div class="bar-zone" [attr.title]="dateLabel(item.date) + ': ' + item.count + ' lượt'">
              <span class="value ui-numeric" [style.bottom.%]="item.count / maximum * 100">{{ item.count }}</span>
              <div class="bar" [class.last]="i === data.length - 1" [style.height.%]="item.count / maximum * 100"></div>
            </div>
            <span class="date" [class.odd]="i % 2 === 1 && i !== data.length - 1">{{ item.date.slice(-2) }}</span>
          </div>
        </div>
      </div>
    </figure>
    <details><summary class="ui-link">Xem bảng số liệu phân công</summary>
      <table class="ui-data-table"><caption class="ui-sr-only">{{ label }}</caption><thead><tr><th scope="col">Ngày</th><th scope="col">Lượt phân công</th></tr></thead>
        <tbody><tr *ngFor="let item of data"><td>{{ dateLabel(item.date) }}</td><td class="ui-numeric">{{ item.count }}</td></tr></tbody>
      </table>
    </details>`,
  styles: [`
    :host{display:block;min-width:0}.bar-chart{margin:12px 0 6px}.plot{position:relative;height:var(--ui-chart-plot-height,210px);padding:22px 0 0 32px}
    .grid{position:absolute;inset:22px 0 28px 32px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none}.grid>div{border-top:1px dashed var(--ui-border);position:relative}.grid span{position:absolute;right:calc(100% + 9px);top:-9px;font-size:12px;color:var(--ui-text-muted)}
    .bars{display:grid;gap:10px;position:relative;height:100%}.cell{min-width:0;text-align:center;display:flex;flex-direction:column}.bar-zone{position:relative;display:flex;align-items:flex-end;justify-content:center;flex:1;min-height:0}.bar{width:65%;background:#7da88f;border-radius:4px 4px 0 0}.bar.last{background:var(--ui-primary)}.value{position:absolute;margin-bottom:5px;color:var(--ui-text-muted);font-size:12px}.date{height:28px;padding-top:8px;font-size:12px;color:var(--ui-text-muted)}summary{cursor:pointer;min-height:36px;line-height:36px;font-size:13px}
    @media(max-width:600px){.bars{gap:4px}.value{display:none}.date.odd{visibility:hidden}.bar{width:80%}}`],
})
export class DailyBarChartComponent {
  @Input() data: { date: string; count: number }[] = [];
  @Input() label = 'Lượt phân công theo ngày';
  get maximum(): number { return Math.max(4, Math.ceil(Math.max(0, ...this.data.map(x => x.count)) / 4) * 4); }
  get ticks(): number[] { return [this.maximum, this.maximum * .75, this.maximum * .5, this.maximum * .25, 0]; }
  dateLabel(date: string): string { return date.split('-').reverse().join('/'); }
}
