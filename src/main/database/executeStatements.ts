import type { Knex } from 'knex';
import type { Dialect } from '@shared/types/connections';
import type { IOptionsRunSql } from '@shared/types/database';
import type { DatabaseDialectAdapter } from './types';
import { prepareUserSqlStatement } from './utils/sql';

export const executeStatements = async (
  instance: Knex,
  dbConnection: object,
  adapter: DatabaseDialectAdapter,
  dialect: Dialect,
  statements: string[],
  target?: IOptionsRunSql['rowChangesTransaction'],
) => {
  const results: { raw: unknown; statement: string }[] = [];
  const execute = async (executor: Knex | Knex.Transaction) => {
    for (const statement of statements) {
      results.push({
        raw: await executor.raw(prepareUserSqlStatement(dialect, statement)).connection(dbConnection),
        statement,
      });
    }
  };

  if (target) {
    // Reuse the acquired connection: acquiring another one deadlocks pools of size 1.
    await instance.transaction(async (trx) => {
      await adapter.validateQueryUpdateTable?.(trx, target);
      await execute(trx);
    }, { connection: dbConnection });
  } else {
    await execute(instance);
  }
  return results;
};
