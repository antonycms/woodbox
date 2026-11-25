import React from 'react';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { matchesSearchText, prepareSearchText } from '@renderer/utils/searchText';
import { sortRows } from '@renderer/utils/tableSort';

interface IUseFilteredSortedRowsParams<T> {
  rows: T[];
  filterText: string;
  sort: ITableSort[];
  getSearchValues: (row: T) => unknown[];
}

const serializeFilterTexts = (filterText: string) =>
  filterText
    .split(',')
    .map(prepareSearchText)
    .filter(({ normalized }) => normalized);

export function useFilteredSortedRows<T>({
  rows,
  filterText,
  sort,
  getSearchValues,
}: IUseFilteredSortedRowsParams<T>) {
  return React.useMemo(() => {
    const texts = serializeFilterTexts(filterText);

    if (!texts.length) return sortRows(rows, sort);

    const filteredRows = rows.filter((row) =>
      getSearchValues(row).some((value) => {
        const candidate = prepareSearchText(String(value ?? ''));

        return texts.some((text) => matchesSearchText(candidate, text));
      }),
    );

    return sortRows(filteredRows, sort);
  }, [filterText, getSearchValues, rows, sort]);
}
