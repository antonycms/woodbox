import type { CanonicalTableFilterValue, TableFilterUnavailableReason } from '@shared/types/database';

export class TableFilterError extends Error {
  readonly code: string;
  readonly reason: TableFilterUnavailableReason;
  constructor(reason: TableFilterUnavailableReason) {
    super('Não foi possível preparar ou executar o filtro informado.');
    this.reason = reason;
    this.code = `TABLE_FILTER_${reason.replace(/-/g, '_').toUpperCase()}`;
  }
}
export const unavailable = (reason: TableFilterUnavailableReason): never => { throw new TableFilterError(reason); };
export const captureFilterValue = (value: unknown): CanonicalTableFilterValue => {
  if (value === null) return { kind: 'null' };
  if (typeof value === 'string') {
    if (Buffer.from(value, 'utf8').toString('utf8') !== value) return unavailable('invalid-value');
    return { kind: 'text', value };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return unavailable('invalid-value');
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) return unavailable('insufficient-precision');
    return { kind: 'number', value: Object.is(value, -0) ? '-0' : String(value) };
  }
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'bigint') return { kind: 'bigint', value: value.toString() };
  if (value instanceof Date) {
    if (!Number.isFinite(+value)) return unavailable('invalid-value');
    return { kind: 'instant', value: value.toISOString() };
  }
  if (value instanceof Uint8Array) return { kind: 'bytes', encoding: 'base64',
    value: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
  if (value instanceof ArrayBuffer) return { kind: 'bytes', encoding: 'base64', value: Buffer.from(value).toString('base64') };
  return unavailable(value === undefined ? 'invalid-value' : 'unsupported-value');
};
