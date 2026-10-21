import type { Knex } from 'knex';
import type { DatabaseRow, IOrderBy, SerializedRunSqlColumn, SerializedRunSqlResult } from '@shared/types/database';
import type { Dialect, IConnectionConfig } from '@shared/types/connections';
import type { QueryIdentifierRules } from './utils/querySources';

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
  getColumnTypes(): string;
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
}

export interface DatabaseDialectAdapter {
  id: Dialect;
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

export interface IGetTableDataParams {
  table: string;
  schema?: string;
  limit?: number;
  actualPage?: number;
  where?: string;
  orderBy?: IOrderBy[];
}
