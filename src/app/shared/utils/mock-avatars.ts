/**
 * Mock avatar URLs for demonstration.
 * Can be enabled/disabled via runtime configuration.
 *
 * Usage:
 * ```typescript
 * import { MOCK_AVATARS } from './mock-avatars';
 * const photoUrl = MOCK_AVATARS[staffName];
 * ```
 */
export const MOCK_AVATARS: Record<string, string> = {
  // Leadership
  'Nguyễn Văn An': 'https://i.pravatar.cc/150?img=12',
  'Trần Thị Bình': 'https://i.pravatar.cc/150?img=47',
  'Lê Văn Cường': 'https://i.pravatar.cc/150?img=33',
  'Phạm Thị Dung': 'https://i.pravatar.cc/150?img=45',

  // Staff
  'Hoàng Văn Đức': 'https://i.pravatar.cc/150?img=15',
  'Vũ Thị Hoa': 'https://i.pravatar.cc/150?img=48',
  'Đỗ Văn Khoa': 'https://i.pravatar.cc/150?img=51',
  'Bùi Thị Lan': 'https://i.pravatar.cc/150?img=44',

  // Additional staff
  'Dương Văn Tính': 'https://i.pravatar.cc/150?img=12',
  'Bùi Công Đại': 'https://i.pravatar.cc/150?img=37',
  'Tống Duy Lanh': 'https://i.pravatar.cc/150?img=25',
  'Phan Văn Minh': 'https://i.pravatar.cc/150?img=68',
  'Lý Thị Nga': 'https://i.pravatar.cc/150?img=49',
  'Trịnh Văn Phúc': 'https://i.pravatar.cc/150?img=56',
  'Mai Thị Quỳnh': 'https://i.pravatar.cc/150?img=36',
  'Ngô Văn Sơn': 'https://i.pravatar.cc/150?img=69',
  'Đặng Thị Tâm': 'https://i.pravatar.cc/150?img=29',
  'Võ Văn Tùng': 'https://i.pravatar.cc/150?img=14',
};

/**
 * Get mock avatar URL for staff member.
 * Returns undefined if not found (fallback to initials).
 */
export function getMockAvatar(fullName: string): string | undefined {
  return MOCK_AVATARS[fullName];
}

/**
 * Configuration to enable/disable mock avatars globally.
 * Can be controlled via RuntimeConfigService if needed.
 */
export const MOCK_AVATARS_ENABLED = false; // Set to true to enable mock photos
