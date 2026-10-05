import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthApiService } from '../../../core/api/auth-api.service';
import { UserSearchDto } from '../../../shared/models/auth';
import { SimpleUser } from '../schedule.d';

export interface StaffByDepartment {
  orgUnitName: string;
  staff: SimpleUser[];
}

@Injectable({ providedIn: 'root' })
export class StaffDataService {
  private authApi = inject(AuthApiService);

  /**
   * Lấy staff theo loại lịch (Cục hoặc Phòng)
   * ROSTER LOGIC:
   * - Bao gồm tất cả cán bộ trong đơn vị (không chỉ lãnh đạo)
   * - Filter theo orgUnitCode
   * - Nếu includeChildren=true: lấy cả staff của các đơn vị con
   * - Sắp xếp: lãnh đạo lên trước, sau đó theo chức vụ và tên
   */
  getStaffForRoster(
    orgUnitCode?: string,
    includeChildren: boolean = false
  ): Observable<SimpleUser[]> {
    return this.authApi.getStaff().pipe(
      map((users) => {
        let filtered = users;

        // Filter by org unit scope
        if (orgUnitCode) {
          if (includeChildren) {
            // Include staff from scope AND all children (starts with scope ID)
            filtered = users.filter(
              (u) =>
                u.orgUnitCode === orgUnitCode ||
                (u.orgUnitCode?.startsWith(orgUnitCode + '.') ?? false)
            );
          } else {
            // Exact match only
            filtered = users.filter((u) => u.orgUnitCode === orgUnitCode);
          }
        }

        const simpleUsers = this.convertToSimpleUsers(filtered);

        // Sort: leaders first (by positionLevel asc), then by displayName
        return simpleUsers.sort((a, b) => {
          // Leaders (isLeader=true) come first
          if (a.isLeader && !b.isLeader) return -1;
          if (!a.isLeader && b.isLeader) return 1;

          // Within leaders or non-leaders, sort by positionLevel (lower = higher rank)
          const levelA = a.positionLevel ?? 999;
          const levelB = b.positionLevel ?? 999;
          if (levelA !== levelB) return levelA - levelB;

          // Finally by displayName
          return (a.displayName || '').localeCompare(b.displayName || '');
        });
      })
    );
  }

  /**
   * Lấy tất cả staff từ EOffice API, chuyển đổi sang SimpleUser
   * và nhóm theo phòng ban với lãnh đạo lên trên
   */
  getAllStaff(): Observable<SimpleUser[]> {
    // Gọi getStaff với keyword rỗng để lấy tất cả
    return this.authApi
      .getStaff()
      .pipe(map((users) => this.convertToSimpleUsers(users)));
  }

  /**
   * Lấy staff được nhóm theo department (orgUnitName)
   * Mỗi department có leaders sorted lên trên
   */
  getStaffByDepartment(orgUnitCode?: string): Observable<StaffByDepartment[]> {
    return this.authApi.getStaff().pipe(
      map((users) => {
        let filtered = users;
        if (orgUnitCode) {
          filtered = users.filter((u) => u.orgUnitCode === orgUnitCode);
        }
        const simpleUsers = this.convertToSimpleUsersWithDept(filtered);
        return this.groupByDepartment(simpleUsers);
      })
    );
  }

  /**
   * Chuyển đổi UserSearchDto[] → SimpleUser[]
   * - username → id (hash string to number for now)
   * - positionLevel ≤ 3 → isLeader (Trưởng phòng, Phó phòng, etc.)
   */
  private convertToSimpleUsers(users: UserSearchDto[]): SimpleUser[] {
    return users.map((u) => ({
      id: this.hashUsername(u.username),
      username: u.username, // Keep original username for backend API
      displayName: u.displayName || u.username,
      // Use server-provided isLeader when available
      isLeader: !!(u as any).isLeader,
      positionLevel: u.positionLevel ?? undefined,
      positionName: u.positionName || undefined,
      phone: u.phone || undefined, // Phone from eOffice, can be null/undefined
      orgUnitCode: u.orgUnitCode || undefined, // Keep orgUnitCode for backend
      orgUnitName: u.orgUnitName || 'Khác',
      orgUnitId: u.orgUnitId ?? undefined,
    }));
  }

  /**
   * Chuyển đổi với orgUnitName bắt buộc (for grouping)
   */
  private convertToSimpleUsersWithDept(
    users: UserSearchDto[]
  ): (SimpleUser & { orgUnitName: string })[] {
    return users.map((u) => ({
      id: this.hashUsername(u.username),
      username: u.username, // Keep original username for backend API
      displayName: u.displayName || u.username,
      isLeader: !!(u as any).isLeader,
      positionLevel: u.positionLevel ?? undefined,
      positionName: u.positionName || undefined,
      phone: undefined,
      orgUnitCode: u.orgUnitCode || undefined, // Keep orgUnitCode for backend
      orgUnitName: u.orgUnitName || 'Khác', // Required string
      orgUnitId: u.orgUnitId ?? undefined,
    }));
  }

  /**
   * Nhóm staff theo orgUnitName, sort leaders lên trên mỗi phòng
   */
  private groupByDepartment(
    users: (SimpleUser & { orgUnitName: string })[]
  ): StaffByDepartment[] {
    const grouped = new Map<string, SimpleUser[]>();

    users.forEach((u) => {
      const dept = u.orgUnitName;
      if (!grouped.has(dept)) {
        grouped.set(dept, []);
      }
      grouped.get(dept)!.push(u);
    });

    const result: StaffByDepartment[] = [];
    grouped.forEach((staff, orgUnitName) => {
      // Sort: leaders first, then by displayName
      staff.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });

      result.push({ orgUnitName, staff });
    });

    // Sort departments by name
    result.sort((a, b) => a.orgUnitName.localeCompare(b.orgUnitName));

    return result;
  }

  /**
   * Simple hash function to convert username string to number id
   * (Tạm thời dùng hash, sau này có thể dùng numeric id từ DB)
   */
  private hashUsername(username: string): number {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      const char = username.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
