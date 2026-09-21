import type {
  ConstraintType,
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
} from '@shared/types/database';

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
