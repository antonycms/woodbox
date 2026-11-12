import { getStructureOptions, getColumnGridPresentation, getColumnAutoIncrementSupport } from './structure/columns';
import { prepareInitialWhere as prepareInitialWhereValue, readInitialWhere as readInitialWhereValue } from './tableFilters';
import { getConnection } from './connections';
import { getDialectAdapter, getDialectIds, getDialectCapabilities } from './dialects';
import type { DatabaseCompareParams } from '@shared/types/databaseCompare';
import type {
  IDatabaseDialectInfo,
  ColumnTypeSuggestionsResult,
  IDatabaseProcess,
  ITable,
  IFunctionDb,
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
  ITriggerInfo,
  IParamsGetTableData,
  IParamsGetTableRowsCount,
} from '@shared/types/database';
import type { IConnection, ITableWithSchema } from './types';
import { compareDatabases as compareDatabasesCore } from './compare';
import { saveRowChanges as saveConnectionRowChanges } from './rowChanges';
import type { RowChangesIntent } from '@shared/types/rowChanges';
import { isReadOnlySelectQuery } from './utils/sql';

export const getProcessList = async (connectionId: string) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  if (!query.getProcessList) return [];

  const raw = await instance.raw(query.getProcessList());

  return adapter.getRows<IDatabaseProcess>(raw);
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

export const getDialects = (): IDatabaseDialectInfo[] =>
  getDialectIds().map((id) => {
    const adapter = getDialectAdapter(id);
    return {
      id,
      ...adapter.connectionDescriptor,
      ...getDialectCapabilities(adapter),
      ...getStructureOptions(adapter),
    };
  });

export const saveRowChanges = async (connectionId: string, intent: RowChangesIntent) => {
  const connection = await getConnection(connectionId);
  return saveConnectionRowChanges(connection, getDialectAdapter(connection.dialect), intent);
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

  const tables = adapter.getRows<ITable>(tablesRaw);
  const schemas = schemasRaw
    ? adapter.getRows<{ schema_name: string }>(schemasRaw).map((row) => row?.schema_name)
    : undefined;
  const functions = functionsRaw ? adapter.getRows<IFunctionDb>(functionsRaw) : [];
  const supportsTableComments = ['postgres', 'mysql'].includes(connection.dialect);

  return { tables, schemas, functions, dialect: connection.dialect, ...getDialectCapabilities(adapter), ...getStructureOptions(adapter), supports_table_comments: supportsTableComments };
};

const readTableColumns = async (connection: IConnection, { table, schema }: ITableWithSchema) => {
  const adapter = getDialectAdapter(connection.dialect);
  const raw = await connection.instance.raw(adapter.queries.getTableColumns({ table, schema }));
  return adapter.getRows<IColumnInfo>(raw);
};
export const getTableColumns = async (connectionId: string, filters: ITableWithSchema) =>
  readTableColumns(await getConnection(connectionId), filters);

export const getColumnGridData = async (connectionId: string, filters: ITableWithSchema) => {
  const connection = await getConnection(connectionId);
  const adapter = getDialectAdapter(connection.dialect);
  const columns = await readTableColumns(connection, filters);
  return { rows: columns.map((column) => ({ ...column,
    display_type: getColumnGridPresentation(column).typeText,
    auto_increment_eligible: !adapter.columnEditing || adapter.columnEditing.canUseAutoIncrement(column.data_type),
  })) };
};

export const getColumnTypes = async (connectionId: string): Promise<ColumnTypeSuggestionsResult> => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const staticTypes = getStructureOptions(adapter).columnTypeSuggestions;
  if (staticTypes) return staticTypes;

  const sql = query.getColumnTypes?.();
  if (!sql) throw new Error('Esta conexão não oferece um catálogo de tipos.');
  const raw = await instance.raw(sql);
  const types = adapter.getRows<{ name: string }>(raw);
  const typeNames = [...new Set([...adapter.commonColumnTypes, ...types.map((item) => item.name)])].filter(Boolean);
  const autoIncrementSupport = getColumnAutoIncrementSupport({ policyId: dialect, dataTypes: typeNames });

  return {
    types,
    commonTypes: [...adapter.commonColumnTypes],
    autoIncrementTypes: Object.fromEntries(typeNames.map((type, index) => [type, autoIncrementSupport[index]])),
  };
};

export const getTableReferences = async (connectionId: string, { table, schema }: ITableWithSchema) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableReferences({ table, schema }));

  return adapter.getRows<IColumnReferenceInfo>(raw);
};

export const getTableUsedAsReference = async (connectionId: string, { table, schema }: ITableWithSchema) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableUsedAsReference({ table, schema }));

  return adapter.getRows<IColumnReferenceInfo>(raw);
};

export const getTableRestrictions = async (connectionId: string, { table, schema }: ITableWithSchema) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableRestrictions({ table, schema }));

  return adapter.getRows<IColumnRestrictionsInfo>(raw);
};

export const getTableDefinition = async (connectionId: string, { table, schema }: ITableWithSchema) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableDefinition({ table, schema }));

  return adapter.getRows<{ definition: string }>(raw);
};

export const getTableIndexes = async (connectionId: string, { table, schema }: ITableWithSchema) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableIndexes({ table, schema }));

  return adapter.getRows<IIndexInfo>(raw);
};

export const getTableTriggers = async (connectionId: string, { table, schema }: ITableWithSchema) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;

  const adapter = getDialectAdapter(dialect);
  const query = adapter.queries;

  const raw = await instance.raw(query.getTableTriggers({ table, schema }));

  return adapter.getRows<ITriggerInfo>(raw);
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

  return adapter.getRows<{ definition: string }>(raw);
};


export const compareDatabases = async (params: DatabaseCompareParams) => {
  return compareDatabasesCore(params, getConnection);
};

/**
 * return table rows with pagination.
 */
export const prepareInitialWhere = async (connectionId: string, request: import('@shared/types/database').PrepareInitialWhereRequest) => {
  const connection = await getConnection(connectionId);
  return prepareInitialWhereValue(connection, getDialectAdapter(connection.dialect), request);
};
export const readInitialWhere = async (connectionId: string, request: import('@shared/types/database').ReadInitialWhereRequest) => {
  const connection = await getConnection(connectionId);
  return readInitialWhereValue(connection, getDialectAdapter(connection.dialect), request);
};

export const getTableData = async (
  connectionId: string,
  {
    table,
    schema,
    page = 1,
    limit = 200,
    where,
    orderBy,
  }: IParamsGetTableData,
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
  { table, schema, where }: IParamsGetTableRowsCount,
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
