export interface UserRoleInfo {
  roleId: number;
  roleCode: string;
  roleName: string;
  scopeUnitCode?: string | null;
  scopeUnitName?: string | null;
  includeChildren: boolean;
}

export interface AccountProfile {
  username: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  orgUnitCode?: string | null;
  orgUnitName?: string | null;
  positionTitle?: string | null;
  isLeader?: boolean | null;
  roles: UserRoleInfo[];
  permissions: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
