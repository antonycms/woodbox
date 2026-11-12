import type { Knex } from 'knex';
import type { DatabaseObjectCommand, IOptionsRunSql } from '@shared/types/database';
import type { Dialect } from '@shared/types/connections';
import type { IConnection } from '../types';
import { getConnection } from '../connections';
import { getDialectAdapter } from '../dialects';
import { serializeOrderBy } from '../utils/orderBy';
import { restrictQueryColumnSources } from '../utils/querySources';
import { buildObjectCommandSql } from '../structure/objectCommands';
import {
  hasSqlStatementSeparator,
  isReadOnlySelectQuery,
  normalizeSqlForKeywordSearch,
  sanitizeAutoPaginatedError,
} from '../utils/sql';
import { executeStatements } from './executeStatements';
import { analyzeExplainResult } from './explain';

const activeRunSqlQueries = new Map<
  string,
  { connectionId: string; instance: Knex; dbConnection: object; dialect: Dialect }
>();

export const cancelRunSql = async (connectionId: string, queryExecutionId: string) => {
  const activeQuery = activeRunSqlQueries.get(queryExecutionId);

  if (!activeQuery || activeQuery.connectionId !== connectionId) return false;

  const adapter = getDialectAdapter(activeQuery.dialect);

  if (!adapter.cancelQuery) return false;

  return adapter.cancelQuery({
    instance: activeQuery.instance,
    dbConnection: activeQuery.dbConnection,
  });
};

export const runSql = async (
  connectionId: string,
  sql: string,
  options?: IOptionsRunSql,
) => runSqlOnConnection(await getConnection(connectionId), sql, options);

const runSqlOnConnection = async (
  connection: IConnection,
  sql: string,
  options?: IOptionsRunSql,
) => {
  const { id: connectionId, instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);

  const sql_original = sql.trim();
  let sql_final = sql_original;

  const isSelectQuery = isReadOnlySelectQuery(sql_final) &&
    !hasSqlStatementSeparator(sql_final.replace(/;+\s*$/, ''));
  const normalized = normalizeSqlForKeywordSearch(sql_final);
  let auto_paginated = false;

  // adiciona limit e offset em consultas SELECT para realizar paginacao.
  if (isSelectQuery) {
    const hasLimit = /\blimit\b/.test(normalized);
    const hasOffset = /\boffset\b/.test(normalized);

    const limit = options?.limit ?? 200;
    const page = options?.page ?? 1;

    if (sql_final.endsWith(';')) sql_final = sql_final.slice(0, -1);

    if (!hasLimit && !hasOffset && Number(limit) > 0 && Number(page) >= 0) {
      auto_paginated = true;
      const orderByQuery = serializeOrderBy(options?.orderBy, adapter.quoteIdentifier);

      sql_final = `
        SELECT *
        FROM (${sql_final}) AS __base_query
        ${orderByQuery}
        LIMIT ${limit} OFFSET ${(page - 1) * limit};
      `;
    }
  }

  const dbConnection = await instance.client.acquireConnection();

  try {
    if (options?.queryExecutionId) {
      activeRunSqlQueries.set(options.queryExecutionId, {
        connectionId,
        instance,
        dbConnection,
        dialect,
      });
    }

    const t0 = Date.now();
    const statements =
      !isSelectQuery && adapter.splitStatements ? adapter.splitStatements(sql_final) : [sql_final];
    let results: { raw: unknown; statement: string }[];

    try {
      results = await executeStatements(instance, dbConnection, dialect, statements);
    } catch (error) {
      if (auto_paginated) throw sanitizeAutoPaginatedError(error, sql_final, sql_original);
      throw error;
    }

    const execution_time_ms = Date.now() - t0;

    let serializedResults = results.flatMap(({ raw, statement }) =>
      adapter.serializeRunSqlResult(raw, { auto_paginated, execution_time_ms, statement }),
    );

    if (adapter.resolveRunSqlColumnsInfo) {
      try {
        serializedResults = await adapter.resolveRunSqlColumnsInfo({
          instance,
          dbConnection,
          sql: sql_original,
          results: serializedResults,
          columnTypes: options?.columnTypes,
        });
      } catch {
        // Metadata failures must never enable editing through inferred origins.
      }
    }
    return serializedResults.map((result) => restrictQueryColumnSources(sql_original, result, adapter.queryIdentifierRules));
  } finally {
    if (options?.queryExecutionId) activeRunSqlQueries.delete(options.queryExecutionId);
    await instance.client.releaseConnection(dbConnection);
  }
};

export const executeObjectCommand = async (connectionId: string, command: DatabaseObjectCommand): Promise<void> => {
  const connection = await getConnection(connectionId);
  const sql = buildObjectCommandSql(getDialectAdapter(connection.dialect), command);
  await runSqlOnConnection(connection, sql);
};

export const runExplainSql = async (
  connectionId: string,
  sql: string,
  options?: Pick<IOptionsRunSql, 'queryExecutionId'>,
) => {
  const connection = await getConnection(connectionId);
  const adapter = getDialectAdapter(connection.dialect);
  const sqlFinal = sql.trim().replace(/;+\s*$/, '');

  if (!isReadOnlySelectQuery(sqlFinal)) {
    throw new Error('EXPLAIN só está disponível para consultas SELECT.');
  }

  if (hasSqlStatementSeparator(sqlFinal)) {
    throw new Error('EXPLAIN analisa uma instrução SQL por vez.');
  }

  const results = await runSql(connectionId, adapter.getExplainSql(sqlFinal), options);
  return results.map((result) => ({ ...result, explainAnalysis: analyzeExplainResult(connection.dialect, result) }));
};
