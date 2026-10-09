import type { Dialect, IConnectionConfig } from '@shared/types/connections';

export const isReactNativeBridgeDialect = (dialect: Dialect) => dialect === 'react-native-sqlite';

export const getReactNativeBridgeConnectionSource = (connectionId: string) =>
  `connection:${connectionId}`;

export const getReactNativeBridgeTestSource = (connectionId?: string) =>
  `test:${connectionId || Date.now().toString(36)}`;

export const getReactNativeBridgeGatewayOptions = (config: IConnectionConfig) => ({
  port: config.reactNativeBridge?.port,
});
