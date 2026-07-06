import type {
  DdlColumnInfo,
  DdlReferenceInfo,
  DdlRestrictionInfo,
  RendererDialect,
  RendererDialectDdl,
} from './types';

const quoteIdent = (value: string) => `\`${String(value).replace(/`/g, '``')}\``;

const mysqlIntegerTypes = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint']);
const mysqlPrefixIndexTypes = new Set([
  'tinytext',
  'text',
  'mediumtext',
  'longtext',
  'tinyblob',
  'blob',
  'mediumblob',
  'longblob',
]);
const mysqlStringTypesDefaultLength = new Map([
  ['varchar', 255],
  ['char', 255],
  ['varbinary', 255],
  ['binary', 255],
]);
const mysqlStringTypesMaxLength = new Map([
  ['varchar', 16383],
  ['char', 255],
  ['varbinary', 65535],
  ['binary', 255],
]);

const getMysqlColumnType = (
  column: DdlColumnInfo,
  helpers: Parameters<RendererDialectDdl['getColumnDefinitionDdl']>[1],
) => {
  const columnType = helpers.normalizeOptionalString(column.udt_name);
  const dataType = String(column.data_type || '').toLowerCase();

  if (columnType?.toLowerCase().startsWith(dataType)) return columnType;

  if (mysqlIntegerTypes.has(dataType)) return column.data_type;

  const defaultLength = mysqlStringTypesDefaultLength.get(dataType);
  const maxLength = mysqlStringTypesMaxLength.get(dataType);

  if (defaultLength) {
    const length = column.character_maximum_length || 0;

    if (!length || (maxLength && length > maxLength)) {
      return `${column.data_type}(${defaultLength})`;
    }
  }

  return helpers.getColumnType(column);
};

const getDefaultSql = (
  value: string | undefined,
  helpers: Parameters<RendererDialectDdl['getColumnDefinitionDdl']>[1],
) => {
  const defaultValue = helpers.normalizeOptionalString(value);
  return defaultValue ? ` DEFAULT ${defaultValue}` : '';
};

const isReferenceConstraint = (
  constraint: DdlRestrictionInfo | DdlReferenceInfo,
): constraint is DdlReferenceInfo => {
  return 'reference_table_name' in constraint && !!constraint.reference_table_name;
};

const isAutoIncrementRestriction = (column: DdlColumnInfo, restriction: DdlRestrictionInfo) => {
  return (
    ['primary_key', 'unique_key'].includes(restriction.constraint_type || '') &&
    restriction.column_names?.length === 1 &&
    restriction.column_names[0] === column.column_name
  );
};

const getAutoIncrementRestriction = (column: DdlColumnInfo, restrictions: DdlRestrictionInfo[]) => {
  return restrictions.find((restriction) => isAutoIncrementRestriction(column, restriction));
};

const getMysqlChangeColumnDdl = (
  tableName: string,
  column: Parameters<RendererDialectDdl['getChangeColumnDdl']>[1],
  helpers: Parameters<RendererDialectDdl['getChangeColumnDdl']>[2],
  options: {
    includeAutoIncrement: boolean;
    forceModify?: boolean;
    skipRename?: boolean;
  },
) => {
  const originalColumn = column.__originalColumn;
  const originalColumnName = originalColumn.column_name;
  const currentColumnName = column.column_name;
  const targetColumnName = currentColumnName || originalColumnName;
  const statements: string[] = [];

  if (!options.skipRename && currentColumnName && currentColumnName !== originalColumnName) {
    statements.push(
      `ALTER TABLE ${tableName}\n  RENAME COLUMN ${helpers.quoteIdent(
        originalColumnName,
      )} TO ${helpers.quoteIdent(currentColumnName)};`,
    );
  }

  const columnForDefinition = {
    ...column,
    column_name: targetColumnName,
    is_auto_increment: options.includeAutoIncrement ? column.is_auto_increment : false,
  };
  const originalDefault = helpers.normalizeOptionalString(originalColumn.column_default);
  const currentDefault = helpers.normalizeOptionalString(column.column_default);
  const originalType = getMysqlColumnType(originalColumn, helpers);
  const currentType = getMysqlColumnType(column, helpers);
  const shouldModifyColumn =
    options.forceModify ||
    currentType !== originalType ||
    column.is_nullable !== originalColumn.is_nullable ||
    currentDefault !== originalDefault ||
    (!options.includeAutoIncrement &&
      !column.is_auto_increment &&
      originalColumn.is_auto_increment);

  if (shouldModifyColumn) {
    statements.push(
      `ALTER TABLE ${tableName}\n  MODIFY COLUMN ${mysqlDdl.getColumnDefinitionDdl(
        columnForDefinition,
        helpers,
      )};`,
    );
  }

  return statements;
};

