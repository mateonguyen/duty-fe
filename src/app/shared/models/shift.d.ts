export interface ShiftReadDto {
  id: number;
  code: string;
  name: string;
  startTime: string; // "HH:mm:ss"
  endTime: string;
  displayOrder: number;
  scopeCode?: string | null;
  scopeUnitName?: string | null;
  active: boolean;
}

export type ShiftWriteDto = Omit<ShiftReadDto, 'id'>;
