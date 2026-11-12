import structureDdl from '../structure/ddl/sqlite';
import type { IReactNativeBridgeConnectionConfig } from '@shared/types/reactNativeBridge';
import sqlite from './sqlite';
import type { DatabaseDialectAdapter } from '../types';

import ClientSqlite3 from 'knex/lib/dialects/sqlite3';
import { executeReactNativeBridgeSql, resolveReactNativeBridgeSqlSession } from '../../reactNativeBridge/service';

const transactionSessions = new WeakMap<object, string>();
const readRequestSessions = new WeakMap<object, string>();

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
    let sessionId = this.transacting ? transactionSessions.get(this) : readRequestSessions.get(connection);
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
  structureDdl,
  id: 'react-native-sqlite',
  connectionDescriptor: {
    label: 'React Native SQLite',
    mode: 'react-native-bridge',
    supportsSsl: false,
  },
  client: ReactNativeBridgeSqliteClient as ClientSqlite3,
  getConnectionConfig: ({ reactNativeBridge }) => ({ reactNativeBridge }),
  beginTableFilterRequest: async (connection) => {
    const config = (connection as ReactNativeBridgeConnection).reactNativeBridge;
    if (!config) throw new Error('Adapter React Native Bridge não informado.');
    const session = await resolveReactNativeBridgeSqlSession(config);
    readRequestSessions.set(connection, session.id);
    return () => { readRequestSessions.delete(connection); };
  },
};

export default reactNativeSqlite;
