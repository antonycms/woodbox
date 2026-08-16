export type Dialect = 'postgres' | 'mysql' | 'sqlite';

export interface DdlColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
  description?: string;
  udt_name?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  datetime_precision?: number;
  is_auto_increment?: boolean;
}

export interface DdlColumnChange extends DdlColumnInfo {
  __originalColumn: DdlColumnInfo;
}

export interface DdlRestrictionInfo {
  constraint_name: string;
  constraint_type?: 'primary_key' | 'unique_key' | 'check';
  constraint_definition?: string;
  column_names?: string[];
  expression?: string;
  comment?: string;
}

export interface DdlReferenceInfo {
  constraint_name: string;
  column_name: string;
  reference_table_schema?: string;
  reference_table_name: string;
  reference_column_name: string;
  constraint_definition?: string;
  comment?: string;
}

export interface DdlIndexInfo {
  index_name: string;
  index_method?: string;
  column_names?: string[];
  column_orders?: ('ASC' | 'DESC')[];
  columns?: DdlColumnInfo[];
}

export interface RendererDialectDdlHelpers {
  quoteIdent(value: string): string;
  quoteLiteral(value: string): string;
  getColumnType(column: DdlColumnInfo): string;
  getDefaultColumnType(column: DdlColumnInfo): string;
  getTableName(schema: string | undefined, table: string): string;
  normalizeOptionalString(value?: string): string | undefined;
}

export interface RendererDialectDdl {
  getColumnTypeDdl?(column: DdlColumnInfo, helpers: RendererDialectDdlHelpers): string;

  getColumnDefinitionDdl(column: DdlColumnInfo, helpers: RendererDialectDdlHelpers): string;

  getConstraintCommentDdl(
    tableName: string,
    constraintName: string,
    comment: string | undefined,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getColumnCommentDdl(
    tableName: string,
    columnName: string,
    comment: string | undefined,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getTableCommentDdl(
    tableName: string,
    comment: string | undefined,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getCreateTableDdl(
    tableName: string,
    columns: DdlColumnInfo[],
    restrictions: DdlRestrictionInfo[],
    helpers: RendererDialectDdlHelpers,
  ): string;

  getPostCreateTableRestrictionsDdl(
    tableName: string,
    restrictions: DdlRestrictionInfo[],
    helpers: RendererDialectDdlHelpers,
  ): string[];

  getAddColumnDdl(
    tableName: string,
    column: DdlColumnInfo,
    helpers: RendererDialectDdlHelpers,
    restrictions?: DdlRestrictionInfo[],
  ): string[];

  getPostCreateRestrictionAddColumnDdl(
    tableName: string,
    column: DdlColumnInfo,
    helpers: RendererDialectDdlHelpers,
  ): string[];

  getDropColumnDdl(
    tableName: string,
    columnName: string,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getDropAutoIncrementDdl?(
    tableName: string,
    column: DdlColumnInfo,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getDropConstraintDdl(
    tableName: string,
    constraint: DdlRestrictionInfo | DdlReferenceInfo | string,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getDropIndexDdl(
    schema: string | undefined,
    table: string,
    indexName: string,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getRestrictionDefinitionDdl(
    restriction: DdlRestrictionInfo,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getCreateRestrictionDdl(
    tableName: string,
    restriction: DdlRestrictionInfo,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getCreateConstraintFromDefinitionDdl(
    tableName: string,
    constraintName: string,
    definition: string,
    comment: string | undefined,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getCreateIndexDdl(
    schema: string | undefined,
    table: string,
    index: DdlIndexInfo,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getCreateReferenceDdl(
    tableName: string,
    reference: DdlReferenceInfo,
    helpers: RendererDialectDdlHelpers,
  ): string;

  getChangeColumnDdl(
    tableName: string,
    column: DdlColumnChange,
    helpers: RendererDialectDdlHelpers,
  ): string[];

  getPostCreateRestrictionChangeColumnDdl(
    tableName: string,
    column: DdlColumnChange,
    helpers: RendererDialectDdlHelpers,
  ): string[];
}

export interface RendererDialect {
  id: Dialect;
  label: string;
  editorDialect: Dialect;
  defaultPort?: number;
  connectionMode?: 'network' | 'file';
  supportsSsl?: boolean;
  supportsSchemas: boolean;
  supportsFunctions: boolean;
  supportsAutoIncrement: boolean;
  quoteIdent(value: string): string;
  getQualifiedName(schema: string | undefined, name: string): string;
  commonColumnTypes: string[];
  indexMethods?: string[];
  ddl: RendererDialectDdl;
}
