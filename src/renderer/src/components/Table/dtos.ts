export interface IColumn<ColumnType = any> {
  label: string;
  attribute: keyof ColumnType;
  resizable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  isLink?: boolean;
  type?: 'text' | 'number' | 'select';
  renderIcon?(): JSX.Element;
}
