import type { IReactNativeBridgeConnectionConfig } from '@shared/types/reactNativeBridge';
import sqlite from './sqlite';
import type { DatabaseDialectAdapter } from '../types';

import ClientSqlite3 from 'knex/lib/dialects/sqlite3';
import { executeReactNativeBridgeSql, resolveReactNativeBridgeSqlSession } from '../../reactNativeBridge/service';

const transactionSessions = new WeakMap<object, string>();

interface ReactNativeBridgeConnection {
  reactNativeBridge?: IReactNativeBridgeConnectionConfig;
}

interface KnexQueryObject {
  sql?: string;
  bindings?: unknown[];
  response?: unknown;
  context?: {
    lastID?: number;
    changes?: number;
  };
}

class ReactNativeBridgeSqliteClient extends ClientSqlite3 {
  declare connectionSettings: ReactNativeBridgeConnection;
  declare transacting?: boolean;

  async acquireRawConnection() {
    const { reactNativeBridge } = this.connectionSettings;

    if (!reactNativeBridge?.adapterId) {
      throw new Error('Adapter React Native Bridge não informado.');
    }

    return { reactNativeBridge };
  }

  async destroyRawConnection() {
    return;
  }

  async _query(connection: ReactNativeBridgeConnection, obj: KnexQueryObject) {
    if (!obj.sql) throw new Error('The query is empty');

    // Knex creates a dedicated client per transaction, including BEGIN/ROLLBACK.
    // A disconnected transaction must fail, never continue on another app session.
    let sessionId = transactionSessions.get(this);
    if (this.transacting && !sessionId) {
      sessionId = (await resolveReactNativeBridgeSqlSession(connection.reactNativeBridge!)).id;
      transactionSessions.set(this, sessionId);
    }
    const result = await executeReactNativeBridgeSql(connection.reactNativeBridge!, {
      sql: obj.sql,
      params: obj.bindings || [],
    }, sessionId);

    obj.response = result.rows;
    obj.context = {
      lastID: result.insertId,
      changes: result.rowsAffected ?? 0,
    };

    return obj;
  }
}

const reactNativeSqlite: DatabaseDialectAdapter = {
  ...sqlite,
  id: 'react-native-sqlite',
  client: ReactNativeBridgeSqliteClient as ClientSqlite3,
  getConnectionConfig: ({ reactNativeBridge }) => ({ reactNativeBridge }),
};

export default reactNativeSqlite;
