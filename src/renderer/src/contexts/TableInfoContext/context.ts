import { createContext } from 'react';

import type {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  ITriggerInfo,
} from '@renderer/contexts/Store';

export interface ITableInfo {
  columns: IColumnInfo[];
  references: IColumnReferenceInfo[];
  usedAsReference: IColumnReferenceInfo[];
  restrictions: IColumnRestrictionsInfo[];
  definition: string;
  triggers: ITriggerInfo[];
}

export type ILastFetchDate = {
  [key in keyof ITableInfo]: Date;
};

export type ITableInfoLoading = {
  [key in keyof ITableInfo]: boolean;
};

export interface ITableInfoContext extends ITableInfo {
  loadTableColumns: LoadTableInfo;
  loadTableReferences: LoadTableInfo;
  loadTableUsedAsReference: LoadTableInfo;
  loadTableRestrictions: LoadTableInfo;
  loadTableDefinition: LoadTableInfo;
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
