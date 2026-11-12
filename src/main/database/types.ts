import type { StructureDialectDdl } from './structure/ddl/types';
import type { Knex } from 'knex';
import type { DatabaseRow, IConnectionDialectDescriptor, IOrderBy, SerializedRunSqlColumn, SerializedRunSqlResult } from '@shared/types/database';
import type { Dialect, IConnectionConfig } from '@shared/types/connections';
import type { QueryIdentifierRules } from './utils/querySources';
import type { FilterColumn } from './tableFilters/comparison';

export interface IConnection {
  id: string;
  instance: Knex<DatabaseRow, unknown[]>;
  dialect: Dialect;
}

export interface DatabaseDialectQueries {
  getTables(): string;
  getAllSchemas?(): string;
  getFunctions?(): string;
  getTableColumns(params: ITableWithSchema): string;
  getColumnTypes?(): string;
  getTableReferences(params: ITableWithSchema): string;
  getTableUsedAsReference(params: ITableWithSchema): string;
  getTableRestrictions(params: ITableWithSchema): string;
  getTotalRowsCountInTable(params: ITableWithSchema & { where?: string }): string;
  selectWithOffset(params: IGetTableDataParams): string;
  getTableDefinition(params: ITableWithSchema): string;
  getTableIndexes(params: ITableWithSchema): string;
  getTableTriggers(params: ITableWithSchema): string;
  getTableRules?(params: ITableWithSchema): string;
  getTableOwner?(params: ITableWithSchema): string;
  getSequences?(): string;
  getFunctionDefinition?(params: {
    schema: string;
    functionName: string;
    functionIdentityArguments?: string;
  }): string;
  getFunctionOwner?(params: { schema: string; functionName: string; functionIdentityArguments?: string }): string;
  getProcessList?(): string;
  cancelProcess?(pid: number): string;
}

export interface SerializeRunSqlContext {
  auto_paginated: boolean;
  execution_time_ms: number;
  statement?: string;
}

export interface ResolveRunSqlColumnsInfoContext {
  instance: Knex;
  dbConnection: object;
  sql: string;
  results: SerializedRunSqlResult[];
  columnTypes?: { name: string; type?: string }[];
}

export interface DatabaseDialectAdapter {
  structureDdl: StructureDialectDdl;
  id: Dialect;
  commonColumnTypes: readonly string[];
  staticColumnTypes?: readonly string[];
  indexMethods: readonly string[];
  columnEditing?: { canUseAutoIncrement(dataType: string): boolean };
  connectionDescriptor: IConnectionDialectDescriptor;
  client: Knex.Config['client'];
  queries: DatabaseDialectQueries;
  queryIdentifierRules?: QueryIdentifierRules;
  getConnectionConfig(config: IConnectionConfig): object;
  getKnexConfig?(config: IConnectionConfig): Partial<Knex.Config>;
  getRows<Row = DatabaseRow>(raw: unknown): Row[];
  serializeRunSqlResult(raw: unknown, context: SerializeRunSqlContext): SerializedRunSqlResult[];
  getExplainSql(sql: string): string;
  resolveRunSqlColumnsInfo?(
    context: ResolveRunSqlColumnsInfoContext,
  ): Promise<SerializedRunSqlResult[]>;
  resolveQueryColumnSources?(instance: Knex, columns: SerializedRunSqlColumn[]): Promise<SerializedRunSqlColumn[]>;
  splitStatements?(sql: string): string[];
  quoteIdentifier(value: string): string;
  getTableFilterColumns(instance: Knex, connection: object, target: ITableWithSchema, column?: string): Promise<FilterColumn[]>;
  beginTableFilterRequest?(connection: object): Promise<() => void>;
  resolveRowChangeTable(instance: Knex, table: ITableWithSchema): Promise<RowChangeTableIdentity>;
  // Conservative statement budget, not a claim about runtime/server limits.
  rowChangesInsertBindingBudget: number;
  // Count target rows even when the assigned values are unchanged.
  executeQueryUpdate(
    transaction: Knex.Transaction,
    sql: string,
    bindings: (string | number | boolean | null)[],
  ): Promise<number>;
  validateQueryUpdateTable?(transaction: Knex.Transaction, table: ITableWithSchema): Promise<void>;
  cancelQuery?(params: { instance: Knex; dbConnection: object }): Promise<boolean>;
}

export interface ITableWithSchema {
  table: string;
  schema?: string;
}

export interface RowChangeTableIdentity extends ITableWithSchema {
  identity?: string;
}

export interface IGetTableDataParams {
  table: string;
  schema?: string;
  limit?: number;
  actualPage?: number;
  where?: string;
  orderBy?: IOrderBy[];
}

export interface QueryRowUpdate {
  schema?: string;
  table: string;
  primaryKey: Record<string, string | number | boolean>;
  changes: DatabaseRow;
}
