import type {
  IGetTableDataParams,
  IOrderBy,
  ITableWithSchema,
} from '@main/database/types';

const quoteIdent = (value: string) => `\`${String(value).replace(/`/g, '``')}\``;
const quoteLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;
const sqlQuoteIdent = (sqlExpression: string) =>
  `CONCAT('\`', REPLACE(${sqlExpression}, '\`', '\`\`'), '\`')`;
const getTableName = ({ table }: ITableWithSchema) => quoteIdent(table);

const getTables = () => /* sql */ `
  SELECT
    TABLE_NAME AS table_name,
    NULL AS table_schema,
    CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END AS object_type,
    (table_type = 'BASE TABLE') AS supports_indexes,
    (table_type = 'BASE TABLE') AS supports_triggers,
    COALESCE(data_length, 0) + COALESCE(index_length, 0) AS total_size
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_type IN ('BASE TABLE', 'VIEW')
  ORDER BY table_name;
`;

const getTableColumns = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    COLUMN_NAME AS column_name,
    DATA_TYPE AS data_type,
    COLUMN_TYPE AS udt_name,
    CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
    NUMERIC_PRECISION AS numeric_precision,
    NUMERIC_SCALE AS numeric_scale,
    DATETIME_PRECISION AS datetime_precision,
    COLUMN_DEFAULT AS column_default,
    EXTRA AS extra,
    CASE WHEN EXTRA LIKE '%auto_increment%' THEN true ELSE false END AS is_auto_increment,
    NULLIF(COLUMN_COMMENT, '') AS description,
    CASE WHEN IS_NULLABLE = 'YES' THEN true ELSE false END AS is_nullable
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = ${quoteLiteral(table)}
  ORDER BY ordinal_position;
`;

const getColumnTypes = () => /* sql */ `
  SELECT 'bigint' AS name UNION SELECT 'blob' UNION SELECT 'boolean' UNION SELECT 'char'
  UNION SELECT 'date' UNION SELECT 'datetime' UNION SELECT 'decimal' UNION SELECT 'double'
  UNION SELECT 'float' UNION SELECT 'int' UNION SELECT 'json' UNION SELECT 'longtext'
  UNION SELECT 'mediumtext' UNION SELECT 'text' UNION SELECT 'time' UNION SELECT 'timestamp'
  UNION SELECT 'tinyint' UNION SELECT 'varchar';
`;

const getTableReferences = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    kcu.CONSTRAINT_NAME AS constraint_name,
    NULL AS table_schema,
    kcu.TABLE_NAME AS table_name,
    kcu.COLUMN_NAME AS column_name,
    NULL AS reference_table_schema,
    kcu.REFERENCED_TABLE_NAME AS reference_table_name,
    kcu.REFERENCED_COLUMN_NAME AS reference_column_name,
    CONCAT(
      'FOREIGN KEY (', ${sqlQuoteIdent('kcu.column_name')}, ') REFERENCES ',
      ${sqlQuoteIdent('kcu.referenced_table_name')}, ' (', ${sqlQuoteIdent(
        'kcu.referenced_column_name',
      )}, ')'
    ) AS constraint_definition,
    kcu.ORDINAL_POSITION AS constraint_order,
    NULL AS comment,
    rc.DELETE_RULE AS remove_rule,
    rc.UPDATE_RULE AS update_rule
  FROM information_schema.key_column_usage kcu
  LEFT JOIN information_schema.referential_constraints rc
    ON rc.constraint_schema = kcu.constraint_schema
    AND rc.constraint_name = kcu.constraint_name
    AND rc.table_name = kcu.table_name
  WHERE kcu.table_schema = DATABASE()
  AND kcu.table_name = ${quoteLiteral(table)}
  AND kcu.referenced_table_name IS NOT NULL
  ORDER BY kcu.constraint_name, kcu.ordinal_position;
`;

const getTableUsedAsReference = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    kcu.CONSTRAINT_NAME AS constraint_name,
    NULL AS table_schema,
    kcu.TABLE_NAME AS table_name,
    kcu.COLUMN_NAME AS column_name,
    NULL AS reference_table_schema,
    kcu.REFERENCED_TABLE_NAME AS reference_table_name,
    kcu.REFERENCED_COLUMN_NAME AS reference_column_name
  FROM information_schema.key_column_usage kcu
  WHERE kcu.table_schema = DATABASE()
  AND kcu.referenced_table_name = ${quoteLiteral(table)}
  ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position;
