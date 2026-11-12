import type { Knex } from 'knex';
import type { Dialect } from '@shared/types/connections';
import { prepareUserSqlStatement } from '../utils/sql';

export const executeStatements = async (
  instance: Knex,
  dbConnection: object,
  dialect: Dialect,
  statements: string[],
) => {
  const results: { raw: unknown; statement: string }[] = [];
  for (const statement of statements) {
    results.push({
      raw: await instance.raw(prepareUserSqlStatement(dialect, statement)).connection(dbConnection),
      statement,
    });
  }
  return results;
};
