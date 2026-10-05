import { PermissionDto } from '../../../shared/models/auth';

export const PERMISSION_GROUP_NAMES: Record<string, string> = {
  assignment: 'Phân công trực',
  catalog: 'Danh mục lịch trực',
  role: 'Phân quyền',
  roster: 'Lịch trực',
  system: 'Hệ thống',
  travel: 'Giấy tờ công tác',
  user: 'Người dùng',
};

export const PERMISSION_NAMES: Record<string, string> = {
  'assignment.view': 'Xem phân công',
  'assignment.create': 'Lập và cập nhật phân công',
  'assignment.edit': 'Sửa phân công',
  'assignment.delete': 'Xóa phân công',
  'catalog.view': 'Xem danh mục',
  'catalog.create': 'Tạo danh mục',
  'catalog.edit': 'Sửa danh mục',
  'catalog.delete': 'Xóa danh mục',
  'role.assign': 'Gán và thu hồi vai trò',
  'roster.view': 'Xem lịch trực',
  'roster.create': 'Tạo lịch trực',
  'roster.edit': 'Sửa lịch trực',
  'roster.delete': 'Xóa lịch trực',
  'roster.approve': 'Phê duyệt lịch trực',
  'roster.publish': 'Công bố lịch trực',
  'system.config': 'Cấu hình hệ thống',
  'user.manage': 'Quản lý vai trò và người dùng',
  'travel.trip.view': 'Xem đợt công tác',
  'travel.trip.create': 'Tạo đợt công tác',
  'travel.trip.update': 'Sửa đợt công tác',
  'travel.trip.delete': 'Xóa đợt công tác',
  'travel.trip.publish': 'Lấy số đợt công tác',
  'travel.order.view': 'Xem giấy đi đường và giấy giới thiệu trong đơn vị',
  'travel.order.update': 'Sửa giấy tờ công tác trong đơn vị',
  'travel.order.delete': 'Xóa giấy tờ công tác trong đơn vị',
  'travel.order.print': 'In giấy tờ công tác',
  'travel.personnel.view': 'Xem cán bộ khi lập giấy tờ công tác',
};

// These legacy codes are stored in roles but no operation currently checks them.
// Keep them visible for audit, and do not offer a switch that has no effect.
export const UNIMPLEMENTED_PERMISSIONS = new Set([
  'assignment.edit', 'assignment.delete', 'roster.approve',
  'travel.trip.view', 'travel.order.print', 'travel.personnel.view',
]);

// Quyền thao tác cần quyền xem để người dùng mở được màn hình tương ứng.
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  'catalog.create': ['catalog.view'],
  'catalog.edit': ['catalog.view'],
  'catalog.delete': ['catalog.view'],
  'roster.edit': ['roster.view'],
  'roster.delete': ['roster.view'],
  'roster.publish': ['roster.view'],
  'assignment.create': ['assignment.view'],
  'travel.order.update': ['travel.order.view'],
  'travel.order.delete': ['travel.order.view'],
};

export function permissionName(permission: PermissionDto): string {
  return PERMISSION_NAMES[permission.code] || permission.name || permission.code;
}

export function permissionGroupName(prefix: string): string {
  return PERMISSION_GROUP_NAMES[prefix] || 'Quyền khác';
}
