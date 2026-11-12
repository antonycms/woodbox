import type { PrepareInsertDmlRequest } from '@shared/types/database';
import { getDialectAdapter } from './dialects';

const quoteLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;

const serializeValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return quoteLiteral(value.toISOString());
  if (typeof value === 'object') return quoteLiteral(JSON.stringify(value));
  return quoteLiteral(String(value));
};

// Text for copy only: no connection, metadata lookup or SQL execution.
export const prepareInsertDml = ({
  policyId, target: { schema, table }, rows, columnOrder,
}: PrepareInsertDmlRequest): string => {
  if (!rows.length) return '';

  const quote = getDialectAdapter(policyId).quoteIdentifier;
  const tableName = schema ? `${quote(schema)}.${quote(table)}` : quote(table);
  const order = columnOrder || [];
  const orderedNames = new Set(order);
  const groups = new Map<string, { columns: string[]; rows: PrepareInsertDmlRequest['rows'] }>();

  for (const row of rows) {
    const keys = Object.keys(row);
    let columns = keys;
    if (order.length) {
      const present = new Set(keys);
      columns = [...order.filter((name) => present.has(name)), ...keys.filter((name) => !orderedNames.has(name))];
    }
    if (!columns.length) continue;

    const key = columns.join('\0');
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { columns, rows: [row] });
  }

  return [...groups.values()].map(({ columns, rows: groupRows }) => {
    const columnsSql = columns.map(quote).join(', ');
    const valuesSql = groupRows.map((row) =>
      `  (${columns.map((column) => serializeValue(row[column])).join(', ')})`,
    ).join(',\n');
    return `INSERT INTO ${tableName} (${columnsSql})\nVALUES\n${valuesSql};`;
  }).join('\n\n');
};
