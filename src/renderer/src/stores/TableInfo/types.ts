import type {
  IPendingColumnCreate,
  IPendingColumnDrop,
  IPendingColumnChange,
  IPendingIndexCreate,
  IPendingIndexDrop,
  IPendingRestrictionCreate,
  IPendingRestrictionDrop,
  IPendingReferenceCreate,
  IPendingReferenceDrop,
} from '@renderer/database/ddl/types';
import type { RendererDialect } from '@renderer/database/dialects';
import type {
  DatabaseObjectType,
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
  ITriggerInfo,
} from '@shared/types/database';

export interface ITableInfo {
  columns: IColumnInfo[];
  references: IColumnReferenceInfo[];
  usedAsReference: IColumnReferenceInfo[];
  restrictions: IColumnRestrictionsInfo[];
  definition: string;
  indexes: IIndexInfo[];
  triggers: ITriggerInfo[];
}

export type ILastFetchDate = {
  [key in keyof ITableInfo]: Date;
};

export type ITableInfoLoading = {
  [key in keyof ITableInfo]: boolean;
};

export interface ITableInfoStore extends ITableInfo {
  pendingDdlSql: string;
  showPendingDdlModal: boolean;
  applyingPendingDdl: boolean;
  pendingConnectionId?: string;
  tableContext: ITableContextState;
  tableProperties: ITablePropertiesState;
  tableAppliedHandler?: (table: string) => void;
  setTableContext(context: Partial<ITableContextState>): void;
  setTableAppliedHandler(handler?: (table: string) => void): void;
  setTableProperties(properties: Partial<ITablePropertiesState>): void;
  markTablePropertiesApplied(tableName: string): void;
  closePendingDdlModal(): void;
  applyPendingChangesSql(sql: string): Promise<void>;

  pendingColumns: IPendingColumnCreate[];
  pendingDroppedColumns: IPendingColumnDrop[];
  pendingChangedColumns: IPendingColumnChange[];
  pendingIndexes: IPendingIndexCreate[];
  pendingDroppedIndexes: IPendingIndexDrop[];
  pendingRestrictions: IPendingRestrictionCreate[];
  pendingDroppedRestrictions: IPendingRestrictionDrop[];
  pendingReferences: IPendingReferenceCreate[];
  pendingDroppedReferences: IPendingReferenceDrop[];
  columnTypes: string[];

  addPendingColumn(column: IPendingColumnCreate): void;
  updatePendingColumn(pendingId: string, column: Partial<IColumnInfo>): void;
  removePendingColumn(pendingId: string): void;
  addPendingDroppedColumns(columns: IColumnInfo[]): void;
  removePendingDroppedColumns(columnNames: string[]): void;
  addPendingChangedColumn(column: IColumnInfo, changes: Partial<IColumnInfo>): void;
  removePendingChangedColumns(columnNames: string[]): void;

  addPendingIndex(index: IPendingIndexCreate): void;
  removePendingIndex(pendingId: string): void;
  addPendingDroppedIndexes(indexes: IIndexInfo[]): void;
  removePendingDroppedIndexes(indexNames: string[]): void;

  addPendingRestriction(restriction: IPendingRestrictionCreate): void;
  removePendingRestriction(pendingId: string): void;
  addPendingDroppedRestrictions(restrictions: IColumnRestrictionsInfo[]): void;
  removePendingDroppedRestrictions(constraintNames: string[]): void;

  addPendingReference(reference: IPendingReferenceCreate): void;
  removePendingReference(pendingId: string): void;
  addPendingDroppedReferences(references: IColumnReferenceInfo[]): void;
  removePendingDroppedReferences(constraintNames: string[]): void;

  clearPendingChanges(): void;
  loadColumnTypes(idConnection: string): Promise<void>;
  openPendingChangesSqlModal(
    idConnection: string,
    filters: ILoadTableInfoFilters,
    options?: IOpenPendingChangesSqlModalOptions,
  ): void;

  loadTableColumns: LoadTableInfo;
  loadTableReferences: LoadTableInfo;
  loadTableUsedAsReference: LoadTableInfo;
  loadTableRestrictions: LoadTableInfo;
  loadTableDefinition: LoadTableInfo;
  loadTableIndexes: LoadTableInfo;
  loadTableTriggers: LoadTableInfo;

  lastFetchDate: ILastFetchDate;
  loading: ITableInfoLoading;
}

export interface ILoadTableInfoFilters {
  table: string;
  schema: string;
}

export interface IOpenPendingChangesSqlModalOptions {
  mode?: 'view' | 'create';
  onApplied?: (table: string) => void;
}

export interface ITablePropertiesState {
  tableName: string;
  originalTableName: string;
  comment: string;
  originalComment: string;
  supportsTableComments: boolean;
}

export interface ITableContextState {
  idConnection: string;
  schema: string;
  table: string;
  mode: 'view' | 'create';
  objectType: DatabaseObjectType;
  supportsIndexes: boolean;
  supportsTriggers: boolean;
  supportsTableComments: boolean;
  dialect: RendererDialect;
}

export type LoadTableInfo = (idConnection: string, filters: ILoadTableInfoFilters) => Promise<void>;
