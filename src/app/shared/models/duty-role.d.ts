export type DutyRoleScope = 'GLOBAL' | 'PHONG' | 'CUC';

export interface DutyRoleReadDto {
  id: number;
  code: string;
  name: string;
  forLeaderOnly: boolean;
  scope: DutyRoleScope;
  active: boolean;
}

export type DutyRoleWriteDto = Omit<DutyRoleReadDto, 'id'>;
