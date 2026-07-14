import knex, { Knex } from 'knex';
import { getDialectAdapter, getDialectIds } from './dialects';
import { getConnectionsSaved } from '@main/storage/store';
import { emitEvent } from '@main/utils/emitEvent';

const activeConnections: IConnection[] = [];
const pendingConnections = new Map<string, Promise<IConnection>>();
const activeRunSqlQueries = new Map<
  string,
  { connectionId: string; instance: Knex; dbConnection: any; dialect: Dialect }
>();
const serverOutputByConnection = new Map<string, IServerOutputMessage[]>();
const MAX_SERVER_OUTPUT_MESSAGES = 1000;

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
  await Promise.all(activeConnections.map((connection) => connection?.instance?.destroy?.()));
};

const makeConnectionInstance = async (config: IConnectionConfig, noPool?: boolean) => {
  const { id, dialect } = config;
  const adapter = getDialectAdapter(dialect);

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
    debug: process.env.NODE_ENV === 'development',
    client: adapter.client,
    connection: adapter.getConnectionConfig(config),
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
  const instance = await makeConnectionInstance(config, true);
  await instance.destroy();
};

const makeConnection = async (connectionId: string) => {
  const config = await getConnectionsSaved(connectionId);

  if (!config) {
    throw new Error(`Connection config is not found. (${connectionId})`);
  }

  const { id, dialect } = config;

  const instance = await makeConnectionInstance(config);

  const connection: IConnection = {
    id,
    instance,
    dialect,
  };

  activeConnections.push(connection);

  return connection;
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

    return results.flatMap(({ raw, statement }) =>
      adapter.serializeRunSqlResult(raw, { auto_paginated, execution_time_ms, statement }),
    );
  } finally {
    if (options?.queryExecutionId) activeRunSqlQueries.delete(options.queryExecutionId);
    await (instance.client as any).releaseConnection(dbConnection);
  }
};

const sanitizeAutoPaginatedError = (error: unknown, executableSql: string, originalSql: string) => {
  if (!(error instanceof Error)) return error;

  const queryError = error as Error & { sql?: string; position?: string };

  queryError.message = sanitizeAutoPaginatedText(queryError.message, executableSql, originalSql);
  queryError.position = sanitizeAutoPaginatedPosition(
    queryError.position,
    executableSql,
    originalSql,
  );

  if (typeof queryError.sql === 'string') {
    queryError.sql = queryError.sql.includes('__base_query')
      ? originalSql
      : queryError.sql.replace(executableSql, originalSql);
  }

  if (typeof queryError.stack === 'string') {
    queryError.stack = queryError.stack.replace(executableSql, originalSql);
  }

  return queryError;
};

const sanitizeAutoPaginatedText = (text: string, executableSql: string, originalSql: string) => {
  const sanitizedText = text.replace(executableSql, originalSql);

  if (!sanitizedText.includes('__base_query')) return sanitizedText;

  return sanitizedText.split(' - ').slice(1).join(' - ') || sanitizedText;
};

const sanitizeAutoPaginatedPosition = (
  position: string | undefined,
  executableSql: string,
  originalSql: string,
) => {
  const numericPosition = Number(position);

  if (!Number.isFinite(numericPosition)) return position;

  const originalSqlStart = executableSql.indexOf(originalSql);
  const originalSqlEnd = originalSqlStart + originalSql.length;

  if (originalSqlStart < 0) return position;
  if (numericPosition <= originalSqlStart || numericPosition > originalSqlEnd) return undefined;

  return String(numericPosition - originalSqlStart);
};

