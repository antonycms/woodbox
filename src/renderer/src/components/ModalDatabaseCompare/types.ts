import type { DatabaseCompareItem as IDatabaseCompareItem } from '@shared/types/databaseCompare';
import type { IFunctionDb, ITable } from '@shared/types/database';

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
  title?: string;
  onClose(): void;
}

export interface IObjectsModalProps {
  show?: boolean;
  objects: DatabaseCompareSelectableObject[];
  supportsSchemas: boolean;
  selectedObjectSet: Set<string>;
  loading?: boolean;
  onClose(): void;
  onToggleGroup(objects: DatabaseCompareSelectableObject[]): void;
  onToggleObject(object: DatabaseCompareSelectableObject): void;
}
