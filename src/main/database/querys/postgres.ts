/*
  VSCode Extension
  https://marketplace.visualstudio.com/items?itemName=jtladeiras.vscode-inline-sql
*/

/* postgres only */
const getAllSchemas = () => /* sql */ `
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND schema_name NOT LIKE 'pg_temp_%'
  AND schema_name NOT LIKE 'pg_toast_temp_%'
  ORDER BY schema_name;
`;

const getTables = () => /* sql */ `
  SELECT
    table_name,
    table_schema,
    pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name)) AS total_size
  FROM information_schema.tables
  WHERE table_type='BASE TABLE'
  AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  ORDER BY table_name;
`;

const getTableColumns = ({ schema, table }: ITableWithSchema) => /* sql */ `
  SELECT
      c.column_name,
      c.data_type,
      c.udt_name,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.datetime_precision,
      c.column_default,
      pgd.description,
      (c.is_nullable = 'YES') AS is_nullable
  FROM information_schema.columns c
  LEFT JOIN pg_catalog.pg_statio_all_tables AS st ON (
    c.table_schema = st.schemaname AND
    c.table_name = st.relname
  )
  LEFT JOIN pg_catalog.pg_description pgd ON (
    pgd.objoid = st.relid AND
    pgd.objsubid = c.ordinal_position
  )
  WHERE c.table_name = '${table}' AND c.table_schema = '${schema}';
`;

const getTableReferences = ({ schema, table }: ITableWithSchema) => /* sql */ `
  SELECT
    c.conname AS constraint_name,
    ns.nspname AS table_schema,
    t.relname  AS table_name,
    a.attname  AS column_name,
    ns_ref.nspname AS reference_table_schema,
    t_ref.relname  AS reference_table_name,
    a_ref.attname  AS reference_column_name,
    pg_catalog.pg_get_constraintdef(c.oid) AS constraint_definition,
    cols.ordinality AS constraint_order,
    obj_description(c.oid, 'pg_constraint') AS comment,
    (CASE c.confdeltype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
      ELSE NULL END
    ) AS remove_rule,
    (CASE c.confupdtype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
      ELSE NULL END
    ) AS update_rule
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class       t      ON t.oid      = c.conrelid
  JOIN pg_catalog.pg_namespace   ns     ON ns.oid     = t.relnamespace
  JOIN pg_catalog.pg_class       t_ref  ON t_ref.oid  = c.confrelid
  JOIN pg_catalog.pg_namespace   ns_ref ON ns_ref.oid = t_ref.relnamespace
  CROSS JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS cols(src_col, ref_col, ordinality)
  JOIN pg_catalog.pg_attribute a     ON a.attrelid     = c.conrelid  AND a.attnum     = cols.src_col
  JOIN pg_catalog.pg_attribute a_ref ON a_ref.attrelid = c.confrelid AND a_ref.attnum = cols.ref_col
  WHERE c.contype = 'f'
  AND ns.nspname = '${schema}'
  AND t.relname  = '${table}'
  ORDER BY c.conname, cols.ordinality;
`;

const getTableUsedAsReference = ({ schema, table }: ITableWithSchema) => /* sql */ `
  SELECT
    c.conname AS constraint_name,
    ns.nspname AS table_schema,
    t.relname  AS table_name,
    a.attname  AS column_name,
    ns_ref.nspname AS reference_table_schema,
    t_ref.relname  AS reference_table_name,
    a_ref.attname  AS reference_column_name
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class       t      ON t.oid      = c.conrelid
  JOIN pg_catalog.pg_namespace   ns     ON ns.oid     = t.relnamespace
  JOIN pg_catalog.pg_class       t_ref  ON t_ref.oid  = c.confrelid
  JOIN pg_catalog.pg_namespace   ns_ref ON ns_ref.oid = t_ref.relnamespace
  CROSS JOIN LATERAL unnest(c.conkey, c.confkey) AS cols(src_col, ref_col)
  JOIN pg_catalog.pg_attribute a     ON a.attrelid     = c.conrelid  AND a.attnum     = cols.src_col
  JOIN pg_catalog.pg_attribute a_ref ON a_ref.attrelid = c.confrelid AND a_ref.attnum = cols.ref_col
  WHERE c.contype = 'f'
  AND ns_ref.nspname = '${schema}'
  AND t_ref.relname  = '${table}';
`;

const getTableRestrictions = ({ schema, table }) => /* sql */ `
  SELECT
    con.conname AS constraint_name,
    (CASE
      WHEN con.contype = 'p' THEN 'primary_key'
      WHEN con.contype = 'u' THEN 'unique_key'
      WHEN con.contype = 'c' THEN 'check'
      ELSE NULL END
    ) AS constraint_type,
    pg_catalog.pg_get_constraintdef(con.oid) AS constraint_definition,
    pg_catalog.pg_get_expr(con.conbin, con.conrelid) AS expression,
    COALESCE(
      json_agg(att.attname ORDER BY cols.ordinality) FILTER (WHERE att.attname IS NOT NULL),
      '[]'::json
    ) AS column_names,
    obj_description(con.oid, 'pg_constraint') AS comment
  FROM pg_catalog.pg_constraint con
  INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
  LEFT JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ordinality) ON TRUE
  LEFT JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
  WHERE con.contype IN ('p', 'u', 'c')
  AND nsp.nspname = '${schema}'
  AND rel.relname = '${table}'
  GROUP BY con.oid, con.conname, con.contype, con.conbin, con.conrelid
  ORDER BY con.conname
`;

