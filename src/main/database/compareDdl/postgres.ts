import type { CompareDdlBuilder } from './types';
import { makeColumnDefinition, makeColumnType, pushSemicolon, qualifiedName } from './utils';

export const createPostgresCompareDdlBuilder = (
  quoteIdentifier: (value: string) => string,
): CompareDdlBuilder => ({
  quoteIdentifier,
  qualifiedName: (schema, name) => qualifiedName(quoteIdentifier, schema, name),
  makeColumnType,
  makeColumnDefinition: (column) => makeColumnDefinition(quoteIdentifier, column),
  dropObject: (type, schema, name, cascade) => {
    const sqlType = type === 'materialized_view' ? 'MATERIALIZED VIEW' : type.toUpperCase();
    return `DROP ${sqlType} IF EXISTS ${qualifiedName(quoteIdentifier, schema, name)}${
      cascade ? ' CASCADE' : ''
    };`;
  },
  addColumn: (tableName, column) =>
    `ALTER TABLE ${tableName}\n  ADD COLUMN ${makeColumnDefinition(quoteIdentifier, column)};`,
  dropColumn: (tableName, columnName) =>
    `ALTER TABLE ${tableName}\n  DROP COLUMN ${quoteIdentifier(columnName)};`,
  alterColumn: (tableName, columnName, sourceColumn, _targetColumn, changes) => {
    const column = quoteIdentifier(columnName);
    const ddl: string[] = [];

    if (changes.typeChanged) {
      ddl.push(
        '-- Revise antes de executar: alteração de tipo pode exigir conversão manual.',
        `ALTER TABLE ${tableName}\n  ALTER COLUMN ${column} TYPE ${makeColumnType(sourceColumn)};`,
      );
    }

    if (changes.nullableChanged) {
      ddl.push(
        sourceColumn.is_nullable === false
          ? `ALTER TABLE ${tableName}\n  ALTER COLUMN ${column} SET NOT NULL;`
          : `ALTER TABLE ${tableName}\n  ALTER COLUMN ${column} DROP NOT NULL;`,
      );
    }

    if (changes.defaultChanged) {
      ddl.push(
        sourceColumn.column_default
          ? `ALTER TABLE ${tableName}\n  ALTER COLUMN ${column} SET DEFAULT ${sourceColumn.column_default};`
          : `ALTER TABLE ${tableName}\n  ALTER COLUMN ${column} DROP DEFAULT;`,
      );
    }

    return ddl;
  },
  addConstraint: (tableName, row) =>
    `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdentifier(row.constraint_name)} ${
      row.constraint_definition || row.expression || ''
    };`,
  dropConstraint: (tableName, row) =>
    `ALTER TABLE ${tableName}\n  DROP CONSTRAINT ${quoteIdentifier(row.constraint_name)};`,
  addForeignKey: (tableName, row, definition) =>
    `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdentifier(row.constraint_name)} ${definition};`,
  dropForeignKey: (tableName, row) =>
    `ALTER TABLE ${tableName}\n  DROP CONSTRAINT ${quoteIdentifier(row.constraint_name)};`,
  createIndex: (_tableName, row) => pushSemicolon(row.index_definition || ''),
  dropIndex: (_tableName, schema, row) =>
    `DROP INDEX ${qualifiedName(quoteIdentifier, schema, row.index_name)};`,
  dropTrigger: (tableName, row) =>
    `DROP TRIGGER ${quoteIdentifier(row.trigger_name)} ON ${tableName};`,
  dropRule: (tableName, row) => `DROP RULE ${quoteIdentifier(row.rule_name)} ON ${tableName};`,
  dropFunction: (schema, name, identityArguments, cascade) =>
    `DROP FUNCTION ${qualifiedName(quoteIdentifier, schema, name)}(${identityArguments || ''})${
      cascade ? ' CASCADE' : ''
    };`,
  dropSequence: (schema, name, cascade) =>
    `DROP SEQUENCE ${qualifiedName(quoteIdentifier, schema, name)}${cascade ? ' CASCADE' : ''};`,
});