const normalizeSqlForKeywordSearch = (sql: string) => {
  return sql
    .trim()
    .replace(/;+\s*$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const isReadOnlySelectQuery = (sql: string) => {
  const statement = sql.trim().replace(/;+\s*$/, '');
  const firstKeyword = readNextSqlKeyword(statement, 0);

  if (firstKeyword?.keyword === 'select') return true;
  if (firstKeyword?.keyword !== 'with') return false;

  const withInfo = readWithQueryInfo(statement, firstKeyword.endIndex);

  return withInfo.finalKeyword === 'select' && !withInfo.hasDataModifyingCte;
};

const readWithQueryInfo = (sql: string, startIndex: number) => {
  let index = startIndex;
  let hasDataModifyingCte = false;
  const recursiveKeyword = readNextSqlKeyword(sql, index);

  if (recursiveKeyword?.keyword === 'recursive') index = recursiveKeyword.endIndex;

  while (index < sql.length) {
    const asKeywordIndex = findTopLevelSqlKeyword(sql, index, ['as']);
    if (asKeywordIndex < 0) break;

    index = asKeywordIndex + 2;

    const bodyStartIndex = findNextSqlChar(sql, index, '(');
    if (bodyStartIndex < 0) break;

    const bodyEndIndex = findMatchingSqlParenthesis(sql, bodyStartIndex);
    if (bodyEndIndex < 0) break;

    const bodySql = sql.slice(bodyStartIndex + 1, bodyEndIndex);
    const bodyKeyword = readNextSqlKeyword(bodySql, 0)?.keyword;

    if (
      isDataModifyingSqlKeyword(bodyKeyword) ||
      (bodyKeyword === 'with' && !isReadOnlySelectQuery(bodySql))
    ) {
      hasDataModifyingCte = true;
    }

    index = skipSqlIgnorable(sql, bodyEndIndex + 1);

    if (sql[index] !== ',') {
      const finalKeyword = readNextSqlKeyword(sql, index)?.keyword;
      return { finalKeyword, hasDataModifyingCte };
    }

    index += 1;
  }

  return { finalKeyword: undefined, hasDataModifyingCte };
};

const isDataModifyingSqlKeyword = (keyword?: string) => {
  return (
    keyword === 'insert' || keyword === 'update' || keyword === 'delete' || keyword === 'merge'
  );
};

const readNextSqlKeyword = (sql: string, startIndex: number) => {
  const index = skipSqlIgnorable(sql, startIndex);
  const match = /^[a-z_][a-z0-9_$]*/i.exec(sql.slice(index));

  if (!match) return undefined;

  return { keyword: match[0].toLowerCase(), endIndex: index + match[0].length };
};

const skipSqlIgnorable = (sql: string, startIndex: number) => {
  let index = startIndex;

  while (index < sql.length) {
    const char = sql[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (sql.startsWith('--', index)) {
      const lineEndIndex = sql.indexOf('\n', index + 2);
      index = lineEndIndex < 0 ? sql.length : lineEndIndex + 1;
      continue;
    }

    if (sql.startsWith('/*', index)) {
      const commentEndIndex = sql.indexOf('*/', index + 2);
      index = commentEndIndex < 0 ? sql.length : commentEndIndex + 2;
      continue;
    }

    break;
  }

  return index;
};

const findNextSqlChar = (sql: string, startIndex: number, target: string) => {
  let index = startIndex;

  while (index < sql.length) {
    const ignoredEndIndex = skipSqlIgnorable(sql, index);
    if (ignoredEndIndex !== index) {
      index = ignoredEndIndex;
      continue;
    }

    const quotedEndIndex = skipSqlQuotedValue(sql, index);
    if (quotedEndIndex !== index) {
      index = quotedEndIndex;
      continue;
    }

    if (sql[index] === target) return index;

    index += 1;
  }

  return -1;
};

const findTopLevelSqlKeyword = (sql: string, startIndex: number, keywords: string[]) => {
  let index = startIndex;
  let depth = 0;

  while (index < sql.length) {
    const ignoredEndIndex = skipSqlIgnorable(sql, index);
    if (ignoredEndIndex !== index) {
      index = ignoredEndIndex;
      continue;
    }

    const quotedEndIndex = skipSqlQuotedValue(sql, index);
    if (quotedEndIndex !== index) {
      index = quotedEndIndex;
      continue;
    }

    const char = sql[index];

    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(depth - 1, 0);

    if (depth === 0) {
      const lowerSql = sql.slice(index).toLowerCase();
      const keyword = keywords.find((value) => lowerSql.startsWith(value));

      if (keyword && hasSqlKeywordBoundary(sql, index, keyword.length)) return index;
    }

    index += 1;
  }

  return -1;
};

const findMatchingSqlParenthesis = (sql: string, openIndex: number) => {
  let index = openIndex;
  let depth = 0;

  while (index < sql.length) {
    const ignoredEndIndex = skipSqlIgnorable(sql, index);
    if (ignoredEndIndex !== index) {
      index = ignoredEndIndex;
      continue;
    }

    const quotedEndIndex = skipSqlQuotedValue(sql, index);
    if (quotedEndIndex !== index) {
      index = quotedEndIndex;
      continue;
    }

    const char = sql[index];

    if (char === '(') depth += 1;

    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }

    index += 1;
  }

  return -1;
};

const skipSqlQuotedValue = (sql: string, startIndex: number) => {
  const char = sql[startIndex];

  if (char === "'") return skipSqlQuotedString(sql, startIndex, "'");
  if (char === '"') return skipSqlQuotedString(sql, startIndex, '"');
  if (char === '`') return skipSqlQuotedString(sql, startIndex, '`');
  if (char === '[') {
    const endIndex = sql.indexOf(']', startIndex + 1);
    return endIndex < 0 ? sql.length : endIndex + 1;
  }

  if (char === '$') {
    const tagMatch = /^\$[a-z_][a-z0-9_]*\$|^\$\$/i.exec(sql.slice(startIndex));

    if (!tagMatch) return startIndex;

    const tag = tagMatch[0];
    const endIndex = sql.indexOf(tag, startIndex + tag.length);

    return endIndex < 0 ? sql.length : endIndex + tag.length;
  }

  return startIndex;
};

const skipSqlQuotedString = (sql: string, startIndex: number, quote: string) => {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] !== quote) {
      index += 1;
      continue;
    }

    if (sql[index + 1] === quote) {
      index += 2;
      continue;
    }

    return index + 1;
  }

  return sql.length;
};

const hasSqlKeywordBoundary = (sql: string, startIndex: number, length: number) => {
  const previousChar = sql[startIndex - 1];
  const nextChar = sql[startIndex + length];

  return !isSqlIdentifierChar(previousChar) && !isSqlIdentifierChar(nextChar);
};

const isSqlIdentifierChar = (char: string | undefined) => {
  return !!char && /[a-z0-9_$]/i.test(char);
};

interface IOrderBy {
  columnName: string;
  sortType: 'DESC' | 'ASC';
}

const serializeOrderBy = (
  orderBy: IOrderBy[] | undefined,
  quoteIdentifier: (value: string) => string,
) => {
  if (!orderBy?.length) return '';

  const columns = orderBy.map(({ columnName, sortType }) => {
    const safeSortType = sortType === 'DESC' ? 'DESC' : 'ASC';

    return `${quoteIdentifier(columnName)} ${safeSortType}`;
  });

  return `ORDER BY ${columns.join(', ')}`;
};
