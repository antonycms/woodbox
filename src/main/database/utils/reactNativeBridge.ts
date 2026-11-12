import type { Dialect, IConnectionConfig } from '@shared/types/connections';
import type { ReactNativeBridgeConnectionStatus, ReactNativeBridgeStatus } from '@shared/types/reactNativeBridge';

export const isReactNativeBridgeDialect = (dialect: Dialect) => dialect === 'react-native-sqlite';

export const getReactNativeBridgeConnectionSource = (connectionId: string) =>
  `connection:${connectionId}`;

export const getReactNativeBridgeTestSource = (connectionId?: string) =>
  `test:${connectionId || Date.now().toString(36)}`;

export const getReactNativeBridgeGatewayOptions = (config: IConnectionConfig) => ({
  port: config.reactNativeBridge?.port,
});

export const toReactNativeBridgeConnectionStatus = (
  status: ReactNativeBridgeStatus,
): ReactNativeBridgeConnectionStatus => ({
  ...status,
  connectionSessions: status.sessions.map((session) => ({
    id: session.id,
    appId: session.appId,
    appName: session.appName,
    platform: session.platform,
    deviceName: session.deviceName,
    adapters: (Array.isArray(session.adapters) ? session.adapters : [])
      .filter((adapter) => adapter?.model === 'relational' && adapter?.dialect === 'sqlite')
      .map(({ id, label }) => ({ id, label })),
  })),
});
