import React from 'react';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { sortRows } from '@renderer/utils/tableSort';

interface IUseFilteredSortedRowsParams<T> {
  rows: T[];
  filterText: string;
  sort: ITableSort[];
  getSearchValues: (row: T) => unknown[];
}

const serializeFilterTexts = (filterText: string) =>
  filterText
    .trim()
    .toLowerCase()
    .split(',')
    .map((text) => text.trim())
    .filter(Boolean);

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
        const normalizedValue = String(value ?? '').toLowerCase();

        return texts.some((text) => normalizedValue.includes(text));
      }),
    );

    return sortRows(filteredRows, sort);
  }, [filterText, getSearchValues, rows, sort]);
}
