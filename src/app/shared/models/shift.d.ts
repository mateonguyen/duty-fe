export interface ShiftReadDto {
  id: number;
  code: string;
  name: string;
  startTime: string; // "HH:mm:ss"
  endTime: string;
  scopeUnitId?: number | null;
  active: boolean;
}

export type ShiftWriteDto = Omit<ShiftReadDto, 'id'>;
