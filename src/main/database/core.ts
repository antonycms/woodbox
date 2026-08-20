import knex, { Knex } from 'knex';
import { getInternalConnectionSaved } from '@main/storage/store';
import { emitEvent } from '@main/utils/emitEvent';
import { getDialectAdapter, getDialectIds } from './dialects';
import { serializeOrderBy, type IOrderBy } from './utils/orderBy';
import {
  hasSqlStatementSeparator,
  isReadOnlySelectQuery,
  normalizeSqlForKeywordSearch,
  sanitizeAutoPaginatedError,
} from './utils/sql';

const activeConnections: IConnection[] = [];
const pendingConnections = new Map<string, Promise<IConnection>>();
const activeRunSqlQueries = new Map<
  string,
  { connectionId: string; instance: Knex; dbConnection: any; dialect: Dialect }
>();
const serverOutputByConnection = new Map<string, IServerOutputMessage[]>();
const MAX_SERVER_OUTPUT_MESSAGES = 1000;

interface IServerOutputMessage {
  id: string;
  connectionId: string;
  date: string;
  severity?: string;
  message: string;
  detail?: string;
  hint?: string;
  where?: string;
}

const addServerOutput = (connectionId: string, notice: any) => {
  if (!connectionId) return;

  const message: IServerOutputMessage = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    connectionId,
    date: new Date().toISOString(),
    severity: notice.severity,
    message: notice.message,
    detail: notice.detail,
    hint: notice.hint,
    where: notice.where,
  };

  const messages = serverOutputByConnection.get(connectionId) || [];
  const nextMessages = [...messages, message].slice(-MAX_SERVER_OUTPUT_MESSAGES);

  serverOutputByConnection.set(connectionId, nextMessages);

  emitEvent('@event:server_output', message);
};

export const getServerOutput = async (connectionId: string) => {
  return serverOutputByConnection.get(connectionId) || [];
};

export const clearServerOutput = async (connectionId: string) => {
  serverOutputByConnection.delete(connectionId);
};

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

export const closeAllConnections = async () => {
  await Promise.allSettled(pendingConnections.values());
  await Promise.all(activeConnections.map((connection) => connection?.instance?.destroy?.()));
};

const makeConnectionInstance = async (config: IConnectionConfig, noPool?: boolean) => {
  const { id, dialect } = config;
  const adapter = getDialectAdapter(dialect);

  let instance: null | Knex<any, unknown[]>;

  const pool = noPool
    ? undefined
    : {
        min: 0,
        max: 6,
        createTimeoutMillis: 3000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
        afterCreate: (connection, done) => {
          connection.on?.('notice', (notice) => addServerOutput(id, notice));
          done(null, connection);
        },
      };

  instance = knex({
    pool,
    debug: process.env.NODE_ENV === 'development',
    client: adapter.client,
    connection: adapter.getConnectionConfig(config),
    ...adapter.getKnexConfig?.(config),
  });

  const errorsHandled = {
    authentication: {
      errors: ['authentication failed'],
      message: 'Erro de autenticação, verifique as credenciais da conexão',
    },
  };

  const getError = (error: Error) => {
    let serializedError = error;

    if (!serializedError?.message) {
      return new Error('Ocorreu um erro desconhecido.');
    }

    Object.keys(errorsHandled).some((key) => {
      const { message, errors = [] } = errorsHandled[key];

      const checkErrorMessage = errors.some((textError) => error.message.includes(textError));

      if (checkErrorMessage) {
        serializedError = new Error(message);
        return true;
      }

      return false;
    });

    return serializedError;
  };

  try {
    await instance.raw('SELECT 1');
  } catch (error: any) {
    instance.destroy();
    instance = null;

    const serializedError = getError(error);
    throw serializedError;
  }

  return instance;
};

export const getDialects = () => getDialectIds();

export const testConnection = async (config: IConnectionConfig) => {
  const storedConfig =
    config.id && !config.password ? getInternalConnectionSaved(config.id) : undefined;
  const instance = await makeConnectionInstance(
    { ...storedConfig, ...config, password: config.password || storedConfig?.password },
    true,
  );
  await instance.destroy();
};

const makeConnection = async (connectionId: string) => {
  const config = await getInternalConnectionSaved(connectionId);

  if (!config) {
    throw new Error(`Connection config is not found. (${connectionId})`);
  }

  const { id, dialect } = config;

  const instance = await makeConnectionInstance(config);

  const connection: IConnection = {
    id,
    instance,
    dialect,
  };

  activeConnections.push(connection);

  return connection;
};

export const closeConnection = async (connectionId: string) => {
  const pendingConnection = pendingConnections.get(connectionId);

  if (pendingConnection) {
    try {
      await pendingConnection;
    } catch (error) {
      console.error(error);
    }
  }

  const connections = activeConnections.filter((connection) => connection.id === connectionId);

  serverOutputByConnection.delete(connectionId);

  if (!connections.length) return;

  await Promise.all(
    connections.map(async (connection) => {
      try {
        await connection.instance.destroy();
      } catch (error) {
        console.error(error);
      } finally {
        const index = activeConnections.indexOf(connection);

        if (index >= 0) activeConnections.splice(index, 1);
      }
    }),
  );
};

const getConnection = async (connectionId: string) => {
  const connectionAlreadyStarted = activeConnections.find(
    (connection) => connection.id === connectionId,
  );

  if (connectionAlreadyStarted) {
    return connectionAlreadyStarted;
  }

  const pendingConnection = pendingConnections.get(connectionId);

  if (pendingConnection) {
    return await pendingConnection;
  }

  const connectionPromise = makeConnection(connectionId);
  pendingConnections.set(connectionId, connectionPromise);

  try {
    return await connectionPromise;
  } finally {
    pendingConnections.delete(connectionId);
  }
};

