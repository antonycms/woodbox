import type {
  IGetTableDataParams,
  IOrderBy,
  ITableWithSchema,
} from '@main/database/dialects/types';

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
const quoteLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;
const sqlQuoteIdent = (sqlExpression: string) =>
  `'"' || replace(${sqlExpression}, '"', '""') || '"'`;
const getTableName = ({ table }: ITableWithSchema) => quoteIdent(table);

const getTables = () => /* sql */ `
  SELECT
    m.name AS table_name,
    NULL AS table_schema,
    COALESCE(SUM(s.pgsize), 0) AS total_size
  FROM sqlite_schema m
  LEFT JOIN dbstat s ON s.name = m.name
  WHERE m.type = 'table'
  AND m.name NOT LIKE 'sqlite_%'
  GROUP BY m.name
  ORDER BY m.name;
`;

const getTableColumns = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    name AS column_name,
    lower(type) AS data_type,
    lower(type) AS udt_name,
    NULL AS character_maximum_length,
    NULL AS numeric_precision,
    NULL AS numeric_scale,
    NULL AS datetime_precision,
    dflt_value AS column_default,
    NULL AS extra,
    CASE WHEN pk > 0 AND lower(type) = 'integer' THEN true ELSE false END AS is_auto_increment,
    NULL AS description,
    CASE WHEN "notnull" = 0 AND pk = 0 THEN true ELSE false END AS is_nullable
  FROM pragma_table_info(${quoteLiteral(table)})
  ORDER BY cid;
`;

const getColumnTypes = () => /* sql */ `
  SELECT 'text' AS name UNION SELECT 'integer' UNION SELECT 'real'
  UNION SELECT 'numeric' UNION SELECT 'blob';
`;

const getTableReferences = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    'fk_' || id AS constraint_name,
    NULL AS table_schema,
    ${quoteLiteral(table)} AS table_name,
    "from" AS column_name,
    NULL AS reference_table_schema,
    "table" AS reference_table_name,
    "to" AS reference_column_name,
    'FOREIGN KEY (' || ${sqlQuoteIdent('"from"')} || ') REFERENCES ' || ${sqlQuoteIdent(
      '"table"',
    )} || ' (' || ${sqlQuoteIdent('"to"')} || ')' AS constraint_definition,
    seq AS constraint_order,
    NULL AS comment,
    on_delete AS remove_rule,
    on_update AS update_rule
  FROM pragma_foreign_key_list(${quoteLiteral(table)})
  ORDER BY id, seq;
`;

const getTableUsedAsReference = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    'fk_' || fk.id AS constraint_name,
    NULL AS table_schema,
    m.name AS table_name,
    fk."from" AS column_name,
    NULL AS reference_table_schema,
    fk."table" AS reference_table_name,
    fk."to" AS reference_column_name
  FROM sqlite_schema m
  JOIN pragma_foreign_key_list(m.name) fk
  WHERE m.type = 'table'
  AND m.name NOT LIKE 'sqlite_%'
  AND fk."table" = ${quoteLiteral(table)}
  ORDER BY m.name, fk.id, fk.seq;
`;

const getTableRestrictions = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    'pk_' || ${quoteLiteral(table)} AS constraint_name,
    'primary_key' AS constraint_type,
    'PRIMARY KEY (' || group_concat(${sqlQuoteIdent(
      'column_name',
    )}, ', ') || ')' AS constraint_definition,
    NULL AS expression,
    group_concat(column_name, ',') AS column_names,
    NULL AS comment
  FROM (
    SELECT name AS column_name
    FROM pragma_table_info(${quoteLiteral(table)})
    WHERE pk > 0
    ORDER BY pk
  )
  HAVING count(*) > 0

  UNION ALL

  SELECT
    il.name AS constraint_name,
    'unique_key' AS constraint_type,
    'UNIQUE (' || group_concat(${sqlQuoteIdent('ii.name')}, ', ') || ')' AS constraint_definition,
    NULL AS expression,
    group_concat(ii.name, ',') AS column_names,
    NULL AS comment
  FROM pragma_index_list(${quoteLiteral(table)}) il
  JOIN pragma_index_info(il.name) ii
  WHERE il."unique" = 1
  AND il.origin <> 'pk'
  GROUP BY il.name
  ORDER BY constraint_name;
`;

