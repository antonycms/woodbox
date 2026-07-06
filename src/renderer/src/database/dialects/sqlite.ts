import type { RendererDialect, RendererDialectDdl } from './types';

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const getDefaultSql = (
  value: string | undefined,
  helpers: Parameters<RendererDialectDdl['getColumnDefinitionDdl']>[1],
) => {
  const defaultValue = helpers.normalizeOptionalString(value);
  return defaultValue ? ` DEFAULT ${defaultValue}` : '';
};

const sqliteDdl: RendererDialectDdl = {
  getColumnDefinitionDdl(column, helpers) {
    const notNull = column.is_nullable ? '' : ' NOT NULL';

    return `${helpers.quoteIdent(column.column_name)} ${helpers.getColumnType(
      column,
    )}${getDefaultSql(column.column_default, helpers)}${notNull}`;
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

  getCreateTableDdl(tableName, columns, _restrictions, helpers) {
    const columnLines = columns.map(
      (column) => `  ${this.getColumnDefinitionDdl(column, helpers)}`,
    );

    return `CREATE TABLE ${tableName} (\n${columnLines.join(',\n')}\n);`;
  },

  getPostCreateTableRestrictionsDdl(tableName, restrictions, helpers) {
    return restrictions.map((restriction) =>
      this.getCreateRestrictionDdl(tableName, restriction, helpers),
    );
  },

  getAddColumnDdl(tableName, column, helpers) {
    return [
      `ALTER TABLE ${tableName}\n  ADD COLUMN ${this.getColumnDefinitionDdl(column, helpers)};`,
    ];
  },

  getPostCreateRestrictionAddColumnDdl() {
    return [];
  },

  getDropColumnDdl(tableName, columnName, helpers) {
    return `ALTER TABLE ${tableName}\n  DROP COLUMN ${helpers.quoteIdent(columnName)};`;
  },

  getDropConstraintDdl() {
    return '';
  },

  getDropIndexDdl(_schema, _table, indexName, helpers) {
    return `DROP INDEX ${helpers.quoteIdent(indexName)};`;
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
    const columns = (index.column_names || []).map(helpers.quoteIdent).join(', ');

    return `CREATE INDEX ${helpers.quoteIdent(index.index_name)} ON ${helpers.getTableName(
      undefined,
      table,
    )} (${columns});`;
  },

  getCreateReferenceDdl(tableName, reference, helpers) {
    return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${helpers.quoteIdent(
      reference.constraint_name,
    )} FOREIGN KEY (${helpers.quoteIdent(reference.column_name)}) REFERENCES ${helpers.quoteIdent(
      reference.reference_table_name,
    )} (${helpers.quoteIdent(reference.reference_column_name)});`;
  },

  getChangeColumnDdl(tableName, column, helpers) {
    const originalColumnName = column.__originalColumn.column_name;
    const currentColumnName = column.column_name;

    if (!currentColumnName || currentColumnName === originalColumnName) return [];

    return [
      `ALTER TABLE ${tableName}\n  RENAME COLUMN ${helpers.quoteIdent(
        originalColumnName,
      )} TO ${helpers.quoteIdent(currentColumnName)};`,
    ];
  },

  getPostCreateRestrictionChangeColumnDdl() {
    return [];
  },
};

const sqlite: RendererDialect = {
  id: 'sqlite',
  label: 'SQLite',
  editorDialect: 'sqlite',
  supportsSchemas: false,
  supportsFunctions: false,
  supportsAutoIncrement: false,
  quoteIdent,
  getQualifiedName: (_schema, name) => quoteIdent(name),
  commonColumnTypes: ['text', 'integer', 'real', 'numeric', 'blob'],
  ddl: sqliteDdl,
};

export default sqlite;
