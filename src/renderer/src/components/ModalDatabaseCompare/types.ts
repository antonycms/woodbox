import type {
  IDatabaseCompareItem,
  IFunctionDb,
  ITable,
} from '@renderer/contexts/Store';

export interface IModalDatabaseCompareProps {
  show?: boolean;
  onClose?(): void;
}

export type DatabaseCompareSelectableObject =
  | {
      type: 'table';
      schema?: string;
      name: string;
      table: ITable;
    }
  | {
      type: 'function';
      schema?: string;
      name: string;
      functionIdentityArguments?: string;
      function: IFunctionDb;
    };

export type ObjectGroup = {
  schema?: string;
  label: string;
  objects: DatabaseCompareSelectableObject[];
};

export interface IDdlModalProps {
  item?: IDatabaseCompareItem;
  onClose(): void;
}

export interface IObjectsModalProps {
  show?: boolean;
  filterText: string;
  groups: ObjectGroup[];
  selectedObjectSet: Set<string>;
  collapsedSchemaSet: Set<string>;
  loading?: boolean;
  onClose(): void;
  onFilterTextChange(value: string): void;
  onToggleGroup(objects: DatabaseCompareSelectableObject[]): void;
  onToggleObject(object: DatabaseCompareSelectableObject): void;
  onToggleSchemaVisibility(groupKey: string): void;
}
