import sqlite from './sqlite';
import type { DatabaseDialectAdapter } from '../types';

import ClientSqlite3 from 'knex/lib/dialects/sqlite3';
import { executeReactNativeBridgeSql } from '../../reactNativeBridge/service';

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

    const result = await executeReactNativeBridgeSql(connection.reactNativeBridge!, {
      sql: obj.sql,
      params: obj.bindings || [],
    });

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
