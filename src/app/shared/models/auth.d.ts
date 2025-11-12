export interface PermissionDto {
  code: string;
  name: string;
  resource?: string;
  action?: string;
  description?: string;
}

export interface RoleDto {
  code: string;
  name: string;
  isSystemRole?: boolean;
  active?: boolean;
  description?: string;
}

export interface RoleDetailDto extends RoleDto {
  permissions: PermissionDto[];
}

export interface UserRoleDto {
  id: number;
  roleCode: string;
  roleName: string;
  scopeUnitCode?: string | null;
  includeChildren: boolean;
  grantedByUsername?: string | null;
  grantedAt: string;
}

export interface UserSearchDto {
  username: string;
  displayName?: string | null;
  orgUnitCode?: string | null;
  orgUnitName?: string | null;
  positionCode?: string | null;
  positionName?: string | null;
  positionLevel?: number | null;
  isLeader?: boolean | null;
  orgUnitId?: number | null;
}