const mysqlDdl: RendererDialectDdl = {
  getColumnDefinitionDdl(column, helpers) {
    const nullSql = column.is_auto_increment
      ? ' NOT NULL'
      : column.is_nullable
      ? ' NULL'
      : ' NOT NULL';
    const autoIncrementSql = column.is_auto_increment ? ' AUTO_INCREMENT' : '';
    const defaultSql = column.is_auto_increment
      ? ''
      : getDefaultSql(column.column_default, helpers);

    return `${helpers.quoteIdent(column.column_name)} ${getMysqlColumnType(
      column,
      helpers,
    )}${nullSql}${defaultSql}${autoIncrementSql}`;
  },

  getConstraintCommentDdl() {
    return '';
  },

  getColumnCommentDdl() {
    return '';
  },

  getTableCommentDdl() {
    return '';
  },

  getCreateTableDdl(tableName, columns, restrictions, helpers) {
    const columnLines = columns.map(
      (column) => `  ${this.getColumnDefinitionDdl(column, helpers)}`,
    );
    const restrictionLines = restrictions.map(
      (restriction) =>
        `  CONSTRAINT ${helpers.quoteIdent(
          restriction.constraint_name,
        )} ${this.getRestrictionDefinitionDdl(restriction, helpers)}`,
    );

    return `CREATE TABLE ${tableName} (\n${[...columnLines, ...restrictionLines].join(',\n')}\n);`;
  },

  getPostCreateTableRestrictionsDdl() {
    return [];
  },

  getAddColumnDdl(tableName, column, helpers, restrictions = []) {
    if (!column.is_auto_increment) {
      return [
        `ALTER TABLE ${tableName}\n  ADD COLUMN ${this.getColumnDefinitionDdl(column, helpers)};`,
      ];
    }

    const autoIncrementRestriction = getAutoIncrementRestriction(column, restrictions);

    if (!autoIncrementRestriction) {
      return [
        `ALTER TABLE ${tableName}\n  ADD COLUMN ${this.getColumnDefinitionDdl(column, helpers)};`,
      ];
    }

    return [
      `ALTER TABLE ${tableName}\n  ADD COLUMN ${this.getColumnDefinitionDdl(
        column,
        helpers,
      )},\n  ADD CONSTRAINT ${helpers.quoteIdent(
        autoIncrementRestriction.constraint_name,
      )} ${this.getRestrictionDefinitionDdl(autoIncrementRestriction, helpers)};`,
    ];
  },

  getPostCreateRestrictionAddColumnDdl() {
    return [];
  },

  getDropColumnDdl(tableName, columnName, helpers) {
    return `ALTER TABLE ${tableName}\n  DROP COLUMN ${helpers.quoteIdent(columnName)};`;
  },

  getDropAutoIncrementDdl(tableName, column, helpers) {
    return `ALTER TABLE ${tableName}\n  MODIFY COLUMN ${this.getColumnDefinitionDdl(
      { ...column, is_auto_increment: false },
      helpers,
    )};`;
  },

  getDropConstraintDdl(tableName, constraint, helpers) {
    if (typeof constraint === 'string') {
      return `ALTER TABLE ${tableName}\n  DROP FOREIGN KEY ${helpers.quoteIdent(constraint)};`;
    }

    if (isReferenceConstraint(constraint)) {
      return `ALTER TABLE ${tableName}\n  DROP FOREIGN KEY ${helpers.quoteIdent(
        constraint.constraint_name,
      )};`;
    }

    if (constraint.constraint_type === 'primary_key') {
      return `ALTER TABLE ${tableName}\n  DROP PRIMARY KEY;`;
    }

    if (constraint.constraint_type === 'unique_key') {
      return `ALTER TABLE ${tableName}\n  DROP INDEX ${helpers.quoteIdent(
        constraint.constraint_name,
      )};`;
    }

    return `ALTER TABLE ${tableName}\n  DROP CHECK ${helpers.quoteIdent(
      constraint.constraint_name,
    )};`;
  },

  getDropIndexDdl(_schema, table, indexName, helpers) {
    return `DROP INDEX ${helpers.quoteIdent(indexName)} ON ${helpers.getTableName(
      undefined,
      table,
    )};`;
  },

  getRestrictionDefinitionDdl(restriction, helpers) {
    if (restriction.constraint_type === 'primary_key') {
      return `PRIMARY KEY (${(restriction.column_names || []).map(helpers.quoteIdent).join(', ')})`;
    }

    if (restriction.constraint_type === 'unique_key') {
      return `UNIQUE (${(restriction.column_names || []).map(helpers.quoteIdent).join(', ')})`;
    }

    const expression = String(restriction.expression || '').trim();
    if (/^check\s*\(/i.test(expression)) return expression;

    return `CHECK (${expression})`;
  },

  getCreateRestrictionDdl(tableName, restriction, helpers) {
    return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${helpers.quoteIdent(
      restriction.constraint_name,
    )} ${this.getRestrictionDefinitionDdl(restriction, helpers)};`;
  },

  getCreateConstraintFromDefinitionDdl(tableName, constraintName, definition, _comment, helpers) {
    return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${helpers.quoteIdent(
      constraintName,
    )} ${definition};`;
  },

  getCreateIndexDdl(_schema, table, index, helpers) {
    const tableName = helpers.getTableName(undefined, table);
    const columnsByName = new Map(
      (index.columns || []).map((column) => [column.column_name, column]),
    );
    const method = index.index_method ? ` USING ${index.index_method}` : '';
    const columns = (index.column_names || [])
      .map((columnName) => {
        const column = columnsByName.get(columnName);
        const dataType = String(column?.data_type || '').toLowerCase();
        const prefixLength = mysqlPrefixIndexTypes.has(dataType) ? '(255)' : '';

        return `${helpers.quoteIdent(columnName)}${prefixLength}`;
      })
      .join(', ');

    return `CREATE INDEX ${helpers.quoteIdent(
      index.index_name,
    )}${method} ON ${tableName} (${columns});`;
  },

  getCreateReferenceDdl(tableName, reference, helpers) {
    const referenceTableName = helpers.getTableName(undefined, reference.reference_table_name);

    return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${helpers.quoteIdent(
      reference.constraint_name,
    )} FOREIGN KEY (${helpers.quoteIdent(
      reference.column_name,
    )}) REFERENCES ${referenceTableName} (${helpers.quoteIdent(reference.reference_column_name)});`;
  },

  getChangeColumnDdl(tableName, column, helpers) {
    return getMysqlChangeColumnDdl(tableName, column, helpers, {
      includeAutoIncrement: false,
    });
  },

  getPostCreateRestrictionChangeColumnDdl(tableName, column, helpers) {
    if (!column.is_auto_increment || column.__originalColumn.is_auto_increment) return [];

    return getMysqlChangeColumnDdl(tableName, column, helpers, {
      includeAutoIncrement: true,
      forceModify: true,
      skipRename: true,
    });
  },
};

const mysql: RendererDialect = {
  id: 'mysql',
  label: 'MySQL',
  editorDialect: 'mysql',
  defaultPort: 3306,
  supportsSchemas: false,
  supportsFunctions: false,
  supportsAutoIncrement: true,
  quoteIdent,
  getQualifiedName: (_schema, name) => quoteIdent(name),
  indexMethods: ['BTREE', 'HASH'],
  commonColumnTypes: [
    'varchar',
    'text',
    'int',
    'bigint',
    'tinyint',
    'boolean',
    'decimal',
    'date',
    'datetime',
    'timestamp',
    'json',
  ],
  ddl: mysqlDdl,
};

export default mysql;