const getTotalRowsCountInTable = ({
  schema,
  table,
  where,
}: ITableWithSchema & { where?: string }) => {
  const whereQuery = where ? `WHERE ${where}` : '';
  return /* sql */ `SELECT count(*) as total_rows FROM "${schema}"."${table}" ${whereQuery};`;
};

const serializeOrderBy = (orderBy?: IOrderBy[]) => {
  if (!orderBy?.length) return '';

  const columns = orderBy.map(({ columnName, sortType }) => {
    const safeColumnName = columnName.replace(/"/g, '""');
    const safeSortType = sortType === 'DESC' ? 'DESC' : 'ASC';

    return `"${safeColumnName}" ${safeSortType}`;
  });

  return `ORDER BY ${columns.join(', ')}`;
};

const selectWithOffset = ({
  schema,
  table,
  where,
  orderBy,
  limit = 50,
  actualPage = 1,
}: IGetTotalRowsCountInTableData) => {
  const offset = limit * (actualPage - 1);
  const orderByQuery = serializeOrderBy(orderBy);
  const whereQuery = where ? `WHERE ${where}` : '';

  return /* sql */ `
    SELECT * FROM "${schema}"."${table}" ${whereQuery} ${orderByQuery} LIMIT ${limit} OFFSET ${offset};
  `;
};

const getTableDefinition = ({ schema, table }: ITableWithSchema) => /* sql */ `
  WITH table_info AS (
    SELECT c.oid, n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = '${table}' AND n.nspname = '${schema}' AND c.relkind = 'r'
  ),
  columns AS (
    SELECT
      a.attnum AS sort_order,
      '  ' || quote_ident(a.attname) || ' ' ||
      CASE
        WHEN ad.adbin IS NOT NULL AND pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval(%'
        THEN CASE pg_catalog.format_type(a.atttypid, a.atttypmod)
          WHEN 'smallint' THEN 'SMALLSERIAL' || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
          WHEN 'integer'  THEN 'SERIAL'      || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
          WHEN 'bigint'   THEN 'BIGSERIAL'   || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
          ELSE
            pg_catalog.format_type(a.atttypid, a.atttypmod) ||
            CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
            ' DEFAULT ' || pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
        END
        ELSE
          pg_catalog.format_type(a.atttypid, a.atttypmod) ||
          CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END
      END AS part
    FROM table_info ti
    JOIN pg_attribute a ON a.attrelid = ti.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  ),
  constraints AS (
    SELECT
      1000 + row_number() OVER (ORDER BY con.conname) AS sort_order,
      '  CONSTRAINT ' || quote_ident(con.conname) || ' ' || pg_get_constraintdef(con.oid, true) AS part
    FROM table_info ti
    JOIN pg_constraint con ON con.conrelid = ti.oid
    WHERE con.contype IN ('p', 'u', 'c', 'f')
  )
  SELECT
    'CREATE TABLE ' || quote_ident(ti.schema_name) || '.' || quote_ident(ti.table_name) || ' (' || E'\\n' ||
    (
      SELECT string_agg(part, ',' || E'\\n' ORDER BY sort_order)
      FROM (SELECT * FROM columns UNION ALL SELECT * FROM constraints) all_parts
    ) ||
    E'\\n)' AS definition
  FROM table_info ti
`;

const getTableTriggers = ({ schema, table }: ITableWithSchema) => /* sql */ `
  SELECT
    t.tgname AS trigger_name,
    CASE
      WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
      WHEN t.tgtype & 2  = 2  THEN 'BEFORE'
      ELSE 'AFTER'
    END AS timing,
    array_to_string(
      ARRAY[
        CASE WHEN t.tgtype & 4  = 4  THEN 'INSERT'   ELSE NULL END,
        CASE WHEN t.tgtype & 8  = 8  THEN 'DELETE'   ELSE NULL END,
        CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE'   ELSE NULL END,
        CASE WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE' ELSE NULL END
      ],
      ' OR '
    ) AS event,
    CASE t.tgtype & 1 WHEN 1 THEN 'ROW' ELSE 'STATEMENT' END AS orientation,
    n_func.nspname || '.' || p.proname AS function_name,
    CASE t.tgenabled
      WHEN 'O' THEN 'enabled'
      WHEN 'D' THEN 'disabled'
      WHEN 'R' THEN 'replica'
      WHEN 'A' THEN 'always'
    END AS status,
    pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c     ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_proc p      ON p.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace n_func ON n_func.oid = p.pronamespace
  WHERE NOT t.tgisinternal
  AND c.relname  = '${table}'
  AND n.nspname  = '${schema}'
  ORDER BY t.tgname;
`;

const getFunctions = () => /* sql */ `
  SELECT
    p.proname  AS function_name,
    n.nspname  AS function_schema
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  ORDER BY n.nspname, p.proname;
`;

const getFunctionDefinition = ({
  schema,
  functionName,
}: {
  schema: string;
  functionName: string;
}) => /* sql */ `
  SELECT pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = '${functionName}'
    AND n.nspname = '${schema}';
`;

export default {
  getAllSchemas,
  getTables,
  getTableColumns,
  getTableReferences,
  getTableUsedAsReference,
  getTotalRowsCountInTable,
  selectWithOffset,
  getTableRestrictions,
  getTableDefinition,
  getTableTriggers,
  getFunctions,
  getFunctionDefinition,
};

export interface ITableWithSchema {
  table: string;
  schema: string;
}

export interface IGetTotalRowsCountInTableData {
  table: string;
  schema: string;
  limit?: number;
  actualPage?: number;
  where?: string;
  orderBy?: IOrderBy[];
}

export interface IOrderBy {
  columnName: string;
  sortType: 'DESC' | 'ASC';
}
