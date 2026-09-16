import type { IColumnInfo } from '@renderer/contexts/Store';

export const parseColumnTypeInput = (value: unknown): Partial<IColumnInfo> => ({
  data_type: String(value ?? '').trim(),
  character_maximum_length: undefined,
  numeric_precision: undefined,
  numeric_scale: undefined,
  datetime_precision: undefined,
});
