export type ISortDirection = 'ASC' | 'DESC';

export interface ITableSort {
  columnName: string;
  sortType: ISortDirection;
}

export interface IColumn<ColumnType = any> {
  title?: string;
  label: string;
  info?: string;
  attribute: Extract<keyof ColumnType, string>;
  resizable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  isLink?: boolean;
  type?: 'text' | 'number' | 'autocomplete' | 'autocomplete-multi';
  dataAutocomplete?: string[];
  renderIcon?(): React.ReactElement;
}

export type TableCellEditValue = string | number | (string | number)[];
export type TableScrollState = { left: number; top: number };
export type TableCellPosition = { rowIndex: number; colIndex: number };
export type TableSearchOverlayPosition = { top: number; right: number };
export type TableSearchOptions = { matchCase: boolean; wholeWord: boolean };
export type TableSearchOccurrence = TableCellPosition & { key: string; canReplace: boolean };
export type TableSearchState = TableSearchOptions & {
  open: boolean;
  replaceOpen: boolean;
  query: string;
  replace: string;
  activeIndex: number;
};
export type TableDragSelectionState = {
  mode: 'default' | 'analysis';
  anchor: TableCellPosition;
  hasMoved: boolean;
};

export type TableSerializedRow<Row = any> = Row & {
  __index_row: number;
  __row_index?: number;
  __key_row: React.Key;
  __is_new_row?: boolean;
  __is_removed?: boolean;
  [key: string]: any;
};

export type TableCellValueResolver<Row = any> = (
  row: TableSerializedRow<Row> | undefined,
  column?: IColumn<Row>,
) => any;

export type TableMutableRef<Value> = {
  current: Value;
};
