import { createMysqlCompareDdlBuilder } from './mysql';
import { createPostgresCompareDdlBuilder } from './postgres';
import { createSqliteCompareDdlBuilder } from './sqlite';
import type { CompareDdlBuilder } from './types';

export type * from './types';

export const getCompareDdlBuilder = (
  dialect: Dialect,
  quoteIdentifier: (value: string) => string,
): CompareDdlBuilder => {
  if (dialect === 'mysql') return createMysqlCompareDdlBuilder(quoteIdentifier);
  if (dialect === 'sqlite' || dialect === 'react-native-sqlite') {
    return createSqliteCompareDdlBuilder(quoteIdentifier);
  }

  return createPostgresCompareDdlBuilder(quoteIdentifier);
};
