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
}
