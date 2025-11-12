import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { SystemConfigService } from './system-config.service';
import { OrganizationService, OrgSearchResult } from './organization.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  standalone: true,
  selector: 'app-system-config',
  templateUrl: './system-config.component.html',
  styleUrls: ['./system-config.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputSwitchModule,
    DropdownModule,
    ToastModule,
  ],
  providers: [MessageService],
})
export class SystemConfigComponent implements OnInit {
  saving = false;
  configs;
  loading;
  organizations;
  orgLoading;
  private _orgOptions: OrgSearchResult[] = [];
  orgLoadingFlag = false;
  private orgOptionsUpdateTrigger = signal(0);

  get orgOptions(): OrgSearchResult[] {
    // Trigger để đảm bảo change detection
    this.orgOptionsUpdateTrigger();
    return this._orgOptions;
  }

  set orgOptions(value: OrgSearchResult[]) {
    this._orgOptions = value;
    this.orgOptionsUpdateTrigger.set(this.orgOptionsUpdateTrigger() + 1);
  }

  constructor(
    public svc: SystemConfigService,
    private orgSvc: OrganizationService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.configs = this.svc.configs;
    this.loading = this.svc.loading;
    this.organizations = this.orgSvc.organizations;
    this.orgLoading = this.orgSvc.loading;
  }

  ngOnInit(): void {
    console.log('ngOnInit called');
    this.refreshConfigs();
  }

  private refreshConfigs() {
    console.log('refreshConfigs called');
    this.svc.fetchAll().subscribe((cfgs) => {
      console.log('Configs loaded:', cfgs);
      // Sắp xếp lại thứ tự các config theo yêu cầu
      const order = [
        'SystemName',
        'RootOrgCode',
        'MaxDutyDays',
        'EnableNotifications',
      ];
      const sortedCfgs = cfgs.sort((a, b) => {
        const indexA = order.indexOf(a.key);
        const indexB = order.indexOf(b.key);
        // Nếu không có trong order array thì để cuối
        const posA = indexA === -1 ? order.length : indexA;
        const posB = indexB === -1 ? order.length : indexB;
        return posA - posB;
      });
      this.svc.configs.set(sortedCfgs);
      this.svc.loading.set(false);

      // Sau khi load configs, đảm bảo load org options để dropdown hiển thị đúng
      this.loadOrgOptions();
    });
  }

  save() {
    this.saving = true;
    const configs = this.configs();
    let count = 0;
    configs.forEach((cfg) => {
      this.svc.update(cfg).subscribe({
        next: () => {
          count++;
          if (count === configs.length) {
            this.saving = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Lưu cấu hình thành công!',
            });
            // Load lại dữ liệu sau khi lưu thành công
            this.refreshConfigs();
          }
        },
        error: () => {
          this.saving = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Có lỗi khi lưu cấu hình!',
          });
        },
      });
    });
  }

  getBooleanValue(config: any): boolean {
    return config.value === 'true' || config.value === true;
  }

  setBooleanValue(config: any, value: boolean) {
    config.value = value.toString();
  }

  getInputType(key: string) {
    if (
      key.toLowerCase().includes('enable') ||
      key.toLowerCase().includes('public')
    )
      return 'switch';
    if (key.toLowerCase().includes('max') || key.toLowerCase().includes('days'))
      return 'number';
    if (key.toLowerCase().includes('rootorg')) return 'dropdown';
    return 'text';
  }

  onOrgFilter(event: any) {
    const query = event.filter || '';
    this.loadOrgOptions(query);
  }

  onOrgScroll(event: any) {
    // Load more data when scrolling to bottom
    // For now, just load with current filter
  }

  private loadOrgOptions(query = '', page = 1) {
    console.log('loadOrgOptions called with query:', query, 'page:', page);
    this.orgLoadingFlag = true;
    // Tăng limit để đảm bảo có đủ options
    this.orgSvc.searchOrganizations(query, page, 200).subscribe({
      next: (response) => {
        console.log('API response received:', response);
        console.log('Number of options:', response.items?.length || 0);
        // Delay một chút để đảm bảo component đã render xong
        setTimeout(() => {
          this._orgOptions = response.items;

          // Debug: log giá trị hiện tại
          const rootOrgConfig = this.configs().find(
            (c) => c.key === 'RootOrgCode'
          );
          console.log('RootOrgCode config:', rootOrgConfig);
          console.log('RootOrgCode value:', rootOrgConfig?.value);
          console.log(
            'Available options codes:',
            this._orgOptions.map((o) => o.code)
          );
          console.log(
            'Available options:',
            this._orgOptions
              .slice(0, 5)
              .map((o) => ({ code: o.code, name: o.name }))
          );

          // Sắp xếp lại để giá trị RootOrgCode hiện tại lên đầu nếu có
          if (rootOrgConfig?.value) {
            const currentOrgIndex = this._orgOptions.findIndex(
              (opt) => opt.code === rootOrgConfig.value
            );
            console.log('Current org index:', currentOrgIndex);
            if (currentOrgIndex > 0) {
              // Di chuyển item hiện tại lên đầu - tạo array mới để trigger change detection
              const currentOrg = this._orgOptions.splice(currentOrgIndex, 1)[0];
              this._orgOptions = [currentOrg, ...this._orgOptions];
            }
          }

          // Force update binding để dropdown nhận giá trị
          const currentConfig = this.configs().find(
            (c) => c.key === 'RootOrgCode'
          );
          if (currentConfig) {
            // Set lại value để trigger binding
            const tempValue = currentConfig.value;
            currentConfig.value = null;
            this.cdr.detectChanges();
            currentConfig.value = tempValue;
            this.cdr.detectChanges();
          }

          this.orgLoadingFlag = false;
        }, 100);
      },
      error: (err) => {
        console.error('API error in loadOrgOptions:', err);
        this.orgLoadingFlag = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không thể tải danh sách đơn vị',
        });
      },
    });
  }

  getSelectedOrg(value: string | null) {
    if (!value) return null;
    const allOrgs = this.flattenOrganizations(this.organizations());
    return allOrgs.find((org) => org.code === value) || null;
  }

  flattenOrganizations(orgs: any[]): any[] {
    const result: any[] = [];
    const flatten = (nodes: any[]) => {
      nodes.forEach((node) => {
        result.push({ code: node.code, name: `${node.code} - ${node.name}` });
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      });
    };
    flatten(orgs);
    return result;
  }
}
