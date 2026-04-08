/*
  VSCode Extension
  https://marketplace.visualstudio.com/items?itemName=jtladeiras.vscode-inline-sql
*/

/* postgres only */
const getAllSchemas = () => /* sql */ `
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_owner != 'postgres'
  ORDER BY schema_name;
`;

const getTables = () => /* sql */ `
  SELECT
    table_name,
    table_schema
  FROM information_schema.tables
  WHERE table_type='BASE TABLE'
  AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  ORDER BY table_name;
`;

const getTableColumns = ({ schema, table }: ITableWithSchema) => /* sql */ `
  SELECT
      c.column_name,
      c.data_type,
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
  AND ns.nspname = '${schema}'
  AND t.relname  = '${table}';
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
    ) AS constraint_type
  FROM pg_catalog.pg_constraint con
  INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
  WHERE con.contype IN ('p', 'u', 'c')
  AND nsp.nspname = '${schema}'
  AND rel.relname = '${table}'
`;

const getTotalRowsCountInTable = ({ schema, table }: ITableWithSchema) => /* sql */ `
  SELECT count(*) as total_rows FROM "${schema}"."${table}";
`;

const selectWithOffset = ({
  schema,
  table,
  where,
  orderBy,
  limit = 50,
  actualPage = 1,
}: IGetTotalRowsCountInTableData) => {
  const offset = limit * (actualPage - 1);
  const orderByQuery = orderBy ? `ORDER BY ${orderBy.columnName} ${orderBy.sortType}` : '';
  const whereQuery = where ? `WHERE ${where}` : '';

  return /* sql */ `
    SELECT * FROM "${schema}"."${table}" ${whereQuery} ${orderByQuery} LIMIT ${limit} OFFSET ${offset};
  `;
};

export default {
  getAllSchemas,
  getTables,
  getTableColumns,
  getTableReferences,
  getTableUsedAsReference,
  getTotalRowsCountInTable,
  selectWithOffset,
  getTableRestrictions,
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
  orderBy?: {
    columnName: string;
    sortType: 'DESC' | 'ASC';
  };
}
