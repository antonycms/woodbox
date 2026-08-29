import type { Knex } from 'knex';

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
  getFunctionDefinition?(params: { schema: string; functionName: string }): string;
}

export interface SerializedRunSqlColumn {
  name: string;
  type?: string;
}

export interface SerializedRunSqlResult {
  type: string;
  affected_rows?: number;
  auto_paginated?: boolean;
  execution_time_ms?: number;
  rows: any[];
  columns: string[];
  columns_info?: SerializedRunSqlColumn[];
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
  client: string;
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

export interface IOrderBy {
  columnName: string;
  sortType: 'DESC' | 'ASC';
}
