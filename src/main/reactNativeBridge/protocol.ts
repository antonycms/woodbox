import type { ReactNativeBridgeEvent } from '@shared/types/reactNativeBridge';
import type {
  ReactNativeBridgePlatform,
  ReactNativeBridgeAdapterInfo,
} from '@shared/types/reactNativeBridge';

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

export type BridgeMessage =
  | BridgeHelloMessage
  | BridgeRequestMessage
  | BridgeResponseMessage
  | ReactNativeBridgeEvent;

export interface ExecuteSqlParams {
  sql: string;
  params?: unknown[];
}

export interface SqliteExecutionResult {
  rows: Record<string, unknown>[];
  rowsAffected?: number;
  insertId?: number;
}
