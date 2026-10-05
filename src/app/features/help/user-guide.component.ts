import {
  Component,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface GuideSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  group?: string;
  objective?: string;
  steps?: string[];
  notes?: string[];
}

@Component({
  standalone: true,
  selector: 'app-user-guide',
  imports: [CommonModule],
  templateUrl: './user-guide.component.html',
  styleUrls: ['./user-guide.component.scss'],
})
export class UserGuideComponent implements AfterViewInit, OnDestroy {
  @ViewChild('content', { static: true }) contentRef!: ElementRef<HTMLElement>;
  private router = inject(Router);

  sections: GuideSection[] = [
    {
      id: 'intro',
      title: 'Giới thiệu nhanh',
      icon: 'pi pi-info-circle',
      group: 'BẮT ĐẦU',
      content: `Duty Roster hỗ trợ lập lịch trực, giám sát và quản lý ca trực. Trang này cung cấp hướng dẫn thao tác cơ bản.`,
      objective: 'Hiểu chức năng chính và luồng sử dụng hệ thống.',
    },
    {
      id: 'login',
      title: 'Đăng nhập & Phiên',
      icon: 'pi pi-sign-in',
      group: 'BẮT ĐẦU',
      content: `Hệ thống dùng Keycloak SSO. Sau đăng nhập, token được lưu tạm thời và tự refresh nền.`,
      steps: [
        'Truy cập hệ thống, bạn sẽ được chuyển hướng đến trang Keycloak.',
        'Nhập tài khoản và mật khẩu.',
        'Token tự động refresh, phiên sẽ tồn tại trong khoảng thời gian cấu hình.',
      ],
    },
    {
      id: 'my-roster',
      title: 'Lịch trực của tôi',
      icon: 'pi pi-calendar',
      group: 'CHỨC NĂNG',
      content: `Xem danh sách ca trực đã phân công, lọc theo ngày, chi tiết ca, yêu cầu đổi ca nếu có quyền.`,
      steps: [
        'Truy cập mục "Lịch trực của tôi".',
        'Lọc theo tháng/tuần, chọn ca để xem chi tiết.',
        'Nếu có quyền, bạn có thể yêu cầu đổi ca hoặc xác nhận tham gia.',
      ],
      notes: ['Chỉ được thay đổi ca nếu bạn có quyền và ca chưa bị khóa.'],
    },
    {
      id: 'notifications',
      title: 'Thông báo hệ thống',
      icon: 'pi pi-bell',
      group: 'CHỨC NĂNG',
      content: `Thông báo hiển thị sự kiện quan trọng: phân công mới, thay đổi ca, phê duyệt.`,
      steps: [
        'Click vào icon chuông ở góc phải.',
        'Xem danh sách thông báo chưa đọc.',
        'Click vào thông báo để xem chi tiết.',
      ],
    },
    {
      id: 'roles',
      title: 'Vai trò & Quyền',
      icon: 'pi pi-users',
      group: 'QUẢN TRỊ',
      content: `Hệ thống phân quyền theo vai trò (Admin/Manager/Editor/Viewer) gắn phạm vi đơn vị.`,
      notes: [
        'Quyền hiển thị tính theo vai trò và phạm vi đơn vị bạn được gán.',
        'Admin có quyền cao nhất, Viewer chỉ xem.',
      ],
    },
  ];

  activeId = signal<string>(this.sections[0]?.id);
  sidebarOpen = signal<boolean>(true);
  copying = signal<string>('');
  searchTerm = signal<string>('');
  isNarrow = false;
  get filteredSections() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.sections;
    return this.sections.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        s.content.toLowerCase().includes(term)
    );
  }

  get groupedSections() {
    const groups = new Map<string, GuideSection[]>();
    this.filteredSections.forEach((s) => {
      const g = s.group || 'Khác';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(s);
    });
    return Array.from(groups.entries());
  }
  private resizeHandler = () => {
    this.isNarrow = window.innerWidth < 992; // responsive breakpoint
    if (!this.isNarrow) {
      // ensure sidebar shows on wide screens
      this.sidebarOpen.set(true);
    }
  };

  ngAfterViewInit(): void {
    this.setupScrollSpy();
    this.resizeHandler();
    window.addEventListener('resize', this.resizeHandler);
  }
  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
  }

  scrollTo(id: string) {
    const contentEl = this.contentRef.nativeElement;
    const target = contentEl.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    const top = target.offsetTop;
    contentEl.scrollTo({ top: top - 8, behavior: 'smooth' });
    this.activeId.set(id);
    history.replaceState(null, '', '#' + id);
  }

  onContentScroll() {
    const contentEl = this.contentRef.nativeElement;
    const scrollTop = contentEl.scrollTop;
    let current = this.sections[0]?.id;
    for (const s of this.sections) {
      const el = contentEl.querySelector<HTMLElement>(`#${s.id}`);
      if (!el) continue;
      if (el.offsetTop - 16 <= scrollTop) current = s.id;
      else break;
    }
    if (current && current !== this.activeId()) this.activeId.set(current);
  }

  toggleSidebar() {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  copyLink(id: string) {
    const url = location.origin + location.pathname + '#' + id;
    navigator.clipboard.writeText(url).then(() => {
      this.copying.set(id);
      setTimeout(() => this.copying.set(''), 1200);
    });
  }

  private setupScrollSpy() {
    const observer = new IntersectionObserver(
      (entries) => {
        // pick the entry most visible
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          this.activeId.set(visible.target.id);
        }
      },
      { root: null, rootMargin: '0px', threshold: [0.15, 0.3, 0.5, 0.75] }
    );

    // Defer to ensure DOM painted
    setTimeout(() => {
      this.sections.forEach((s) => {
        const el = document.getElementById(s.id);
        if (el) observer.observe(el);
      });
    }, 50);
  }
}
