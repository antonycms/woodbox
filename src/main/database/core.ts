import knex, { Knex } from 'knex';
import pg from 'pg';
import clientsQuery from './querys';
import { getConnectionsSaved } from '../storage/store';
import { emitEvent } from '../utils/emitEvent';

// Override 'pg' default parser to return dates as strings
pg.types.setTypeParser(1114, (val) => val); // timestamp without time zone
pg.types.setTypeParser(1184, (val) => val); // timestamp with time zone

const activeConnections: IConnection[] = [];
const activeRunSqlQueries = new Map<
  string,
  { connectionId: string; instance: Knex; dbConnection: any }
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

  await (activeQuery.instance.client as any).cancelQuery(activeQuery.dbConnection);

  return true;
};

export const closeAllConnections = async () => {
  await Promise.all(activeConnections.map((connection) => connection?.instance?.destroy?.()));
};

const makeConnectionInstance = async (config: IConnectionConfig, noPool?: boolean) => {
  const { id, description, dialect, database, host, port, username: user, password } = config;

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
    client: dialect,
    connection: {
      host,
      port,
      user,
      password,
      database,
      dateStrings: true,
      application_name: `Woodbox (${description})`,
    },
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

export const getDialects = () => {
  const dialects: Dialect[] = ['postgres'];

  return dialects;
};

export const testConnection = async (config: IConnectionConfig) => {
  const instance = await makeConnectionInstance(config, true);
  await instance.destroy();
};

const getConnection = async (connectionId: string) => {
  const connectionAlreadyStarted = activeConnections.find(
    (connection) => connection.id === connectionId,
  );

  if (connectionAlreadyStarted) {
    return connectionAlreadyStarted;
  }

  const config: IConnectionConfig = await getConnectionsSaved(connectionId);

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
  const index = activeConnections.findIndex((connection) => connection.id === connectionId);
  const connection = activeConnections[index];

  serverOutputByConnection.delete(connectionId);

  if (!connection) return;

  try {
    await connection.instance.destroy();
  } catch (error) {
    console.error(error);
  } finally {
    activeConnections.splice(index, 1);
  }
};

/**
 * return schemas(postgres only) and tables.
 */
export const getConnectionInfo = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const query = clientsQuery[connection.dialect];

  const { instance, dialect } = connection;

  const promises = [instance.raw(query.getTables())];

  if (dialect === 'postgres') {
    promises.push(instance.raw(query.getAllSchemas()));
    promises.push(instance.raw(query.getFunctions()));
  }

  // eslint-disable-next-line prefer-const
  let [tables, schemas, functions] = (await Promise.all(promises)).map((raw) => raw?.rows || []);

  schemas = schemas?.map?.((row) => row?.schema_name);

  return { tables, schemas, functions };
};

export const getTableColumns = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableColumns({ table, schema }));

  return raw?.rows || [];
};

export const getColumnTypes = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getColumnTypes());

  return raw?.rows || [];
};

export const getTableReferences = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableReferences({ table, schema }));

  return raw?.rows || [];
};

export const getTableUsedAsReference = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableUsedAsReference({ table, schema }));

  return raw?.rows || [];
};

export const getTableRestrictions = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableRestrictions({ table, schema }));

  return raw?.rows || [];
};

export const getTableDefinition = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableDefinition({ table, schema }));

  return raw?.rows || [];
};

export const getTableIndexes = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableIndexes({ table, schema }));

  return raw?.rows || [];
};

export const getTableTriggers = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableTriggers({ table, schema }));

  return raw?.rows || [];
};

export const getFunctionDefinition = async (
  connectionId: string,
  { schema, functionName }: { schema: string; functionName: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getFunctionDefinition({ schema, functionName }));

  return raw?.rows || [];
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

  const query = clientsQuery[dialect];

  const [count, data] = (
    await Promise.all([
      instance.raw(query.getTotalRowsCountInTable({ table, schema, where })),
      instance.raw(
        query.selectWithOffset({ table, schema, actualPage: page, limit, where, orderBy }),
      ),
    ])
  ).map((raw) => raw?.rows || []);

  return { count, data };
};

export const runSql = async (
  connectionId: string,
  sql: string,
  options?: { page?: number; limit?: number; orderBy?: IOrderBy[]; queryExecutionId?: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance } = connection;

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
      const orderByQuery = serializeOrderBy(options?.orderBy);

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
      });
    }

    const t0 = Date.now();
    const raw = await instance.raw(sql_final).connection(dbConnection);
    const execution_time_ms = Date.now() - t0;

    const rawArray = Array.isArray(raw) ? raw : [raw];

    const serializedData = rawArray.map((rawResult) => {
      const { command: type, fields: columns, rowCount: affected_rows, rows = [] } = rawResult;

      return {
        type,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        rows: JSON.parse(JSON.stringify(rows)),
        columns: columns?.map?.((field) => field.name) || [],
      };
    });

    return serializedData;
  } finally {
    if (options?.queryExecutionId) activeRunSqlQueries.delete(options.queryExecutionId);
    await (instance.client as any).releaseConnection(dbConnection);
  }
};

interface IOrderBy {
  columnName: string;
  sortType: 'DESC' | 'ASC';
}

const serializeOrderBy = (orderBy?: IOrderBy[]) => {
  if (!orderBy?.length) return '';

  const columns = orderBy.map(({ columnName, sortType }) => {
    const safeColumnName = columnName.replace(/"/g, '""');
    const safeSortType = sortType === 'DESC' ? 'DESC' : 'ASC';

    return `"${safeColumnName}" ${safeSortType}`;
  });

  return `ORDER BY ${columns.join(', ')}`;
};
