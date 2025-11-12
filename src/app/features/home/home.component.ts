import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';

interface UpcomingShift {
  date: string; // ISO or display
  time: string;
  location: string;
  role: string;
  status?: 'Scheduled' | 'Pending Swap' | 'Approved Swap';
}

interface QuickStat {
  label: string;
  value: number | string;
  icon: string;
  colorClass: string; // tailwind background color
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    DividerModule,
    AvatarModule,
    BadgeModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  // Fake data for first render; wire to API later
  stats: QuickStat[] = [
    {
      label: 'Kỳ lịch đang mở',
      value: 2,
      icon: 'pi pi-calendar-plus',
      colorClass: 'bg-indigo-600',
    },
    {
      label: 'Ca trực của tôi (tháng này)',
      value: 8,
      icon: 'pi pi-clock',
      colorClass: 'bg-emerald-600',
    },
    {
      label: 'Yêu cầu đổi ca chờ duyệt',
      value: 3,
      icon: 'pi pi-refresh',
      colorClass: 'bg-amber-600',
    },
    {
      label: 'Phân quyền cần xử lý',
      value: 1,
      icon: 'pi pi-key',
      colorClass: 'bg-rose-600',
    },
  ];

  upcoming: UpcomingShift[] = [
    {
      date: '06/11/2025',
      time: '08:00–12:00',
      location: 'Trạm 1',
      role: 'Điều phối',
      status: 'Scheduled',
    },
    {
      date: '08/11/2025',
      time: '12:00–16:00',
      location: 'Trạm 2',
      role: 'Giám sát',
      status: 'Pending Swap',
    },
    {
      date: '12/11/2025',
      time: '08:00–12:00',
      location: 'Trạm 3',
      role: 'Trực tổng đài',
      status: 'Scheduled',
    },
  ];

  announcements = [
    {
      title: 'Bảo trì hệ thống tối 10/11',
      content: 'Hệ thống tạm gián đoạn 22:00–23:00 để nâng cấp cơ sở dữ liệu.',
      time: '1 ngày trước',
    },
    {
      title: 'Ban hành quy chế đổi ca mới',
      content: 'Áp dụng từ 15/11: yêu cầu đổi ca phải trước 24h.',
      time: '3 ngày trước',
    },
  ];

  quickActions = [
    {
      label: 'Lập kỳ lịch',
      icon: 'pi pi-calendar-plus',
      routerLink: '/schedule',
    },
    {
      label: 'Phân quyền',
      icon: 'pi pi-key',
      routerLink: '/admin/access/user-roles',
    },
    {
      label: 'Danh mục',
      icon: 'pi pi-list-check',
      routerLink: '/admin/catalog/duty-locations',
    },
  ];

  // Additional sections (sample data for v1)
  todayCoverage = [
    {
      location: 'Trạm 1',
      role: 'Điều phối',
      assignee: 'Ng. An',
      time: '08:00–12:00',
    },
    {
      location: 'Trạm 2',
      role: 'Giám sát',
      assignee: 'Tr. Bình',
      time: '08:00–16:00',
    },
    {
      location: 'Trạm 3',
      role: 'Tổng đài',
      assignee: 'L. Chi',
      time: '12:00–20:00',
    },
  ];

  activity = [
    {
      when: '5 phút trước',
      title: 'Duyệt đổi ca',
      text: 'Duyệt đổi ca #432 (Tr. Bình ↔ N. Dũng).',
    },
    {
      when: '1 giờ trước',
      title: 'Cập nhật ca trực',
      text: 'Cập nhật ca trực cho kỳ 11/2025.',
    },
    {
      when: 'Hôm qua',
      title: 'Thêm địa điểm',
      text: 'Thêm địa điểm trực "Trạm 4".',
    },
  ];
}
