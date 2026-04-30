export interface IColumn<ColumnType = any> {
  label: string;
  attribute: Extract<keyof ColumnType, string>;
  resizable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  isLink?: boolean;
  type?: 'text' | 'number' | 'select';
  renderIcon?(): JSX.Element;
}
