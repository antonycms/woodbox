import type { IColumn } from './dtos';

export const serializeTableValue = (
  value: any,
  type?: IColumn['type'],
  options?: { nullAsEmpty?: boolean },
): string => {
  if (value === undefined || (options?.nullAsEmpty && value === null)) return '';
  if (Array.isArray(value) && type === 'autocomplete-multi') return value.join(', ');
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const serializeTableCopyValue = (value: any): string => {
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
