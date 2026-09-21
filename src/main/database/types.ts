import type { Knex } from 'knex';
import type { IOrderBy, SerializedRunSqlResult } from '@shared/types/database';
import type { Dialect, IConnectionConfig } from '@shared/types/connections';

export interface IConnection {
  id: string;
  instance: Knex<any, unknown[]>;
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
  dbConnection: any;
  sql: string;
  results: SerializedRunSqlResult[];
}

export interface DatabaseDialectAdapter {
  id: Dialect;
  client: Knex.Config['client'];
  queries: DatabaseDialectQueries;
  getConnectionConfig(config: IConnectionConfig): object;
  getKnexConfig?(config: IConnectionConfig): Partial<Knex.Config>;
  getRows(raw: any): any[];
  serializeRunSqlResult(raw: any, context: SerializeRunSqlContext): SerializedRunSqlResult[];
  getExplainSql(sql: string): string;
  resolveRunSqlColumnsInfo?(
    context: ResolveRunSqlColumnsInfoContext,
  ): Promise<SerializedRunSqlResult[]>;
  splitStatements?(sql: string): string[];
  quoteIdentifier(value: string): string;
  cancelQuery?(params: { instance: Knex; dbConnection: any }): Promise<boolean>;
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
