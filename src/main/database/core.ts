import path from 'path';
import { app, BrowserWindow, dialog } from 'electron';
import knex, { Knex } from 'knex';
import { getInternalConnectionSaved } from '@main/storage/store';
import { emitEvent } from '@main/utils/emitEvent';
import {
  releaseReactNativeBridgeGateway,
  retainReactNativeBridgeGateway,
} from '@main/reactNativeBridge/gateway';
import { getDialectAdapter, getDialectIds } from './dialects';
import { compareDatabases as compareDatabasesCore, type DatabaseCompareParams } from './compare';
import { getSslConfig } from './ssl';
import type { IOrderBy } from './types';
import { writeExportFile, type ExportFormat } from '@main/files/export';
import { applyTableChanges } from './tableChanges';
import type { IApplyTableChangesParams } from '../../preload/database';
import { serializeOrderBy } from './utils/orderBy';
import {
  hasSqlStatementSeparator,
  isReadOnlySelectQuery,
  normalizeSqlForKeywordSearch,
  sanitizeAutoPaginatedError,
} from './utils/sql';

const activeConnections: IConnection[] = [];
const pendingConnections = new Map<string, Promise<IConnection>>();
const activeRunSqlQueries = new Map<
  string,
  { connectionId: string; instance: Knex; dbConnection: any; dialect: Dialect }
>();
const serverOutputByConnection = new Map<string, IServerOutputMessage[]>();
const MAX_SERVER_OUTPUT_MESSAGES = 1000;

const activeExports = new Map<string, { connectionId: string; canceled: boolean }>();

type ExportSource =
  | { type: 'table'; schema?: string; table: string; where?: string; orderBy?: IOrderBy[] }
  | { type: 'query'; sql: string; orderBy?: IOrderBy[] };

interface IExportDataParams {
  exportId: string;
  source: ExportSource;
  columns: string[];
  format: ExportFormat;
  batchSize?: number;
  fileName?: string;
}

interface IExportPreviewParams {
  source: ExportSource;
}

const EXPORT_FORMAT_FILTERS: Record<ExportFormat, Electron.FileFilter> = {
  csv: { name: 'CSV', extensions: ['csv'] },
  json: { name: 'JSON', extensions: ['json'] },
  jsonl: { name: 'JSONL', extensions: ['jsonl'] },
  xlsx: { name: 'Excel', extensions: ['xlsx'] },
};

const EXPORT_MIME_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  jsonl: 'jsonl',
  xlsx: 'xlsx',
};

const isReactNativeBridgeDialect = (dialect: Dialect) => dialect === 'react-native-sqlite';
const getReactNativeBridgeConnectionSource = (connectionId: string) => `connection:${connectionId}`;
const getReactNativeBridgeTestSource = (connectionId?: string) =>
  `test:${connectionId || Date.now().toString(36)}`;
const getReactNativeBridgeGatewayOptions = (config: IConnectionConfig) => ({
  port: config.reactNativeBridge?.port,
});

interface IServerOutputMessage {
  id: string;
  connectionId: string;
  date: string;
  severity?: string;
  message: string;
  detail?: string;
  hint?: string;
  where?: string;
}

const addServerOutput = (connectionId: string, notice: any) => {
  if (!connectionId) return;

  const message: IServerOutputMessage = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    connectionId,
    date: new Date().toISOString(),
    severity: notice.severity,
    message: notice.message,
    detail: notice.detail,
    hint: notice.hint,
    where: notice.where,
  };

  const messages = serverOutputByConnection.get(connectionId) || [];
  const nextMessages = [...messages, message].slice(-MAX_SERVER_OUTPUT_MESSAGES);

  serverOutputByConnection.set(connectionId, nextMessages);

  emitEvent('@event:server_output', message);
};

export const getServerOutput = async (connectionId: string) => {
  return serverOutputByConnection.get(connectionId) || [];
};

export const clearServerOutput = async (connectionId: string) => {
  serverOutputByConnection.delete(connectionId);
};

