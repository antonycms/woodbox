import type { RendererDialectDml } from './types';

const getInsertColumns = (row: Record<string, unknown>, columnOrder?: string[]) => {
  const rowColumns = Object.keys(row);

  if (!columnOrder?.length) return rowColumns;

  const orderedColumns = columnOrder.filter((column) => rowColumns.includes(column));
  const extraColumns = rowColumns.filter((column) => !orderedColumns.includes(column));

  return [...orderedColumns, ...extraColumns];
};

const getInsertGroupKey = (columns: string[]) => columns.join('\0');

export const defaultDml: RendererDialectDml = {
  getInsertDml(schema, table, rows, columnOrder, helpers) {
    if (!rows.length) return '';

    const tableName = helpers.getTableName(schema, table);
    const groups = new Map<string, { columns: string[]; rows: Record<string, unknown>[] }>();

    rows.forEach((row) => {
      const columns = getInsertColumns(row, columnOrder);
      if (!columns.length) return;

      const key = getInsertGroupKey(columns);
      const group = groups.get(key);

      if (group) {
        group.rows.push(row);
        return;
      }

      groups.set(key, { columns, rows: [row] });
    });

    return [...groups.values()]
      .map(({ columns, rows: groupRows }) => {
        const columnsSql = columns.map(helpers.quoteIdent).join(', ');
        const valuesSql = groupRows
          .map(
            (row) =>
              `  (${columns.map((column) => helpers.serializeValue(row[column])).join(', ')})`,
          )
          .join(',\n');

        return `INSERT INTO ${tableName} (${columnsSql})\nVALUES\n${valuesSql};`;
      })
      .join('\n\n');
  },

  getUpdateDml(schema, table, rows, whereColumns, helpers) {
    const tableName = helpers.getTableName(schema, table);

    return rows
      .map(({ originalRow, changes }) => {
        const setSql = Object.entries(changes)
          .map(
            ([column, value]) =>
              `  ${helpers.quoteIdent(column)} = ${helpers.serializeValue(value)}`,
          )
          .join(',\n');

        const whereSql = whereColumns
          .map((column) => helpers.serializeWhereValue(column, originalRow[column]))
          .join('\n  AND ');

        if (!setSql || !whereSql) return null;

        return `UPDATE ${tableName}\nSET\n${setSql}\nWHERE ${whereSql};`;
      })
      .filter((sql): sql is string => !!sql)
      .join('\n\n')
      .trim();
  },

  getDeleteDml(schema, table, rows, whereColumns, helpers) {
    const tableName = helpers.getTableName(schema, table);

    return rows
      .map((row) => {
        const whereSql = whereColumns
          .map((column) => helpers.serializeWhereValue(column, row[column]))
          .join('\n  AND ');

        if (!whereSql) return null;

        return `DELETE FROM ${tableName}\nWHERE ${whereSql};`;
      })
      .filter((sql): sql is string => !!sql)
      .join('\n\n');
  },
};
