import { createContext, type CSSProperties } from 'react';

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
  __pendingAction: 'create';
  __style?: CSSProperties;
  is_primary_key?: boolean;
  is_unique?: boolean;
}

export interface IPendingColumnDrop extends IColumnInfo {
  __pendingAction: 'drop';
  __style?: CSSProperties;
}

export interface IPendingIndexCreate extends IIndexInfo {
  __pendingId: string;
  __pendingAction: 'create';
  __style?: CSSProperties;
}

export interface IPendingIndexDrop extends IIndexInfo {
  __pendingAction: 'drop';
  __style?: CSSProperties;
}

export interface IPendingRestrictionCreate extends IColumnRestrictionsInfo {
  __pendingId: string;
  __pendingAction: 'create';
  __style?: CSSProperties;
  constraint_type: ConstraintType;
}

export interface IPendingRestrictionDrop extends IColumnRestrictionsInfo {
  __pendingAction: 'drop';
  __style?: CSSProperties;
}

export interface IPendingReferenceCreate extends IColumnReferenceInfo {
  __pendingId: string;
  __pendingAction: 'create';
  __style?: CSSProperties;
}

export interface IPendingReferenceDrop extends IColumnReferenceInfo {
  __pendingAction: 'drop';
  __style?: CSSProperties;
}

export interface ITableInfoContext extends ITableInfo {
  pendingColumns: IPendingColumnCreate[];
  pendingDroppedColumns: IPendingColumnDrop[];
  pendingIndexes: IPendingIndexCreate[];
  pendingDroppedIndexes: IPendingIndexDrop[];
  pendingRestrictions: IPendingRestrictionCreate[];
  pendingDroppedRestrictions: IPendingRestrictionDrop[];
  pendingReferences: IPendingReferenceCreate[];
  pendingDroppedReferences: IPendingReferenceDrop[];
  columnTypes: string[];

  addPendingColumn(column: IPendingColumnCreate): void;
  removePendingColumn(pendingId: string): void;
  addPendingDroppedColumns(columns: IColumnInfo[]): void;
  removePendingDroppedColumns(columnNames: string[]): void;

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
  openPendingChangesSqlModal(idConnection: string, filters: ILoadTableInfoFilters): void;

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

export type LoadTableInfo = (idConnection: string, filters: ILoadTableInfoFilters) => Promise<void>;

export default createContext<ITableInfoContext>({} as ITableInfoContext);
