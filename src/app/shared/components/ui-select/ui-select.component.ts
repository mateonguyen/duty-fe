import { Component, Input, forwardRef } from '@angular/core';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectModule } from 'primeng/select';

export interface UiSelectOption { value: string | number | null; label: string; detail?: string; disabled?: boolean; }

/** Shared select: overlay, searchable options, keyboard navigation and Angular form validation. */
@Component({
  selector: 'app-ui-select', standalone: true, imports: [FormsModule, SelectModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelectComponent), multi: true }],
  template: `
    <p-select [options]="choices" optionLabel="label" optionValue="value" optionDisabled="disabled"
      [ngModel]="value" [ngModelOptions]="{standalone: true}" (ngModelChange)="choose($event)"
      [disabled]="disabled || formDisabled" [inputId]="inputId" [ariaLabel]="label"
      [placeholder]="placeholder" [filter]="searchable" filterBy="label,detail" filterLocale="vi"
      [filterPlaceholder]="'Tìm ' + label.toLocaleLowerCase('vi-VN')" [ariaFilterLabel]="'Tìm ' + label.toLocaleLowerCase('vi-VN')"
      emptyMessage="Chưa có lựa chọn" emptyFilterMessage="Không tìm thấy kết quả"
      [resetFilterOnHide]="true" [checkmark]="true" [autofocusFilter]="false"
      appendTo="body" [baseZIndex]="4000" panelStyleClass="ui-select-panel" scrollHeight="280px" (onBlur)="touch()">
      <ng-template #item let-option>
        <span class="ui-select-option"><span>{{ option.label }}</span>@if (option.detail) { <small>{{ option.detail }}</small> }</span>
      </ng-template>
    </p-select>`,
  styles: [`:host{display:block;min-width:0;width:100%}`],
})
export class UiSelectComponent implements ControlValueAccessor {
  choices: UiSelectOption[] = [];
  @Input() set options(options: UiSelectOption[]) {
    // Keep the PrimeNG signal input stable when a page derives equivalent options in a getter.
    if (options.length === this.choices.length && options.every((x, i) => {
      const previous = this.choices[i]; return x.value === previous.value && x.label === previous.label && x.detail === previous.detail && x.disabled === previous.disabled;
    })) return;
    this.choices = options;
  }
  @Input() label = 'Lựa chọn';
  @Input() inputId = '';
  @Input() placeholder = 'Chọn một giá trị';
  @Input() searchable = true;
  @Input() disabled = false;
  value: string | number | null = null;
  formDisabled = false;
  private change: (value: any) => void = () => {};
  touch: () => void = () => {};
  writeValue(value: string | number | null): void { this.value = value; }
  registerOnChange(fn: (value: any) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touch = fn; }
  setDisabledState(disabled: boolean): void { this.formDisabled = disabled; }
  choose(value: string | number | null): void { this.value = value; this.change(value); this.touch(); }
}
