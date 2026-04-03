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
  SELECT DISTINCT
    r.constraint_name,
    r.table_schema,
    r.table_name, 
    r.column_name,
    u.table_schema as "reference_table_schema", 
    u.table_name as "reference_table_name",
    u.column_name as "reference_column_name"
  FROM information_schema.constraint_column_usage u
  INNER JOIN information_schema.referential_constraints fk on u.constraint_schema = fk.unique_constraint_schema AND u.constraint_name = fk.unique_constraint_name 
  INNER JOIN information_schema.key_column_usage r ON r.constraint_schema = fk.constraint_schema AND r.constraint_name = fk.constraint_name
  WHERE r.table_schema = '${schema}'
  AND r.table_name = '${table}';
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
