import { createContext } from 'react';

import type {
  ConstraintType,
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
  ITriggerInfo,
} from '@renderer/contexts/Store';

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

export interface IPendingColumnCreate extends IColumnInfo {
  __pendingId: string;
}

export type IPendingColumnDrop = IColumnInfo;

export interface IPendingColumnChange extends IColumnInfo {
  __originalColumn: IColumnInfo;
}

export interface IPendingIndexCreate extends IIndexInfo {
  __pendingId: string;
}

export type IPendingIndexDrop = IIndexInfo;

export interface IPendingRestrictionCreate extends IColumnRestrictionsInfo {
  __pendingId: string;
  constraint_type: ConstraintType;
}

export type IPendingRestrictionDrop = IColumnRestrictionsInfo;

export interface IPendingReferenceCreate extends IColumnReferenceInfo {
  __pendingId: string;
}

export type IPendingReferenceDrop = IColumnReferenceInfo;

export interface ITableInfoContext extends ITableInfo {
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
  tableComment?: string;
  onApplied?: (table: string) => void;
}

export type LoadTableInfo = (idConnection: string, filters: ILoadTableInfoFilters) => Promise<void>;

export default createContext<ITableInfoContext>({} as ITableInfoContext);
