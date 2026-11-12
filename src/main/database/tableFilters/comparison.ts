import type { CanonicalTableFilterValue, IColumnInfo, TableFilterColumnInfo } from '@shared/types/database';
import type { Dialect } from '@shared/types/connections';
import { quoteDatabaseIdentifier } from '../utils/sql';
import { unavailable } from './values';

export interface FilterColumn extends IColumnInfo { comparison_collation?: string; comparison_type?: string; presentationHidden?: boolean }
export const sqliteFilterAffinity = (type: string) => /int/i.test(type) ? 'integer' : /char|clob|text/i.test(type) ? 'text'
  : !type || /blob/i.test(type) ? 'bytes' : /real|floa|doub/i.test(type) ? 'float'
    : /^(bool|boolean)$/i.test(type) ? 'boolean' : 'decimal';
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
const integerText = (value: CanonicalTableFilterValue) => {
  if (!['text', 'number', 'bigint', 'boolean'].includes(value.kind)) return unavailable('unsupported-value');
  const text = value.kind === 'boolean' ? (value.value ? '1' : '0') : 'value' in value ? value.value : '';
  if (typeof text !== 'string' || !/^[+-]?\d+$/.test(text)) return unavailable('invalid-value');
  return BigInt(text).toString();
};
const decimalText = (value: CanonicalTableFilterValue) => {
  if (value.kind !== 'text' && value.kind !== 'number' && value.kind !== 'bigint') return unavailable('unsupported-value');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.value)) return unavailable('invalid-value');
  return value.value;
};
const mysqlDecimal = (text: string) => {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text)!;
  const exponent = Number(match[4] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 65) return unavailable('insufficient-precision');
  let digits = (match[2] + (match[3] || '')).replace(/^0+/, '') || '0';
  let scale = (match[3] || '').length - exponent;
  if (scale < 0) { digits += '0'.repeat(-scale); scale = 0; }
  const precision = Math.max(digits.length, scale, 1);
  if (precision > 65 || scale > 30) return unavailable('insufficient-precision');
  if (scale) digits = digits.padStart(scale + 1, '0');
  const normalized = (match[1] === '-' ? '-' : '') + (scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits);
  return { normalized, precision, scale };
};
const validDate = (text: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1
    && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};
const validTime = (text: string) => {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?$/.exec(text);
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[3]) < 60;
};

