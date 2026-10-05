export interface OrgUnitNodeDto {
  id: number; // lưu ý: có thể là externalId nếu backend bạn đang đọc DHVB
  code: string;
  name: string;
  children: OrgUnitNodeDto[];
}

export interface SimpleUserWithOrgDto {
  id: number;
  username: string;
  displayName: string;
  rankName?: string | null;
  displayNameWithRank?: string | null;
  isLeader?: boolean;
  positionLevel?: number | null;
  positionName?: string;
  orgUnitId?: number | null;
  orgUnitCode?: string | null;
  orgUnitName?: string | null;
  phone?: string | null;
}

export interface OrgUnitNodeWithStaffDto extends OrgUnitNodeDto {
  shortName?: string | null;
  children: OrgUnitNodeWithStaffDto[];
  staff?: SimpleUserWithOrgDto[];
}
