import type { IOrderBy } from '../dialects/types';

export type { IOrderBy };

export const serializeOrderBy = (
  orderBy: IOrderBy[] | undefined,
  quoteIdentifier: (value: string) => string,
) => {
  if (!orderBy?.length) return '';

  const columns = orderBy.map(({ columnName, sortType }) => {
    const safeSortType = sortType === 'DESC' ? 'DESC' : 'ASC';

    return `${quoteIdentifier(columnName)} ${safeSortType}`;
  });

  return `ORDER BY ${columns.join(', ')}`;
};
