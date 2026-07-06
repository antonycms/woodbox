import type { ISortDirection, ITableSort } from '@renderer/components/Table/dtos';

export const getNextSort = (
  currentSort: ITableSort[] = [],
  columnName: string,
  sortType?: ISortDirection | null,
): ITableSort[] => {
  const sortIndex = currentSort.findIndex((item) => item.columnName === columnName);

  if (sortType === null) {
    return currentSort.filter((item) => item.columnName !== columnName);
  }

  if (sortType) {
    if (sortIndex === -1) {
      return [...currentSort, { columnName, sortType }];
    }

    const nextSort = [...currentSort];
    nextSort[sortIndex] = { ...nextSort[sortIndex], sortType };
    return nextSort;
  }

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

const compareValues = (a: any, b: any): number => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

export const sortRows = <Row extends Record<string, any>>(
  rows: Row[],
  sort: ITableSort[] = [],
): Row[] => {
  if (!sort.length) return rows;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const sortItem of sort) {
        const aValue = a.row[sortItem.columnName];
        const bValue = b.row[sortItem.columnName];
        const aIsEmpty = aValue === null || aValue === undefined;
        const bIsEmpty = bValue === null || bValue === undefined;

        if (aIsEmpty && bIsEmpty) continue;
        if (aIsEmpty) return 1;
        if (bIsEmpty) return -1;

        const result = compareValues(aValue, bValue);

        if (result !== 0) {
          return sortItem.sortType === 'ASC' ? result : result * -1;
        }
      }

      return a.index - b.index;
    })
    .map((item) => item.row);
};
