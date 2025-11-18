export interface DutyLocationReadDto {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  scopeCode?: string | null;
  displayOrder: number;
  active: boolean;
}

export interface DutyLocationWriteDto {
  code: string;
  name: string;
  address?: string | null;
  scopeCode?: string | null;
  displayOrder?: number | null;
  active: boolean;
}
