import { findReactNativeBridgeSession } from './sessions';
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

export const executeReactNativeBridgeSql = async (
  config: IReactNativeBridgeConnectionConfig,
  params: ExecuteSqlParams,
) => {
  const session = await findSessionWithRetry(config);

  if (!session) {
    throw new Error('O app React Native não está conectado à bridge. Verifique se o app está aberto em modo dev.');
  }

  return requestReactNativeBridge(
    session,
    config.adapterId,
    'relational.executeSql',
    params,
  ) as Promise<SqliteExecutionResult>;
};