// Compatibility only for old persisted filters carrying a comparison context.
export const compareFilterValue = (dialect: Dialect, column: TableFilterColumnInfo, value: CanonicalTableFilterValue, requireComparisonContext = true) => {
  if (value.kind === 'number' && (!Number.isFinite(Number(value.value))
    || (Number.isInteger(Number(value.value)) && !Number.isSafeInteger(Number(value.value))))) return unavailable('insufficient-precision');
  const type = (column.comparison_type || column.udt_name || column.data_type || '').toLowerCase().trim();
  const base = type.replace(/\(.*/, '').replace(/ unsigned$/, '').trim();
  const sqlite = dialect === 'sqlite' || dialect === 'react-native-sqlite';
  const unsigned = /\bunsigned\b/.test(type);
  let category: string;
  if (value.kind === 'null') category = 'null';
  else if (sqlite) category = sqliteFilterAffinity(type);
  else if ((sqlite && /char|clob|text/.test(type)) || /^(text|varchar|bpchar|char|tinytext|mediumtext|longtext)$/.test(base)) category = 'text';
  else if (/^(bool|boolean)$/.test(base)) category = 'boolean';
  else if ((sqlite && /int/.test(type)) || /^(int2|int4|int8|int|integer|smallint|bigint|tinyint|mediumint)$/.test(base)) category = 'integer';
  else if (/^(numeric|decimal)$/.test(base)) category = 'decimal';
  else if (/^(float4|float8|real|double|double precision|float)$/.test(base)) category = 'float';
  else if (/^(bytea|blob|tinyblob|mediumblob|longblob|binary|varbinary)$/.test(base) || (sqlite && !type)) category = 'bytes';
  else if (dialect === 'postgres' && base === 'uuid') category = 'uuid';
  else if (/^(date|time|timestamp|timestamptz|datetime)$/.test(base)) category = 'temporal';
  else return unavailable('unknown-context');
  if (requireComparisonContext && category === 'text' && sqlite && !column.comparison_collation) return unavailable('unknown-context');
  const bits = sqlite || /int8|bigint/.test(base) ? 64 : /int2|smallint/.test(base) ? 16 : /tinyint/.test(base) ? 8 : /mediumint/.test(base) ? 24 : 32;
  const context = JSON.stringify({ version: 1, dialect, category,
    ...(category === 'text' ? { semantics: !sqlite && base === 'bpchar' ? 'bpchar' : 'text', collation: column.comparison_collation ?? null } : {}),
    ...(category === 'integer' ? { bits, unsigned } : {}),
    ...(category === 'float' || category === 'temporal' || category === 'bytes' ? { type: sqlite ? category : base } : {}),
  });
  if (category === 'null') return { context, operand: undefined };
  let operand: FilterOperand;
  if (category === 'text') {
    if (value.kind !== 'text') return unavailable('unsupported-value');
    operand = sqlText(dialect, value.value);
    // Keep text comparison for PostgreSQL's internal one-byte "char", not SQL CHAR(n).
    if (dialect === 'postgres' && base === 'char') operand.literal += '::text';
    if (dialect === 'postgres' && base === 'bpchar') operand = { literal: pgText(value.value) };
  } else if (category === 'uuid') {
    if (value.kind !== 'text' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.value)) return unavailable('invalid-value');
    operand = { literal: pgText(value.value) };
  } else if (category === 'bytes') {
    if (dialect === 'react-native-sqlite') return unavailable('unsupported-value');
    if (value.kind !== 'bytes') return unavailable('unsupported-value');
    const bytes = Buffer.from(value.value, 'base64');
    operand = { literal: dialect === 'postgres' ? `decode('${bytes.toString('hex')}', 'hex')` : `X'${bytes.toString('hex')}'` };
  } else if (category === 'boolean') {
    const bool = value.kind === 'boolean' ? value.value : value.kind === 'number' && ['0', '1'].includes(value.value) ? value.value === '1' : unavailable('unsupported-value');
    operand = { literal: dialect === 'postgres' ? (bool ? 'TRUE' : 'FALSE') : (bool ? '1' : '0') };
  } else if (category === 'integer') {
    const text = integerText(value), n = BigInt(text);
    const max = unsigned ? (1n << BigInt(bits)) - 1n : (1n << BigInt(bits - 1)) - 1n;
    const min = unsigned ? 0n : -(1n << BigInt(bits - 1));
    if (n < min || n > max) return unavailable('insufficient-precision');
    operand = { literal: text };
  } else if (category === 'decimal') {
    const text = decimalText(value);
    if (sqlite) return unavailable('unknown-context');
    if (dialect === 'postgres') operand = { literal: text };
    else {
      const exact = mysqlDecimal(text);
      operand = { literal: exact.normalized };
    }
  } else if (category === 'float') {
    if (value.kind !== 'number') return unavailable('unsupported-value');
    if (dialect === 'mysql' && /^float$/.test(base)) return unavailable('unknown-context');
    operand = dialect === 'postgres' ? { literal: `'${value.value}'` }
      : dialect === 'mysql' ? { literal: /[eE]/.test(value.value) ? value.value : `${value.value}e0` }
        : { literal: /[.eE]/.test(value.value) ? value.value : `${value.value}.0` };
  } else {
    if (sqlite || (dialect === 'mysql' && base === 'timestamp')) return unavailable('unknown-context');
    const text = value.kind === 'text' || value.kind === 'instant' ? value.value : unavailable('unsupported-value');
    if (base === 'date') { if (value.kind !== 'text' || !validDate(text)) return unavailable('invalid-value'); }
    else if (base === 'time') { if (value.kind !== 'text' || !validTime(text)) return unavailable('invalid-value'); }
    else if (base === 'timestamptz') {
      if (value.kind === 'text') {
        const instant = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(text);
        if (!instant || !validDate(instant[1]) || !validTime(instant[2])) return unavailable('invalid-value');
        if (instant[3] !== 'Z') {
          const zone = instant[3].slice(1).replace(':', '');
          if (Number(zone.slice(0, 2)) > 15 || Number(zone.slice(2) || 0) > 59) return unavailable('invalid-value');
        }
      }

    } else {
      const parts = text.split(/[ T]/);
      if (value.kind !== 'text' || parts.length !== 2 || !validDate(parts[0]) || !validTime(parts[1])) return unavailable('invalid-value');

    }
    operand = { literal: dialect === 'postgres' ? pgText(text) : base === 'time' ? `TIME '${text}'` : `'${text}'` };
  }
  return { context, operand };
};