const getTotalRowsCountInTable = ({ table, where }: ITableWithSchema & { where?: string }) => {
  const whereQuery = where ? `WHERE ${where}` : '';
  return /* sql */ `SELECT count(*) as total_rows FROM ${getTableName({ table })} ${whereQuery};`;
};

const serializeOrderBy = (orderBy?: IOrderBy[]) => {
  if (!orderBy?.length) return '';

  const columns = orderBy.map(({ columnName, sortType }) => {
    const safeSortType = sortType === 'DESC' ? 'DESC' : 'ASC';
    return `${quoteIdent(columnName)} ${safeSortType}`;
  });

  return `ORDER BY ${columns.join(', ')}`;
};

const selectWithOffset = ({
  table,
  where,
  orderBy,
  limit = 50,
  actualPage = 1,
}: IGetTableDataParams) => {
  const offset = limit * (actualPage - 1);
  const orderByQuery = serializeOrderBy(orderBy);
  const whereQuery = where ? `WHERE ${where}` : '';

  return /* sql */ `
    SELECT * FROM ${getTableName({
      table,
    })} ${whereQuery} ${orderByQuery} LIMIT ${limit} OFFSET ${offset};
  `;
};

const getTableDefinition = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT sql AS definition
  FROM sqlite_schema
  WHERE type = 'table'
  AND name = ${quoteLiteral(table)};
`;

const getTableIndexes = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    il.name AS index_name,
    NULL AS index_method,
    CASE WHEN il."unique" = 1 THEN true ELSE false END AS is_unique,
    CASE WHEN il.origin = 'pk' THEN true ELSE false END AS is_primary,
    true AS is_valid,
    group_concat(ii.name, ',') AS column_names,
    group_concat(CASE WHEN ii."desc" = 1 THEN 'DESC' ELSE 'ASC' END, ',') AS column_orders,
    NULL AS expression,
    NULL AS predicate,
    COALESCE(s.index_size_bytes, 0) AS index_size_bytes,
    COALESCE(
      sm.sql,
      'CREATE ' || CASE WHEN il."unique" = 1 THEN 'UNIQUE ' ELSE '' END ||
      'INDEX ' || ${sqlQuoteIdent('il.name')} || ' ON ' || ${quoteLiteral(quoteIdent(table))} ||
      ' (' || group_concat(${sqlQuoteIdent(
        'ii.name',
      )} || ' ' || CASE WHEN ii."desc" = 1 THEN 'DESC' ELSE 'ASC' END, ', ') || ')'
    ) AS index_definition
  FROM pragma_index_list(${quoteLiteral(table)}) il
  JOIN pragma_index_xinfo(il.name) ii
  LEFT JOIN sqlite_schema sm ON sm.type = 'index' AND sm.name = il.name
  LEFT JOIN (
    SELECT name, SUM(pgsize) AS index_size_bytes
    FROM dbstat
    GROUP BY name
  ) s ON s.name = il.name
  WHERE ii.key = 1
  GROUP BY il.name, il."unique", il.origin, sm.sql, s.index_size_bytes
  ORDER BY il.name;
`;

const getTableTriggers = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    name AS trigger_name,
    CASE
      WHEN upper(sql) LIKE '% BEFORE %' THEN 'BEFORE'
      WHEN upper(sql) LIKE '% INSTEAD OF %' THEN 'INSTEAD OF'
      ELSE 'AFTER'
    END AS timing,
    CASE
      WHEN upper(sql) LIKE '% INSERT %' THEN 'INSERT'
      WHEN upper(sql) LIKE '% UPDATE %' THEN 'UPDATE'
      WHEN upper(sql) LIKE '% DELETE %' THEN 'DELETE'
      ELSE NULL
    END AS event,
    'ROW' AS orientation,
    NULL AS function_name,
    'enabled' AS status,
    sql AS trigger_definition
  FROM sqlite_schema
  WHERE type = 'trigger'
  AND tbl_name = ${quoteLiteral(table)}
  ORDER BY name;
`;

export default {
  getTables,
  getTableColumns,
  getColumnTypes,
  getTableReferences,
  getTableUsedAsReference,
  getTotalRowsCountInTable,
  selectWithOffset,
  getTableRestrictions,
  getTableDefinition,
  getTableIndexes,
  getTableTriggers,
};
