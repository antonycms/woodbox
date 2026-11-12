import type { DatabaseObjectCommand } from '@shared/types/database';
import { getDialectCapabilities } from './dialects';
import type { DatabaseDialectAdapter } from './types';

export const buildObjectCommandSql = (
  adapter: DatabaseDialectAdapter,
  command: DatabaseObjectCommand,
): string => {
  const quote = adapter.quoteIdentifier;

  switch (command.type) {
    case 'create-schema':
    case 'rename-schema':
    case 'drop-schema': {
      if (!getDialectCapabilities(adapter).supports_schemas) {
        throw new Error('Esta conexão não oferece suporte a comandos de schema.');
      }
      const schema = quote(command.schema);
      if (command.type === 'create-schema') return `CREATE SCHEMA ${schema};`;
      if (command.type === 'rename-schema') return `ALTER SCHEMA ${schema} RENAME TO ${quote(command.newName)};`;
      return `DROP SCHEMA ${schema}${command.cascade ? ' CASCADE' : ''};`;
    }
    case 'rename-table':
    case 'drop-table': {
      const table = command.schema ? `${quote(command.schema)}.${quote(command.table)}` : quote(command.table);
      if (command.type === 'rename-table') return `ALTER TABLE ${table} RENAME TO ${quote(command.newName)};`;
      return `DROP TABLE ${table};`;
    }
  }
};
