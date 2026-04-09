export interface IColumn {
  label: string;
  attribute: string;
  resizable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  isFk?: boolean;
  type?: 'text' | 'number' | 'select';
  renderIcon?(): JSX.Element;
}
