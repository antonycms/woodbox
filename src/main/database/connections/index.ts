import { getErrorMessage } from '@shared/utils/error';
import { connect as connectSocket, isIP } from 'node:net';
import { checkServerIdentity } from 'node:tls';
import knex, { Knex } from 'knex';
import { getInternalConnectionSaved } from '../../storage/store';
import { emitEvent } from '../../utils/emitEvent';
import {
  releaseReactNativeBridgeGateway,
  retainReactNativeBridgeGateway,
} from '../../reactNativeBridge/gateway';
import { getDialectAdapter } from '../dialects';
import type { DatabaseRow, IServerOutputMessage } from '@shared/types/database';
import type { IConnectionConfig, IConnectionTest } from '@shared/types/connections';
import type { IConnection } from '../types';
import { getSslConfig } from './ssl';
import { openSshTunnel, type SshTunnel } from './ssh';
import { verifySshHost } from './sshHostVerification';
import { mergeSshCredentials } from '../../storage/modules/ssh_credentials';
import {
  getReactNativeBridgeConnectionSource,
  getReactNativeBridgeGatewayOptions,
  getReactNativeBridgeTestSource,
  isReactNativeBridgeDialect,
} from '../utils/reactNativeBridge';

const activeConnections: IConnection[] = [];
const connectionTunnels = new WeakMap<Knex, SshTunnel>();
const destroyConnectionInstance = async (instance: Knex) => {
  try {
    await instance.destroy();
  } finally {
    await connectionTunnels.get(instance)?.close();
    connectionTunnels.delete(instance);
  }
};
const pendingConnections = new Map<string, Promise<IConnection>>();
const serverOutputByConnection = new Map<string, IServerOutputMessage[]>();
const MAX_SERVER_OUTPUT_MESSAGES = 1000;

const addServerOutput = (connectionId: string, notice: Pick<IServerOutputMessage, 'severity' | 'message' | 'detail' | 'hint' | 'where'>) => {
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

export const closeAllConnections = async () => {
  await Promise.allSettled(pendingConnections.values());
  await Promise.all(
    activeConnections.map(async (connection) => {
      try {
        if (connection?.instance) await destroyConnectionInstance(connection.instance);
      } finally {
        if (isReactNativeBridgeDialect(connection.dialect)) {
          await releaseReactNativeBridgeGateway(getReactNativeBridgeConnectionSource(connection.id));
        }
      }
    }),
  );
  activeConnections.splice(0);
};

const makeConnectionInstance = async (config: IConnectionConfig, noPool?: boolean) => {
  const { id, dialect } = config;
  const adapter = getDialectAdapter(dialect);
  const connectionConfig = adapter.getConnectionConfig(config);
  const sslConfig = getSslConfig(config);
  if (config.ssh?.enabled && dialect !== 'postgres' && dialect !== 'mysql') {
    throw new Error('Túnel SSH disponível apenas para PostgreSQL e MySQL.');
  }
  const tunnel = config.ssh?.enabled
    ? await openSshTunnel(config.ssh, config, verifySshHost) : undefined;

  let instance: null | Knex<DatabaseRow, unknown[]>;

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

  try {
    instance = knex<DatabaseRow, unknown[]>({
      pool,
      debug: process.env.NODE_ENV === 'development',
      client: adapter.client,
      connection: {
        ...connectionConfig,
        ...(sslConfig ? { ssl: sslConfig } : {}),
        ...(tunnel ? dialect === 'mysql' ? {
          // Preserve the original host for MySQL TLS/SNI, connecting through the local tunnel.
          stream: () => connectSocket(tunnel.port, tunnel.host),
        } : {
          host: tunnel.host,
          port: tunnel.port,
          ...(sslConfig ? { ssl: {
            ...sslConfig,
            ...(!isIP(config.host) ? { servername: config.host } : {}),
            checkServerIdentity: (_host, certificate) => checkServerIdentity(config.host, certificate),
          } } : {}),
        } : {}),
      },
      ...adapter.getKnexConfig?.(config),
    });
  } catch (error) {
    await tunnel?.close();
    throw error;
  }

  if (tunnel) {
    connectionTunnels.set(instance, tunnel);
  }

  const errorsHandled = {
    authentication: {
      errors: ['authentication failed'],
      message: 'Erro de autenticação, verifique as credenciais da conexão',
    },
  };

  const getError = (error: unknown) => {
    let serializedError = error;

    if (!getErrorMessage(serializedError)) {
      return new Error('Ocorreu um erro desconhecido.');
    }

    Object.keys(errorsHandled).some((key) => {
      const { message, errors = [] } = errorsHandled[key];

      const checkErrorMessage = errors.some((textError) => getErrorMessage(error).includes(textError));

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
  } catch (error: unknown) {
    await destroyConnectionInstance(instance);
    instance = null;

    const serializedError = getError(tunnel?.getError() || error);
    throw serializedError;
  }

  return instance;
};

export const testConnection = async (config: IConnectionTest) => {
  const storedConfig =
    config.id ? getInternalConnectionSaved(config.id) : undefined;
  const mergedConfig: IConnectionConfig = {
    ...storedConfig,
    ...config,
    id: config.id ?? storedConfig?.id ?? '',
    id_project: config.id_project ?? storedConfig?.id_project ?? '',
    password: config.password || storedConfig?.password,
    ssh: mergeSshCredentials(config.ssh, storedConfig?.ssh),
  };
  const bridgeSource = isReactNativeBridgeDialect(mergedConfig.dialect)
    ? getReactNativeBridgeTestSource(mergedConfig.id)
    : undefined;

  if (bridgeSource) {
    await retainReactNativeBridgeGateway(bridgeSource, getReactNativeBridgeGatewayOptions(mergedConfig));
  }

  try {
    const instance = await makeConnectionInstance(mergedConfig, true);
    await destroyConnectionInstance(instance);
  } finally {
    if (bridgeSource) await releaseReactNativeBridgeGateway(bridgeSource);
  }
};

const makeConnection = async (connectionId: string) => {
  const config = await getInternalConnectionSaved(connectionId);

  if (!config) {
    throw new Error(`Connection config is not found. (${connectionId})`);
  }

  const { id, dialect } = config;
  const bridgeSource = isReactNativeBridgeDialect(dialect)
    ? getReactNativeBridgeConnectionSource(id)
    : undefined;

  if (bridgeSource) {
    await retainReactNativeBridgeGateway(bridgeSource, getReactNativeBridgeGatewayOptions(config));
  }

  try {
    const instance = await makeConnectionInstance(config);

    const connection: IConnection = {
      id,
      instance,
      dialect,
    };

    activeConnections.push(connection);

    return connection;
  } catch (error) {
    if (bridgeSource) await releaseReactNativeBridgeGateway(bridgeSource);
    throw error;
  }
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
        await destroyConnectionInstance(connection.instance);
      } catch (error) {
        console.error(error);
      } finally {
        const index = activeConnections.indexOf(connection);

        if (index >= 0) activeConnections.splice(index, 1);

        if (isReactNativeBridgeDialect(connection.dialect)) {
          await releaseReactNativeBridgeGateway(getReactNativeBridgeConnectionSource(connection.id));
        }
      }
    }),
  );
};

export const getConnection = async (connectionId: string) => {
  const connectionAlreadyStarted = activeConnections.find(
    (connection) => connection.id === connectionId,
  );

  if (connectionAlreadyStarted) {
    const tunnel = connectionTunnels.get(connectionAlreadyStarted.instance);
    if (!tunnel || tunnel.isOpen()) return connectionAlreadyStarted;
    await closeConnection(connectionId);
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

