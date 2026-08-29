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

export interface BridgeHelloMessage {
  type: 'hello';
  app: {
    id?: string;
    name?: string;
    platform?: ReactNativeBridgePlatform;
    deviceName?: string;
  };
  adapters: ReactNativeBridgeAdapterInfo[];
}

export interface BridgeRequestMessage {
  type: 'request';
  id: string;
  adapterId: string;
  method: 'relational.executeSql';
  params?: unknown;
}

export type BridgeResponseMessage =
  | {
      type: 'response';
      id: string;
      ok: true;
      result: unknown;
    }
  | {
      type: 'response';
      id: string;
      ok: false;
      error: {
        message: string;
        code?: string;
        detail?: unknown;
      };
    };

export interface BridgeEventMessage {
  type: 'event';
  event: 'adaptersChanged' | 'dataChanged' | 'log';
  adapterId?: string;
  data?: unknown;
}

export type BridgeMessage =
  | BridgeHelloMessage
  | BridgeRequestMessage
  | BridgeResponseMessage
  | BridgeEventMessage;

export interface ExecuteSqlParams {
  sql: string;
  params?: unknown[];
}

export interface SqliteExecutionResult {
  rows: Record<string, unknown>[];
  rowsAffected?: number;
  insertId?: number;
}
