import pg from 'pg';
import queries from '@main/database/querys/postgres';
import type { DatabaseDialectAdapter, SerializedRunSqlResult } from './types';

pg.types.setTypeParser(1114, (val) => val);
pg.types.setTypeParser(1184, (val) => val);

const quoteIdentifier = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
const postgresTypesByOid = new Map<number, string>(
  Object.entries(pg.types.builtins).map(([name, oid]) => [Number(oid), name.toLowerCase()]),
);
const getPostgresTypeName = (oid?: number) => (oid ? postgresTypesByOid.get(oid) : undefined);

const postgres: DatabaseDialectAdapter = {
  id: 'postgres',
  client: 'postgres',
  queries,
  quoteIdentifier,
  getConnectionConfig: ({ description, database, host, port, username: user, password }) => ({
    host,
    port,
    user,
    password,
    database,
    dateStrings: true,
    application_name: `Woodbox (${description})`,
  }),
  getRows: (raw) => raw?.rows || [],
  serializeRunSqlResult: (raw, context) => {
    const rawArray = Array.isArray(raw) ? raw : [raw];

    return rawArray.map<SerializedRunSqlResult>((rawResult) => {
      const { command: type, fields: columns, rowCount: affected_rows, rows = [] } = rawResult;

      return {
        type,
        affected_rows,
        auto_paginated: context.auto_paginated,
        execution_time_ms: context.execution_time_ms,
        rows: JSON.parse(JSON.stringify(rows)),
        columns: columns?.map?.((field) => field.name) || [],
        columns_info: columns?.map?.((field) => ({
          name: field.name,
          type: getPostgresTypeName(field.dataTypeID),
        })),
      };
    });
  },
  cancelQuery: async ({ instance, dbConnection }) => {
    await (instance.client as any).cancelQuery(dbConnection);
    return true;
  },
};

export default postgres;
