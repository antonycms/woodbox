import knex, { Knex } from 'knex';
import clientsQuery from './querys';
import { getConnectionsSaved } from '../storage/store';

const activeConnections: IConnection[] = [];

export const closeAllConnections = async () => {
  await Promise.all(activeConnections.map((connection) => connection?.instance?.destroy?.()));
};

const makeConnectionInstance = async (config: IConnectionConfig) => {
  const { dialect, database, host, port, username: user, password } = config;

  let instance: null | Knex<any, unknown[]>;

  instance = knex({
    debug: process.env.NODE_ENV === 'development',
    client: dialect,
    connection: {
      host,
      port,
      user,
      password,
      database,
    },
    pool: {
      min: 0,
      max: 6,
      createTimeoutMillis: 3000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
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

export const testConnection = async (config: IConnectionConfig) => {
  const instance = await makeConnectionInstance(config);
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
  }

  // eslint-disable-next-line prefer-const
  let [tables, schemas] = (await Promise.all(promises)).map((raw) => raw?.rows || []);

  schemas = schemas?.map?.((row) => row?.schema_name);

  return { tables, schemas };
};

export const getTableColumns = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableColumns({ table, schema }));

  return raw?.rows || [];
};

export const getTableReferences = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableReferences({ table, schema }));

  return raw?.rows || [];
};

export const getTableRestrictions = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const raw = await instance.raw(query.getTableRestrictions({ table, schema }));

  return raw?.rows || [];
};

/**
 * return table rows with pagination.
 */
export const getTableData = async (
  connectionId: string,
  { table, schema, page = 1, limit = 200 },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const query = clientsQuery[dialect];

  const [count, data] = (
    await Promise.all([
      instance.raw(query.getTotalRowsCountInTable({ table, schema })),
      instance.raw(query.selectWithOffset({ table, schema, actualPage: page, limit })),
    ])
  ).map((raw) => raw?.rows || []);

  return { count, data };
};

export const runSql = async (connectionId: string, sql) => {
  const connection = await getConnection(connectionId);
  const { instance } = connection;

  const data = await instance.raw(sql);

  console.log('>>', data);

  return data?.rows || [];
};
