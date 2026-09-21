export type ReactNativeBridgePlatform = 'android' | 'ios' | 'unknown';

export interface ReactNativeBridgeAdapterInfo {
  id: string;
  label: string;
  kind: string;
  dialect: string;
  model: 'relational';
}

export interface ReactNativeBridgeSessionInfo {
  id: string;
  appId?: string;
  appName?: string;
  platform?: ReactNativeBridgePlatform;
  deviceName?: string;
  connectedAt: string;
  lastSeenAt: string;
  adapters: ReactNativeBridgeAdapterInfo[];
}

export interface ReactNativeBridgeStatus {
  running: boolean;
  host: string;
  port: number;
  sessions: ReactNativeBridgeSessionInfo[];
}

export interface IReactNativeBridgeConnectionConfig {
  appId?: string;
  appName?: string;
  adapterId: string;
  adapterLabel?: string;
  port?: number;
  platform?: ReactNativeBridgePlatform;
  deviceName?: string;
}

export interface ReactNativeBridgeEvent {
  type: 'event';
  event: 'adaptersChanged' | 'dataChanged' | 'log';
  adapterId?: string;
  data?: unknown;
}
