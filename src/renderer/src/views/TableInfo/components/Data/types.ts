import type { ITableContextMenuData } from '@renderer/components/Table';

export interface IContextMenuTable {
  data: ITableContextMenuData | null;
  position: {
    x: number;
    y: number;
  };
}
