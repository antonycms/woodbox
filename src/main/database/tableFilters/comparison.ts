import type { CanonicalTableFilterValue, IColumnInfo } from '@shared/types/database';
import type { Dialect } from '@shared/types/connections';
import { quoteDatabaseIdentifier } from '../utils/sql';
import { unavailable } from './values';

export interface FilterColumn extends IColumnInfo { presentationHidden?: boolean }
export interface FilterOperand { literal: string }

export const filterIdentifier = (dialect: Dialect, name: string) => {
  if (name.includes('\0')) return unavailable('invalid-value');
  return quoteDatabaseIdentifier(dialect, name);
};
export const filterTarget = (dialect: Dialect, target: { schema?: string; table: string }) =>
  target.schema ? `${filterIdentifier(dialect, target.schema)}.${filterIdentifier(dialect, target.table)}` : filterIdentifier(dialect, target.table);

const pgText = (value: string) => {
  if (value.includes('\0')) return unavailable('unsupported-value');
  if (!/[\\?]/.test(value)) return "'" + value.replace(/'/g, "''") + "'";
  return "E'" + value.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\?/g, '\\x3f') + "'";
};
const sqlText = (dialect: Dialect, value: string): FilterOperand => {
  if (Buffer.from(value, 'utf8').toString('utf8') !== value) return unavailable('invalid-value');
  if (dialect === 'postgres') return { literal: pgText(value) };
  if (dialect === 'mysql') return { literal: /^[\x20-\x5b\x5d-\x7e]*$/.test(value) ? `'${value.replace(/'/g, "''")}'`
      : `CONVERT(X'${Buffer.from(value, 'utf8').toString('hex')}' USING utf8mb4)` };
  return { literal: value.includes('\0')
    ? `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)` : `'${value.replace(/'/g, "''")}'` };
};

// Normal FK navigation preserves the received value; the database owns coercion.
export const getFilterOperand = (dialect: Dialect, value: CanonicalTableFilterValue): FilterOperand | undefined => {
  switch (value.kind) {
    case 'null': return undefined;
    case 'text':
    case 'instant': return sqlText(dialect, value.value);
    case 'number':
    case 'bigint': return { literal: value.value };
    case 'boolean': return { literal: dialect === 'postgres' ? (value.value ? 'TRUE' : 'FALSE') : (value.value ? '1' : '0') };
    case 'bytes': {
      const hex = Buffer.from(value.value, 'base64').toString('hex');
      return { literal: dialect === 'postgres' ? `decode('${hex}', 'hex')` : `X'${hex}'` };
    }
  }
};
