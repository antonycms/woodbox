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
  original: DdlColumnInfo;
}

export interface DdlRestrictionInfo {
  constraint_name: string;
  constraint_type?: 'primary_key' | 'unique_key' | 'check' | 'exclusion';
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

export interface StructureDialectDdlHelpers {
  getAutoIncrementRestriction(name: string): DdlRestrictionInfo | undefined;
  quoteIdent(value: string): string;
  quoteLiteral(value: string): string;
  getColumnType(column: DdlColumnInfo): string;
  getDefaultColumnType(column: DdlColumnInfo): string;
  getTableName(schema: string | undefined, table: string): string;
  normalizeOptionalString(value?: string): string | undefined;
}

export interface StructureDialectDdl {
  getColumnTypeDdl?(column: DdlColumnInfo, helpers: StructureDialectDdlHelpers): string;

  getColumnDefinitionDdl(column: DdlColumnInfo, helpers: StructureDialectDdlHelpers): string;

  getConstraintCommentDdl(
    tableName: string,
    constraintName: string,
    comment: string | undefined,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getColumnCommentDdl(
    tableName: string,
    columnName: string,
    comment: string | undefined,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getTableCommentDdl(
    tableName: string,
    comment: string | undefined,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getRenameTableDdl(
    schema: string | undefined,
    table: string,
    newTable: string,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getCreateTableDdl(
    tableName: string,
    columns: DdlColumnInfo[],
    restrictions: DdlRestrictionInfo[],
    helpers: StructureDialectDdlHelpers,
  ): string;

  getPostCreateTableRestrictionsDdl(
    tableName: string,
    restrictions: DdlRestrictionInfo[],
    helpers: StructureDialectDdlHelpers,
  ): string[];

  getAddColumnDdl(
    tableName: string,
    column: DdlColumnInfo,
    helpers: StructureDialectDdlHelpers,
    restrictions?: DdlRestrictionInfo[],
  ): string[];

  getPostCreateRestrictionAddColumnDdl(
    tableName: string,
    column: DdlColumnInfo,
    helpers: StructureDialectDdlHelpers,
  ): string[];

  getDropColumnDdl(
    tableName: string,
    columnName: string,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getDropAutoIncrementDdl?(
    tableName: string,
    column: DdlColumnInfo,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getDropConstraintDdl(
    tableName: string,
    constraint: DdlRestrictionInfo | DdlReferenceInfo | string,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getDropIndexDdl(
    schema: string | undefined,
    table: string,
    indexName: string,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getRestrictionDefinitionDdl(
    restriction: DdlRestrictionInfo,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getCreateRestrictionDdl(
    tableName: string,
    restriction: DdlRestrictionInfo,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getCreateConstraintFromDefinitionDdl(
    tableName: string,
    constraintName: string,
    definition: string,
    comment: string | undefined,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getCreateIndexDdl(
    schema: string | undefined,
    table: string,
    index: DdlIndexInfo,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getCreateReferenceDdl(
    tableName: string,
    reference: DdlReferenceInfo,
    helpers: StructureDialectDdlHelpers,
  ): string;

  getChangeColumnDdl(
    tableName: string,
    column: DdlColumnChange,
    helpers: StructureDialectDdlHelpers,
  ): string[];

  getPostCreateRestrictionChangeColumnDdl(
    tableName: string,
    column: DdlColumnChange,
    helpers: StructureDialectDdlHelpers,
  ): string[];
}


import type { StructureColumn } from '@shared/types/databaseDdl';
export interface StructureColumnChange extends StructureColumn { original: StructureColumn }
export interface StructureDialect {
  quoteIdent(value: string): string;
  getQualifiedName(schema: string | undefined, table: string): string;
  ddl: StructureDialectDdl;
}
