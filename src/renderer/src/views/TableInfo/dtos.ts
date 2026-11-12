import type { InitialWhere } from '@shared/types/database';
import type { TableInfoStoreApi } from '@renderer/stores/TableInfo';

export interface ITableInfoProps {
  id_connection: string;
  table: string;
  schema?: string;
  appTabId?: string;
  mode?: 'view' | 'create';
  draftTabId?: string;
  initialWhere?: InitialWhere;
  filterLocked?: boolean;
  initialTab?: string;
}

export interface ITableInfoViewProps extends ITableInfoProps {
  tableStore: TableInfoStoreApi;
}
