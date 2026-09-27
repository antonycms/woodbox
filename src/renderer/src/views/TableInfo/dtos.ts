import type { TableInfoStoreApi } from '@renderer/stores/TableInfo';
import type { DatabaseObjectType } from '@shared/types/database';

export interface ITableInfoProps {
  id_connection: string;
  table: string;
  schema?: string;
  appTabId?: string;
  mode?: 'view' | 'create';
  draftTabId?: string;
  tableComment?: string;
  onCreateApplied?: (table: string) => void;
  initialWhere?: string;
  filterLocked?: boolean;
  initialTab?: string;
  objectType?: DatabaseObjectType;
  supportsIndexes?: boolean;
  supportsTriggers?: boolean;
}

export interface ITableInfoViewProps extends ITableInfoProps {
  tableStore: TableInfoStoreApi;
}
