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