`;

const getTableRestrictions = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    tc.CONSTRAINT_NAME AS constraint_name,
    CASE
      WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 'primary_key'
      WHEN tc.CONSTRAINT_TYPE = 'UNIQUE' THEN 'unique_key'
      WHEN tc.CONSTRAINT_TYPE = 'CHECK' THEN 'check'
      ELSE NULL
    END AS constraint_type,
    CASE
      WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN CONCAT('PRIMARY KEY (', GROUP_CONCAT(${sqlQuoteIdent(
        'kcu.column_name',
      )} ORDER BY kcu.ordinal_position SEPARATOR ', '), ')')
      WHEN tc.CONSTRAINT_TYPE = 'UNIQUE' THEN CONCAT('UNIQUE (', GROUP_CONCAT(${sqlQuoteIdent(
        'kcu.column_name',
      )} ORDER BY kcu.ordinal_position SEPARATOR ', '), ')')
      ELSE NULL
    END AS constraint_definition,
    NULL AS expression,
    CONCAT('[', GROUP_CONCAT(JSON_QUOTE(kcu.column_name) ORDER BY kcu.ordinal_position SEPARATOR ','), ']') AS column_names,
    NULL AS comment
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = tc.constraint_schema
    AND kcu.constraint_name = tc.constraint_name
    AND kcu.table_name = tc.table_name
  WHERE tc.table_schema = DATABASE()
  AND tc.table_name = ${quoteLiteral(table)}
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  GROUP BY tc.constraint_name, tc.constraint_type
  ORDER BY tc.constraint_name;
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

const getTableDefinition = ({ table }: ITableWithSchema) =>
  /* sql */ `SHOW CREATE TABLE ${quoteIdent(table)};`;

const getTableIndexes = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    INDEX_NAME AS index_name,
    INDEX_TYPE AS index_method,
    CASE WHEN NON_UNIQUE = 0 THEN true ELSE false END AS is_unique,
    CASE WHEN INDEX_NAME = 'PRIMARY' THEN true ELSE false END AS is_primary,
    true AS is_valid,
    CONCAT('[', GROUP_CONCAT(JSON_QUOTE(column_name) ORDER BY seq_in_index SEPARATOR ','), ']') AS column_names,
    CONCAT('[', GROUP_CONCAT(JSON_QUOTE(CASE WHEN collation = 'D' THEN 'DESC' ELSE 'ASC' END) ORDER BY seq_in_index SEPARATOR ','), ']') AS column_orders,
    NULL AS expression,
    NULL AS predicate,
    NULL AS index_size_bytes,
    CONCAT(
      'CREATE ', CASE WHEN non_unique = 0 THEN 'UNIQUE ' ELSE '' END,
      'INDEX ', ${sqlQuoteIdent('index_name')}, ' ON ', ${sqlQuoteIdent('table_name')},
      ' (', GROUP_CONCAT(CONCAT(${sqlQuoteIdent(
        'column_name',
      )}, ' ', CASE WHEN collation = 'D' THEN 'DESC' ELSE 'ASC' END) ORDER BY seq_in_index SEPARATOR ', '), ')'
    ) AS index_definition
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
  AND table_name = ${quoteLiteral(table)}
  GROUP BY index_name, index_type, non_unique, table_name
  ORDER BY index_name;
`;

const getTableTriggers = ({ table }: ITableWithSchema) => /* sql */ `
  SELECT
    TRIGGER_NAME AS trigger_name,
    ACTION_TIMING AS timing,
    EVENT_MANIPULATION AS event,
    ACTION_ORIENTATION AS orientation,
    NULL AS function_name,
    'enabled' AS status,
    CONCAT(
      'CREATE TRIGGER ', ${sqlQuoteIdent(
        'trigger_name',
      )}, ' ', action_timing, ' ', event_manipulation,
      ' ON ', ${sqlQuoteIdent('event_object_table')}, ' FOR EACH ROW ', action_statement
    ) AS trigger_definition
  FROM information_schema.triggers
  WHERE trigger_schema = DATABASE()
  AND event_object_table = ${quoteLiteral(table)}
  ORDER BY trigger_name;
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
