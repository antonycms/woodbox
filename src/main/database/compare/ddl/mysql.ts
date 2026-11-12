import type { CompareDdlBuilder } from './types';
import { makeColumnDefinition, makeColumnType, pushSemicolon, qualifiedName, unsupportedDdl } from './utils';

export const createMysqlCompareDdlBuilder = (
  quoteIdentifier: (value: string) => string,
): CompareDdlBuilder => ({
  quoteIdentifier,
  qualifiedName: (schema, name) => qualifiedName(quoteIdentifier, schema, name),
  makeColumnType,
  makeColumnDefinition: (column) => makeColumnDefinition(quoteIdentifier, column),
  dropObject: (type, schema, name) => {
    const sqlType = type === 'view' ? 'VIEW' : 'TABLE';
    return `DROP ${sqlType} IF EXISTS ${qualifiedName(quoteIdentifier, schema, name)};`;
  },
  addColumn: (tableName, column) =>
    `ALTER TABLE ${tableName}\n  ADD COLUMN ${makeColumnDefinition(quoteIdentifier, column)};`,
  dropColumn: (tableName, columnName) =>
    `ALTER TABLE ${tableName}\n  DROP COLUMN ${quoteIdentifier(columnName)};`,
  alterColumn: (tableName, _columnName, sourceColumn) => [
    `ALTER TABLE ${tableName}\n  MODIFY COLUMN ${makeColumnDefinition(quoteIdentifier, sourceColumn)};`,
  ],
  addConstraint: (tableName, row) =>
    `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdentifier(row.constraint_name)} ${
      row.constraint_definition || row.expression || ''
    };`,
  dropConstraint: (tableName, row) => {
    if (row.constraint_type === 'primary_key') return `ALTER TABLE ${tableName}\n  DROP PRIMARY KEY;`;
    if (row.constraint_type === 'unique_key') {
      return `ALTER TABLE ${tableName}\n  DROP INDEX ${quoteIdentifier(row.constraint_name)};`;
    }
    if (row.constraint_type === 'check') {
      return `ALTER TABLE ${tableName}\n  DROP CHECK ${quoteIdentifier(row.constraint_name)};`;
    }

    return unsupportedDdl('MySQL não suporta alterar este tipo de constraint automaticamente.');
  },
  addForeignKey: (tableName, row, definition) =>
    `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdentifier(row.constraint_name)} ${definition};`,
  dropForeignKey: (tableName, row) =>
    `ALTER TABLE ${tableName}\n  DROP FOREIGN KEY ${quoteIdentifier(row.constraint_name)};`,
  createIndex: (tableName, row) =>
    pushSemicolon(row.index_definition || `CREATE INDEX ${quoteIdentifier(row.index_name)} ON ${tableName} ();`),
  dropIndex: (tableName, _schema, row) =>
    `DROP INDEX ${quoteIdentifier(row.index_name)} ON ${tableName};`,
  dropTrigger: (_tableName, row) => `DROP TRIGGER ${quoteIdentifier(row.trigger_name)};`,
  dropRule: () => unsupportedDdl('MySQL não possui RULE equivalente para este objeto.'),
  dropFunction: (schema, name) =>
    `DROP FUNCTION IF EXISTS ${qualifiedName(quoteIdentifier, schema, name)};`,
  dropSequence: (schema, name) =>
    `DROP SEQUENCE IF EXISTS ${qualifiedName(quoteIdentifier, schema, name)};`,
});
