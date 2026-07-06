import type { RendererDialect, RendererDialectDdl } from './types';

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const getDefaultSql = (
  value: string | undefined,
  helpers: Parameters<RendererDialectDdl['getColumnDefinitionDdl']>[1],
) => {
  const defaultValue = helpers.normalizeOptionalString(value);
  return defaultValue ? ` DEFAULT ${defaultValue}` : '';
};

const postgresDdl: RendererDialectDdl = {
  getColumnDefinitionDdl(column, helpers) {
    const notNull = column.is_nullable ? '' : ' NOT NULL';

    return `${helpers.quoteIdent(column.column_name)} ${helpers.getColumnType(
      column,
    )}${getDefaultSql(column.column_default, helpers)}${notNull}`;
  },

  getConstraintCommentDdl(tableName, constraintName, comment, helpers) {
    if (!comment) return '';

    return `COMMENT ON CONSTRAINT ${helpers.quoteIdent(
      constraintName,
    )} ON ${tableName} IS ${helpers.quoteLiteral(comment)};`;
  },

  getColumnCommentDdl(tableName, columnName, comment, helpers) {
    const commentSql = helpers.normalizeOptionalString(comment);

    return `COMMENT ON COLUMN ${tableName}.${helpers.quoteIdent(columnName)} IS ${
      commentSql ? helpers.quoteLiteral(commentSql) : 'NULL'
    };`;
  },

  getTableCommentDdl(tableName, comment, helpers) {
    const commentSql = helpers.normalizeOptionalString(comment);
    if (!commentSql) return '';

    return `COMMENT ON TABLE ${tableName} IS ${helpers.quoteLiteral(commentSql)};`;
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
    const statements = [
      `ALTER TABLE ${tableName}\n  ADD COLUMN ${this.getColumnDefinitionDdl(column, helpers)};`,
    ];
    const comment = helpers.normalizeOptionalString(column.description);

    if (comment) {
      statements.push(this.getColumnCommentDdl(tableName, column.column_name, comment, helpers));
    }

    return statements;
  },

  getPostCreateRestrictionAddColumnDdl() {
    return [];
  },

  getDropColumnDdl(tableName, columnName, helpers) {
    return `ALTER TABLE ${tableName}\n  DROP COLUMN ${helpers.quoteIdent(columnName)};`;
  },

  getDropConstraintDdl(tableName, constraint, helpers) {
    const constraintName = typeof constraint === 'string' ? constraint : constraint.constraint_name;

    return `ALTER TABLE ${tableName}\n  DROP CONSTRAINT ${helpers.quoteIdent(constraintName)};`;
  },

  getDropIndexDdl(schema, _table, indexName, helpers) {
    return `DROP INDEX ${helpers.getTableName(schema, indexName)};`;
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

  getCreateConstraintFromDefinitionDdl(tableName, constraintName, definition, comment, helpers) {
    const ddl = `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${helpers.quoteIdent(
      constraintName,
    )} ${definition};`;
    const commentDdl = this.getConstraintCommentDdl(tableName, constraintName, comment, helpers);

    return commentDdl ? `${ddl}\n\n${commentDdl}` : ddl;
  },

  getCreateIndexDdl(schema, table, index, helpers) {
    const tableName = helpers.getTableName(schema, table);
    const columns = (index.column_names || []).map(helpers.quoteIdent).join(', ');
    const method = index.index_method || 'btree';

    return `CREATE INDEX ${helpers.quoteIdent(
      index.index_name,
    )} ON ${tableName} USING ${method} (${columns});`;
  },

  getCreateReferenceDdl(tableName, reference, helpers) {
    const referenceTableName = helpers.getTableName(
      reference.reference_table_schema,
      reference.reference_table_name,
    );

    return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${helpers.quoteIdent(
      reference.constraint_name,
    )} FOREIGN KEY (${helpers.quoteIdent(
      reference.column_name,
    )}) REFERENCES ${referenceTableName} (${helpers.quoteIdent(reference.reference_column_name)});`;
  },

  getChangeColumnDdl(tableName, column, helpers) {
    const originalColumn = column.__originalColumn;
    const originalColumnName = originalColumn.column_name;
    const currentColumnName = column.column_name;
    const targetColumnName = currentColumnName || originalColumnName;
    const statements: string[] = [];

    if (currentColumnName && currentColumnName !== originalColumnName) {
      statements.push(
        `ALTER TABLE ${tableName}\n  RENAME COLUMN ${helpers.quoteIdent(
          originalColumnName,
        )} TO ${helpers.quoteIdent(currentColumnName)};`,
      );
    }

    if (helpers.getColumnType(column) !== helpers.getColumnType(originalColumn)) {
      statements.push(
        `ALTER TABLE ${tableName}\n  ALTER COLUMN ${helpers.quoteIdent(
          targetColumnName,
        )} TYPE ${helpers.getColumnType(column)};`,
      );
    }

    if (column.is_nullable !== originalColumn.is_nullable) {
      statements.push(
        `ALTER TABLE ${tableName}\n  ALTER COLUMN ${helpers.quoteIdent(targetColumnName)} ${
          column.is_nullable ? 'DROP NOT NULL' : 'SET NOT NULL'
        };`,
      );
    }

    const originalDefault = helpers.normalizeOptionalString(originalColumn.column_default);
    const currentDefault = helpers.normalizeOptionalString(column.column_default);

    if (currentDefault !== originalDefault) {
      statements.push(
        currentDefault
          ? `ALTER TABLE ${tableName}\n  ALTER COLUMN ${helpers.quoteIdent(
              targetColumnName,
            )} SET DEFAULT ${currentDefault};`
          : `ALTER TABLE ${tableName}\n  ALTER COLUMN ${helpers.quoteIdent(
              targetColumnName,
            )} DROP DEFAULT;`,
      );
    }

    const originalDescription = helpers.normalizeOptionalString(originalColumn.description);
    const currentDescription = helpers.normalizeOptionalString(column.description);

    if (currentDescription !== originalDescription) {
      statements.push(
        this.getColumnCommentDdl(tableName, targetColumnName, currentDescription, helpers),
      );
    }

    return statements;
  },

  getPostCreateRestrictionChangeColumnDdl() {
    return [];
  },
};

const postgres: RendererDialect = {
  id: 'postgres',
  label: 'PostgreSQL',
  editorDialect: 'postgres',
  defaultPort: 5432,
  supportsSchemas: true,
  supportsFunctions: true,
  supportsAutoIncrement: false,
  quoteIdent,
  getQualifiedName: (schema, name) =>
    schema ? `${quoteIdent(schema)}.${quoteIdent(name)}` : quoteIdent(name),
  commonColumnTypes: [
    'varchar',
    'text',
    'integer',
    'bigint',
    'serial',
    'bigserial',
    'uuid',
    'boolean',
    'numeric',
    'decimal',
    'date',
    'timestamp',
    'timestamptz',
    'json',
    'jsonb',
  ],
  ddl: postgresDdl,
};

export default postgres;