export const getProcessList = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  if (!query.getProcessList) return [];

  const raw = await instance.raw(query.getProcessList());

  return adapter.getRows(raw);
};

export const cancelProcess = async (connectionId: string, pid: string | number) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  if (!query.cancelProcess) return false;

  const safePid = Number(pid);

  if (!Number.isInteger(safePid) || safePid <= 0) throw new Error('PID inválido.');

  const raw = await instance.raw(query.cancelProcess(safePid));
  const [row] = adapter.getRows(raw);

  return row?.canceled === undefined ? true : Boolean(row.canceled);
};

const normalizeExportFileName = (value?: string) => {
  const name =
    value?.trim?.() || `woodbox-export-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  return name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 180);
};

const getExportSourceBaseSql = (
  source: ExportSource,
  quoteIdentifier: (value: string) => string,
) => {
  if (source.type === 'table') {
    const tableName = source.schema
      ? `${quoteIdentifier(source.schema)}.${quoteIdentifier(source.table)}`
      : quoteIdentifier(source.table);
    const whereQuery = source.where ? `WHERE ${source.where}` : '';

    return `SELECT * FROM ${tableName} ${whereQuery}`.trim();
  }

  const sql = source.sql.trim().replace(/;+\s*$/, '');

  if (!isReadOnlySelectQuery(sql)) {
    throw new Error('A exportação só está disponível para consultas SELECT.');
  }

  if (hasSqlStatementSeparator(sql)) {
    throw new Error('Exporte uma instrução SELECT por vez.');
  }

  return `SELECT * FROM (${sql}) AS __export_query`;
};

const getExportSourceOrderBy = (source: ExportSource, quoteIdentifier: (value: string) => string) =>
  serializeOrderBy(source.orderBy, quoteIdentifier);

const getExportSql = (
  source: ExportSource,
  quoteIdentifier: (value: string) => string,
  options?: { limit?: number; offset?: number },
) => {
  const baseSql = getExportSourceBaseSql(source, quoteIdentifier);
  const orderBy = getExportSourceOrderBy(source, quoteIdentifier);
  const limit = options?.limit;
  const offset = options?.offset ?? 0;
  const pagination = Number(limit) > 0 ? `LIMIT ${Number(limit)} OFFSET ${offset}` : '';

  return [baseSql, orderBy, pagination].filter(Boolean).join('\n');
};

const getSerializedExportResult = (
  adapter: ReturnType<typeof getDialectAdapter>,
  raw: unknown,
  statement: string,
) => {
  const [result] = adapter.serializeRunSqlResult(raw, {
    auto_paginated: false,
    execution_time_ms: 0,
    statement,
  });

  return {
    rows: result?.rows || [],
    columns: result?.columns || Object.keys(result?.rows?.[0] || {}),
  };
};

export const cancelRunSql = async (connectionId: string, queryExecutionId: string) => {
  const activeQuery = activeRunSqlQueries.get(queryExecutionId);

  if (!activeQuery || activeQuery.connectionId !== connectionId) return false;

  const adapter = getDialectAdapter(activeQuery.dialect);

  if (!adapter.cancelQuery) return false;

  return adapter.cancelQuery({
    instance: activeQuery.instance,
    dbConnection: activeQuery.dbConnection,
  });
};

export const closeAllConnections = async () => {
  await Promise.allSettled(pendingConnections.values());
  await Promise.all(
    activeConnections.map(async (connection) => {
      try {
        await connection?.instance?.destroy?.();
      } finally {
        if (isReactNativeBridgeDialect(connection.dialect)) {
          await releaseReactNativeBridgeGateway(
            getReactNativeBridgeConnectionSource(connection.id),
          );
        }
      }
    }),
  );
  activeConnections.splice(0);
};

const makeConnectionInstance = async (config: IConnectionConfig, noPool?: boolean) => {
  const { id, dialect } = config;
  const adapter = getDialectAdapter(dialect);
  const connectionConfig = adapter.getConnectionConfig(config);
  const sslConfig = getSslConfig(config);

  let instance: null | Knex<any, unknown[]>;

  const pool = noPool
    ? undefined
    : {
        min: 0,
        max: 6,
        createTimeoutMillis: 3000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
        afterCreate: (connection, done) => {
          connection.on?.('notice', (notice) => addServerOutput(id, notice));
          done(null, connection);
        },
      };

  instance = knex({
    pool,
    // Knex debug writes every query to stdout, which can throw EPIPE when the
    // Electron process is detached from its original terminal.
    debug: false,
    client: adapter.client,
    connection: {
      ...connectionConfig,
      ...(sslConfig ? { ssl: sslConfig } : {}),
    },
    ...adapter.getKnexConfig?.(config),
  });

  const errorsHandled = {
    authentication: {
      errors: ['authentication failed'],
      message: 'Erro de autenticação, verifique as credenciais da conexão',
    },
  };

  const getError = (error: Error) => {
    let serializedError = error;

    if (!serializedError?.message) {
      return new Error('Ocorreu um erro desconhecido.');
    }

    Object.keys(errorsHandled).some((key) => {
      const { message, errors = [] } = errorsHandled[key];

      const checkErrorMessage = errors.some((textError) => error.message.includes(textError));

      if (checkErrorMessage) {
        serializedError = new Error(message);
        return true;
      }

      return false;
    });

    return serializedError;
  };

  try {
    await instance.raw('SELECT 1');
  } catch (error: any) {
    instance.destroy();
    instance = null;

    const serializedError = getError(error);
    throw serializedError;
  }

  return instance;
};

export const getDialects = () => getDialectIds();

export const testConnection = async (config: IConnectionConfig) => {
  const storedConfig =
    config.id && !config.password ? getInternalConnectionSaved(config.id) : undefined;
  const mergedConfig = {
    ...storedConfig,
    ...config,
    password: config.password || storedConfig?.password,
  };
  const bridgeSource = isReactNativeBridgeDialect(mergedConfig.dialect)
    ? getReactNativeBridgeTestSource(mergedConfig.id)
    : undefined;

  if (bridgeSource) {
    await retainReactNativeBridgeGateway(
      bridgeSource,
      getReactNativeBridgeGatewayOptions(mergedConfig),
    );
  }

  try {
    const instance = await makeConnectionInstance(mergedConfig, true);
    await instance.destroy();
  } finally {
    if (bridgeSource) await releaseReactNativeBridgeGateway(bridgeSource);
  }
};

const makeConnection = async (connectionId: string) => {
  const config = await getInternalConnectionSaved(connectionId);

  if (!config) {
    throw new Error(`Connection config is not found. (${connectionId})`);
  }

  const { id, dialect } = config;
  const bridgeSource = isReactNativeBridgeDialect(dialect)
    ? getReactNativeBridgeConnectionSource(id)
    : undefined;

  if (bridgeSource) {
    await retainReactNativeBridgeGateway(bridgeSource, getReactNativeBridgeGatewayOptions(config));
  }

  try {
    const instance = await makeConnectionInstance(config);

    const connection: IConnection = {
      id,
      instance,
      dialect,
    };

    activeConnections.push(connection);

    return connection;
  } catch (error) {
    if (bridgeSource) await releaseReactNativeBridgeGateway(bridgeSource);
    throw error;
  }
};

export const closeConnection = async (connectionId: string) => {
  const pendingConnection = pendingConnections.get(connectionId);

  if (pendingConnection) {
    try {
      await pendingConnection;
    } catch (error) {
      console.error(error);
    }
  }

  const connections = activeConnections.filter((connection) => connection.id === connectionId);

  serverOutputByConnection.delete(connectionId);

  if (!connections.length) return;

  await Promise.all(
    connections.map(async (connection) => {
      try {
        await connection.instance.destroy();
      } catch (error) {
        console.error(error);
      } finally {
        const index = activeConnections.indexOf(connection);

        if (index >= 0) activeConnections.splice(index, 1);

        if (isReactNativeBridgeDialect(connection.dialect)) {
          await releaseReactNativeBridgeGateway(
            getReactNativeBridgeConnectionSource(connection.id),
          );
        }
      }
    }),
  );
};

const getConnection = async (connectionId: string) => {
  const connectionAlreadyStarted = activeConnections.find(
    (connection) => connection.id === connectionId,
  );

  if (connectionAlreadyStarted) {
    return connectionAlreadyStarted;
  }

  const pendingConnection = pendingConnections.get(connectionId);

  if (pendingConnection) {
    return await pendingConnection;
  }

  const connectionPromise = makeConnection(connectionId);
  pendingConnections.set(connectionId, connectionPromise);

  try {
    return await connectionPromise;
  } finally {
    pendingConnections.delete(connectionId);
  }
};

/**
 * return schemas(postgres only) and tables.
 */
export const getConnectionInfo = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const adapter = getDialectAdapter(connection.dialect);
  const query = adapter.queries;

  const { instance } = connection;

  const [tablesRaw, schemasRaw, functionsRaw] = await Promise.all([
    instance.raw(query.getTables()),
    query.getAllSchemas ? instance.raw(query.getAllSchemas()) : undefined,
    query.getFunctions ? instance.raw(query.getFunctions()) : undefined,
  ]);

  const tables = adapter.getRows(tablesRaw);
  const schemas = schemasRaw
    ? adapter.getRows(schemasRaw).map((row) => row?.schema_name)
    : undefined;
  const functions = functionsRaw ? adapter.getRows(functionsRaw) : [];

  return { tables, schemas, functions };
};

export const getTableColumns = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableColumns({ table, schema }));

  return adapter.getRows(raw);
};

export const getColumnTypes = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getColumnTypes());

  return adapter.getRows(raw);
};

export const getTableReferences = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableReferences({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableUsedAsReference = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableUsedAsReference({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableRestrictions = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableRestrictions({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableDefinition = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableDefinition({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableIndexes = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableIndexes({ table, schema }));

  return adapter.getRows(raw);
};

export const getTableTriggers = async (connectionId: string, { table, schema }) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableTriggers({ table, schema }));

  return adapter.getRows(raw);
};

export const getFunctionDefinition = async (
  connectionId: string,
  { schema, functionName }: { schema: string; functionName: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  if (!query.getFunctionDefinition) return [];

  const raw = await instance.raw(query.getFunctionDefinition({ schema, functionName }));

  return adapter.getRows(raw);
};

export const compareDatabases = async (params: DatabaseCompareParams) => {
  return compareDatabasesCore(params, getConnection);
};

/**
 * return table rows with pagination.
 */
export const getTableData = async (
  connectionId: string,
  {
    table,
    schema,
    page = 1,
    limit = 200,
    where,
    orderBy,
  }: {
    table: string;
    schema: string;
    page?: number;
    limit?: number;
    where?: string;
    orderBy?: IOrderBy[];
  },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const dataRaw = await instance.raw(
    query.selectWithOffset({ table, schema, actualPage: page, limit, where, orderBy }),
  );

  return { data: adapter.getRows(dataRaw) };
};

export const getTableRowsCount = async (
  connectionId: string,
  { table, schema, where }: { table: string; schema?: string; where?: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTotalRowsCountInTable({ table, schema, where }));
  const [row] = adapter.getRows(raw);

  return Number(row?.total_rows ?? 0);
};

export const getQueryRowsCount = async (connectionId: string, sql: string) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const sqlFinal = sql.trim().replace(/;+\s*$/, '');
  if (!isReadOnlySelectQuery(sqlFinal)) {
    throw new Error('A contagem só está disponível para consultas SELECT.');
  }

  const raw = await instance.raw(`
    SELECT count(*) AS total_rows
    FROM (${sqlFinal}) AS __count_query;
  `);
  const [row] = adapter.getRows(raw);

  return Number(row?.total_rows ?? 0);
};

export const getExportDataPreview = async (
  connectionId: string,
  { source }: IExportPreviewParams,
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);
  const sql = getExportSql(source, adapter.quoteIdentifier, { limit: 10, offset: 0 });
  const raw = await instance.raw(sql);
  const result = getSerializedExportResult(adapter, raw, sql);

  return {
    columns: result.columns,
    rows: result.rows.slice(0, 10),
  };
};

export const getExportDataCount = async (
  connectionId: string,
  { source }: IExportPreviewParams,
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);
  const sourceSql = getExportSourceBaseSql(source, adapter.quoteIdentifier);
  const raw = await instance.raw(
    `SELECT COUNT(*) AS total_rows FROM (${sourceSql}) AS __export_count`,
  );
  const [row] = adapter.getRows(raw);

  return Number(row?.total_rows ?? 0);
};

export const cancelExport = (connectionId: string, exportId: string) => {
  const job = activeExports.get(exportId);
  if (!job || job.connectionId !== connectionId) return false;
  job.canceled = true;
  return true;
};

export const exportData = async (
  connectionId: string,
  { source, columns, format, batchSize = 1000, fileName, exportId }: IExportDataParams,
) => {
  if (!columns?.length) throw new Error('Selecione ao menos uma coluna para exportar.');
  if (!exportId || activeExports.has(exportId))
    throw new Error('Identificador de exportação inválido.');
  if (!Object.hasOwn(EXPORT_MIME_EXTENSIONS, format))
    throw new Error('Formato de exportação inválido.');

  const job = { connectionId, canceled: false };
  activeExports.set(exportId, job);
  try {
    const { instance, dialect } = await getConnection(connectionId);
    const adapter = getDialectAdapter(dialect);
    const safeBatchSize = Math.max(1, Math.min(Math.floor(Number(batchSize)) || 1000, 100000));
    const extension = EXPORT_MIME_EXTENSIONS[format];
    if (job.canceled) return { canceled: true, rows: 0 };
    const saveOptions: Electron.SaveDialogOptions = {
      defaultPath: path.join(
        app.getPath('downloads'),
        `${Date.now()}_${normalizeExportFileName(fileName)}.${extension}`,
      ),
      filters: [EXPORT_FORMAT_FILTERS[format]],
    };
    const parentWindow = BrowserWindow.getFocusedWindow();
    const result = parentWindow
      ? await dialog.showSaveDialog(parentWindow, saveOptions)
      : await dialog.showSaveDialog(saveOptions);
    if (job.canceled || result.canceled || !result.filePath) return { canceled: true, rows: 0 };
    const filePath =
      path.extname(result.filePath).toLowerCase() === `.${extension}`
        ? result.filePath
        : `${result.filePath}.${extension}`;

    return await writeExportFile({
      filePath,
      format,
      columns,
      batchSize: safeBatchSize,
      isCanceled: () => job.canceled,
      onProgress: (rows) => emitEvent('@event:export_progress', { exportId, connectionId, rows }),
      readPage: async (page) => {
        const sql = getExportSql(source, adapter.quoteIdentifier, {
          limit: safeBatchSize,
          offset: (page - 1) * safeBatchSize,
        });
        const raw = await instance.raw(sql);
        return getSerializedExportResult(adapter, raw, sql).rows as Record<string, unknown>[];
      },
    });
  } finally {
    activeExports.delete(exportId);
  }
};

export const runSql = async (
  connectionId: string,
  sql: string,
  options?: { page?: number; limit?: number; orderBy?: IOrderBy[]; queryExecutionId?: string },
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);

  const sql_original = sql.trim();
  let sql_final = sql_original;

  const isSelectQuery = isReadOnlySelectQuery(sql_final);
  const normalized = normalizeSqlForKeywordSearch(sql_final);
  let auto_paginated = false;

  // adiciona limit e offset em consultas SELECT para realizar paginacao.
  if (isSelectQuery) {
    const hasLimit = /\blimit\b/.test(normalized);
    const hasOffset = /\boffset\b/.test(normalized);

    const limit = options?.limit ?? 200;
    const page = options?.page ?? 1;

    if (sql_final.endsWith(';')) sql_final = sql_final.slice(0, -1);

    if (!hasLimit && !hasOffset && Number(limit) > 0 && Number(page) >= 0) {
      auto_paginated = true;
      const orderByQuery = serializeOrderBy(options?.orderBy, adapter.quoteIdentifier);

      sql_final = `
        SELECT *
        FROM (${sql_final}) AS __base_query
        ${orderByQuery}
        LIMIT ${limit} OFFSET ${(page - 1) * limit};
      `;
    }
  }

  const dbConnection = await (instance.client as any).acquireConnection();

  try {
    if (options?.queryExecutionId) {
      activeRunSqlQueries.set(options.queryExecutionId, {
        connectionId,
        instance,
        dbConnection,
        dialect,
      });
    }

    const t0 = Date.now();
    const statements =
      !isSelectQuery && adapter.splitStatements ? adapter.splitStatements(sql_final) : [sql_final];
    const results: { raw: any; statement: string }[] = [];

    try {
      for (const statement of statements) {
        results.push({ raw: await instance.raw(statement).connection(dbConnection), statement });
      }
    } catch (error) {
      if (auto_paginated) throw sanitizeAutoPaginatedError(error, sql_final, sql_original);
      throw error;
    }

    const execution_time_ms = Date.now() - t0;

    const serializedResults = results.flatMap(({ raw, statement }) =>
      adapter.serializeRunSqlResult(raw, { auto_paginated, execution_time_ms, statement }),
    );

    if (!adapter.resolveRunSqlColumnsInfo) return serializedResults;

    try {
      return await adapter.resolveRunSqlColumnsInfo({
        instance,
        dbConnection,
        sql: sql_original,
        results: serializedResults,
      });
    } catch {
      return serializedResults;
    }
  } finally {
    if (options?.queryExecutionId) activeRunSqlQueries.delete(options.queryExecutionId);
    await (instance.client as any).releaseConnection(dbConnection);
  }
};

export const runExplainSql = async (
  connectionId: string,
  sql: string,
  options?: { queryExecutionId?: string },
) => {
  const connection = await getConnection(connectionId);
  const adapter = getDialectAdapter(connection.dialect);
  const sqlFinal = sql.trim().replace(/;+\s*$/, '');

  if (!isReadOnlySelectQuery(sqlFinal)) {
    throw new Error('EXPLAIN só está disponível para consultas SELECT.');
  }

  if (hasSqlStatementSeparator(sqlFinal)) {
    throw new Error('EXPLAIN analisa uma instrução SQL por vez.');
  }

  return runSql(connectionId, adapter.getExplainSql(sqlFinal), options);
};

export const importTableData = async (
  connectionId: string,
  { schema, table, rows }: IImportTableDataParams,
): Promise<IImportTableDataResult> => {
  if (!table) throw new Error('Tabela não informada.');

  const rowsToImport = rows.filter((row) => Object.keys(row).length);
  if (!rowsToImport.length) return { insertedRows: 0 };

  const connection = await getConnection(connectionId);
  const { instance } = connection;
  const chunkSize = 500;
  let insertedRows = 0;

  await instance.transaction(async (trx) => {
    for (let index = 0; index < rowsToImport.length; index += chunkSize) {
      const chunk = rowsToImport.slice(index, index + chunkSize);
      const query = schema ? trx.withSchema(schema).table(table) : trx.table(table);

      await query.insert(chunk);
      insertedRows += chunk.length;
    }
  });

  return { insertedRows };
};

export const saveTableChanges = async (connectionId: string, params: IApplyTableChangesParams) => {
  const { instance, dialect } = await getConnection(connectionId);
  return applyTableChanges(instance, dialect, params);
};
