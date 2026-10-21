import type { IReactNativeBridgeConnectionConfig } from '@shared/types/reactNativeBridge';
import { findReactNativeBridgeSession, getReactNativeBridgeSession } from './sessions';
import { requestReactNativeBridge } from './rpc';
import type { ExecuteSqlParams, SqliteExecutionResult } from './protocol';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findSessionWithRetry = async (config: IReactNativeBridgeConnectionConfig) => {
  const startedAt = Date.now();
  const timeoutMs = 3000;

  while (Date.now() - startedAt < timeoutMs) {
    const session = findReactNativeBridgeSession({
      appId: config.appId,
      adapterId: config.adapterId,
    });

    if (session) return session;

    await wait(250);
  }

  return findReactNativeBridgeSession({
    appId: config.appId,
    adapterId: config.adapterId,
  });
};

export const resolveReactNativeBridgeSqlSession = async (config: IReactNativeBridgeConnectionConfig) => {
  const session = await findSessionWithRetry(config);

  if (!session) {
    throw new Error('O app React Native não está conectado à bridge. Verifique se o app está aberto em modo dev.');
  }

  return session;
};

export const executeReactNativeBridgeSql = async (
  config: IReactNativeBridgeConnectionConfig,
  params: ExecuteSqlParams,
  sessionId?: string,
) => {
  const session = sessionId
    ? getReactNativeBridgeSession(sessionId)
    : await resolveReactNativeBridgeSqlSession(config);
  if (!session || !session.adapters.some((adapter) => adapter.id === config.adapterId)) {
    throw new Error('A sessão da transação React Native foi encerrada.');
  }

  return requestReactNativeBridge(
    session,
    config.adapterId,
    'relational.executeSql',
    params,
  ) as Promise<SqliteExecutionResult>;
};
