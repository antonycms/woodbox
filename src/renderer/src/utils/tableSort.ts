import type { ITableSort } from '@renderer/components/Table/dtos';

export const getNextSort = (
  currentSort: ITableSort[] = [],
  columnName: string,
): ITableSort[] => {
  const sortIndex = currentSort.findIndex((item) => item.columnName === columnName);

  if (sortIndex === -1) {
    return [...currentSort, { columnName, sortType: 'ASC' }];
  }

  const nextSort = [...currentSort];
  const currentItem = nextSort[sortIndex];

  if (currentItem.sortType === 'ASC') {
    nextSort[sortIndex] = { ...currentItem, sortType: 'DESC' };
    return nextSort;
  }

  nextSort.splice(sortIndex, 1);
  return nextSort;
};
