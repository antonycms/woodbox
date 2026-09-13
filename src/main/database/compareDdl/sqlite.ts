import type { CompareDdlBuilder } from './types';
import { makeColumnDefinition, makeColumnType, pushSemicolon, qualifiedName, unsupportedDdl } from './utils';

export const createSqliteCompareDdlBuilder = (
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
  alterColumn: () => [
    unsupportedDdl('SQLite exige recriar a tabela para alterar tipo, nulabilidade ou default de coluna.'),
  ],
  addConstraint: () =>
    unsupportedDdl('SQLite exige recriar a tabela para adicionar constraints de tabela.'),
  dropConstraint: () =>
    unsupportedDdl('SQLite exige recriar a tabela para remover constraints de tabela.'),
  addForeignKey: () =>
    unsupportedDdl('SQLite exige recriar a tabela para adicionar chaves estrangeiras.'),
  dropForeignKey: () =>
    unsupportedDdl('SQLite exige recriar a tabela para remover chaves estrangeiras.'),
  createIndex: (tableName, row) =>
    pushSemicolon(row.index_definition || `CREATE INDEX ${quoteIdentifier(row.index_name)} ON ${tableName} ();`),
  dropIndex: (_tableName, schema, row) =>
    `DROP INDEX ${qualifiedName(quoteIdentifier, schema, row.index_name)};`,
  dropTrigger: (_tableName, row) => `DROP TRIGGER ${quoteIdentifier(row.trigger_name)};`,
  dropRule: () => unsupportedDdl('SQLite não possui RULE equivalente para este objeto.'),
  dropFunction: () => unsupportedDdl('SQLite não possui função armazenada equivalente para este objeto.'),
  dropSequence: () => unsupportedDdl('SQLite não possui sequência independente equivalente para este objeto.'),
});
