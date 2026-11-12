import type { InitialWhere, InitialWhereValue, TableFilterUnavailableReason } from '@shared/types/database';
import { getErrorMessage } from '@shared/utils/error';
import type { II18nStore } from '@renderer/stores/I18n/types';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const isInitialWhereValue = (value: unknown): value is InitialWhereValue => record(value)
  && typeof value.column === 'string' && !!value.column && Object.hasOwn(value, 'value');
const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));
const invalidWhere = (): InitialWhereValue => ({ column: '', value: undefined });

// Session transport only: no SQL, dialect selection or comparison policy here.
const encodeValue = (value: unknown): Record<string, unknown> => {
  if (value === null) return { kind: 'null' };
  if (typeof value === 'string') return { kind: 'text', value };
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'number') return { kind: 'number', value: Object.is(value, -0) ? '-0' : String(value) };
  if (typeof value === 'bigint') return { kind: 'bigint', value: String(value) };
  if (value instanceof Date) return { kind: 'instant', value: Number.isFinite(+value) ? value.toISOString() : '' };
  const bytes = value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : undefined;
  if (bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { kind: 'bytes', encoding: 'base64', value: btoa(binary) };
  }
  return { kind: 'invalid' };
};
const decodeValue = (value: unknown): unknown => {
  if (!record(value) || !hasOnlyKeys(value, value.kind === 'bytes' ? ['kind', 'encoding', 'value']
    : value.kind === 'null' || value.kind === 'invalid' ? ['kind'] : ['kind', 'value'])) throw Error('invalid value');
  if (value.kind === 'null') return null;
  if (value.kind === 'invalid') return undefined;
  if (value.kind === 'boolean' && typeof value.value === 'boolean') return value.value;
  if (typeof value.value !== 'string') throw Error('invalid value');
  if (value.kind === 'text') return value.value;
  if (value.kind === 'number' && (value.value === '-0' || String(Number(value.value)) === value.value)) return Number(value.value);
  if (value.kind === 'bigint' && /^-?(0|[1-9]\d*)$/.test(value.value) && value.value !== '-0') return BigInt(value.value);
  if (value.kind === 'instant' && Number.isFinite(+new Date(value.value)) && new Date(value.value).toISOString() === value.value) return new Date(value.value);
  if (value.kind === 'bytes' && value.encoding === 'base64') {
    const binary = atob(value.value);
    if (btoa(binary) !== value.value) throw Error('invalid bytes');
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  throw Error('invalid value');
};
export const serializeInitialWhere = (where: InitialWhere | undefined): InitialWhere | undefined => {
  if (where === undefined || typeof where === 'string') return where;
  const stored = { ...where, value: encodeValue(where.value), valueEncoding: 'woodbox-v1' };
  return stored;
};
export const restoreInitialWhere = (data: unknown): InitialWhere | undefined => {
  if (!record(data)) return undefined;
  try {
    if (Object.hasOwn(data, 'initialFilter')) return undefined;
    if (record(data.initialWhere) && 'legacyContext' in data.initialWhere) return undefined;
    if (data.initialWhere === undefined) return undefined;
    if (typeof data.initialWhere === 'string') return data.initialWhere;
    if (!isInitialWhereValue(data.initialWhere)) return invalidWhere();
    const where = data.initialWhere;
    if ('valueEncoding' in where) {
      if (where.valueEncoding !== 'woodbox-v1') return invalidWhere();
      return { column: where.column, value: decodeValue(where.value) };
    }
    return where;
  } catch { return invalidWhere(); }
};

export const filterPreparationError = (reason: TableFilterUnavailableReason) =>
  Object.assign(new Error('Table filter unavailable'), { code: `TABLE_FILTER_${reason.replace(/-/g, '_').toUpperCase()}` });
const errorKeys = {
  TABLE_FILTER_INVALID_VALUE: 'filter.invalidValue', TABLE_FILTER_INSUFFICIENT_PRECISION: 'filter.insufficientPrecision',
  TABLE_FILTER_UNSUPPORTED_VALUE: 'filter.unsupportedValue', TABLE_FILTER_INVALID_FILTER: 'filter.invalidFilter',
} as const;
export const getTableFilterErrorMessage = (error: unknown, t: II18nStore['t']) => {
  if (record(error) && typeof error.code === 'string' && Object.hasOwn(errorKeys, error.code)) {
    const key = errorKeys[error.code as keyof typeof errorKeys];
    return t(key);
  }
  return getErrorMessage(error, t('common.unknownError'));
};
