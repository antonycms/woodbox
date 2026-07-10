import knex, { Knex } from 'knex';
import { getDialectAdapter, getDialectIds } from './dialects';
import { getConnectionsSaved } from '@main/storage/store';
import { emitEvent } from '@main/utils/emitEvent';

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
  const instance = await makeConnectionInstance(config, true);
  await instance.destroy();
};

const makeConnection = async (connectionId: string) => {
  const config = await getConnectionsSaved(connectionId);

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

export const runSql = async (
  connectionId: string,
  sql: string,
  options?: { page?: number; limit?: number; orderBy?: IOrderBy[]; queryExecutionId?: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);

  let sql_final = sql.trim();

  // Cria uma versão normalizada pra fazer verificacoes
  const normalized = sql_final.replace(/\s+/g, ' ').toLowerCase();

  const isSelectQuery = normalized.startsWith('select') || normalized.startsWith('with');
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

    for (const statement of statements) {
      results.push({ raw: await instance.raw(statement).connection(dbConnection), statement });
    }

    const execution_time_ms = Date.now() - t0;

    return results.flatMap(({ raw, statement }) =>
      adapter.serializeRunSqlResult(raw, { auto_paginated, execution_time_ms, statement }),
    );
  } finally {
    if (options?.queryExecutionId) activeRunSqlQueries.delete(options.queryExecutionId);
    await (instance.client as any).releaseConnection(dbConnection);
  }
};

interface IOrderBy {
  columnName: string;
  sortType: 'DESC' | 'ASC';
}

const serializeOrderBy = (
  orderBy: IOrderBy[] | undefined,
  quoteIdentifier: (value: string) => string,
) => {
  if (!orderBy?.length) return '';

  const columns = orderBy.map(({ columnName, sortType }) => {
    const safeSortType = sortType === 'DESC' ? 'DESC' : 'ASC';

    return `${quoteIdentifier(columnName)} ${safeSortType}`;
  });

  return `ORDER BY ${columns.join(', ')}`;
};