/**
 * return schemas(postgres only) and tables.
 */
export const getConnectionInfo = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const adapter = getDialectAdapter(connection.dialect);
  const query = adapter.queries;

  const { instance } = connection;

  const [tablesRaw, schemasRaw, functionsRaw] = await Promise.all([
    instance.raw(query.getTables()),
    query.getAllSchemas ? instance.raw(query.getAllSchemas()) : undefined,
    query.getFunctions ? instance.raw(query.getFunctions()) : undefined,
  ]);

  const tables = adapter.getRows(tablesRaw);
  const schemas = schemasRaw
    ? adapter.getRows(schemasRaw).map((row) => row?.schema_name)
    : undefined;
  const functions = functionsRaw ? adapter.getRows(functionsRaw) : [];

  return { tables, schemas, functions };
};

export const getTableColumns = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableColumns({ table, schema }));

  return adapter.getRows(raw);
};

export const getColumnTypes = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getColumnTypes());

  return adapter.getRows(raw);
};

export const getTableReferences = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableReferences({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableUsedAsReference = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableUsedAsReference({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableRestrictions = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableRestrictions({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableDefinition = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableDefinition({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableIndexes = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableIndexes({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableTriggers = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableTriggers({ table, schema }));

  return adapter.getRows(raw);
};

export const getFunctionDefinition = async (
  connectionId: string,
  { schema, functionName }: { schema: string; functionName: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  if (!query.getFunctionDefinition) return [];

  const raw = await instance.raw(query.getFunctionDefinition({ schema, functionName }));

  return adapter.getRows(raw);
};

/**
 * return table rows with pagination.
 */
export const getTableData = async (
  connectionId: string,
  {
    table,
    schema,
    page = 1,
    limit = 200,
    where,
    orderBy,
  }: {
    table: string;
    schema: string;
    page?: number;
    limit?: number;
    where?: string;
    orderBy?: IOrderBy[];
  },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const dataRaw = await instance.raw(
    query.selectWithOffset({ table, schema, actualPage: page, limit, where, orderBy }),
  );

  return { data: adapter.getRows(dataRaw) };
};

export const getTableRowsCount = async (
  connectionId: string,
  { table, schema, where }: { table: string; schema?: string; where?: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTotalRowsCountInTable({ table, schema, where }));
  const [row] = adapter.getRows(raw);

  return Number(row?.total_rows ?? 0);
};

export const getQueryRowsCount = async (connectionId: string, sql: string) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const sqlFinal = sql.trim().replace(/;+\s*$/, '');
  if (!isReadOnlySelectQuery(sqlFinal)) {
    throw new Error('A contagem só está disponível para consultas SELECT.');
  }

  const raw = await instance.raw(`
    SELECT count(*) AS total_rows
    FROM (${sqlFinal}) AS __count_query;
  `);
  const [row] = adapter.getRows(raw);

  return Number(row?.total_rows ?? 0);
};

export const runSql = async (
  connectionId: string,
  sql: string,
  options?: { page?: number; limit?: number; orderBy?: IOrderBy[]; queryExecutionId?: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);

  const sql_original = sql.trim();
  let sql_final = sql_original;

  const isSelectQuery = isReadOnlySelectQuery(sql_final);
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

  const dbConnection = await (instance.client as any).acquireConnection();

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
    const results: { raw: any; statement: string }[] = [];

    try {
      for (const statement of statements) {
        results.push({ raw: await instance.raw(statement).connection(dbConnection), statement });
      }
    } catch (error) {
      if (auto_paginated) throw sanitizeAutoPaginatedError(error, sql_final, sql_original);
      throw error;
    }

    const execution_time_ms = Date.now() - t0;

    const serializedResults = results.flatMap(({ raw, statement }) =>
      adapter.serializeRunSqlResult(raw, { auto_paginated, execution_time_ms, statement }),
    );

    if (!adapter.resolveRunSqlColumnsInfo) return serializedResults;

    try {
      return await adapter.resolveRunSqlColumnsInfo({
        instance,
        dbConnection,
        sql: sql_original,
        results: serializedResults,
      });
    } catch {
      return serializedResults;
    }
  } finally {
    if (options?.queryExecutionId) activeRunSqlQueries.delete(options.queryExecutionId);
    await (instance.client as any).releaseConnection(dbConnection);
  }
};

export const runExplainSql = async (
  connectionId: string,
  sql: string,
  options?: { queryExecutionId?: string },
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

  return runSql(connectionId, adapter.getExplainSql(sqlFinal), options);
};

export const importTableData = async (
  connectionId: string,
  { schema, table, rows }: IImportTableDataParams,
): Promise<IImportTableDataResult> => {
  if (!table) throw new Error('Tabela não informada.');

  const rowsToImport = rows.filter((row) => Object.keys(row).length);
  if (!rowsToImport.length) return { insertedRows: 0 };

  const connection = await getConnection(connectionId);
  const { instance } = connection;
  const chunkSize = 500;
  let insertedRows = 0;

  await instance.transaction(async (trx) => {
    for (let index = 0; index < rowsToImport.length; index += chunkSize) {
      const chunk = rowsToImport.slice(index, index + chunkSize);
      const query = schema ? trx.withSchema(schema).table(table) : trx.table(table);

      await query.insert(chunk);
      insertedRows += chunk.length;
    }
  });

  return { insertedRows };
};
