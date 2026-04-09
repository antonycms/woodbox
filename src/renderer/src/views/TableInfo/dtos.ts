export interface ITableInfoProps {
  id_connection: string;
  table: string;
  schema?: string;
  initialWhere?: string;
  filterLocked?: boolean;
  initialTab?: string;
}
