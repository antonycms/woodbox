import { AvalailableTreeViewIcon } from '@renderer/components/TreeView/IconItemTreeView';

export type ICentralSearchItemType = 'script' | 'table' | 'function';

export interface IParsedSearch {
  filter: string;
  argument?: string;
}

export type ICentralSearchRow =
  | { type: 'section'; title: string }
  | { type: 'item'; item: ICentralSearchItem; itemIndex: number };

export interface ICentralSearchItem {
  id: string;
  tabId: string;
  type: ICentralSearchItemType;
  title: string;
  searchableTitle: string;
  search: string;
  connectionDescription: string;
  icon: AvalailableTreeViewIcon;
  tableRef?: {
    idConnection: string;
    schema?: string;
    table: string;
  };
  isOpen?: boolean;
  isActive?: boolean;
  onOpen(argument?: string): void;
}
