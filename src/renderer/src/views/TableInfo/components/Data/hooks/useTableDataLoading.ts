import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { useDatabaseStore } from '@renderer/stores/Database';
import { getNextSort } from '@renderer/utils/tableSort';
import { generateHash } from '@shared/utils/string';

interface UseTableDataLoadingParams {
  idConnection: string;
  schema: string;
  table: string;
  initialWhere?: string;
  onDataError: (error: unknown) => void;
}

export const useTableDataLoading = ({
  idConnection,
  schema,
  table,
  initialWhere,
  onDataError,
}: UseTableDataLoadingParams) => {
  const { getTableData, getTableRowsCount } = useDatabaseStore(
    useShallow((state) => ({
      getTableData: state.getTableData,
      getTableRowsCount: state.getTableRowsCount,
    })),
  );

  const [items, setItems] = React.useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingRowsCount, setLoadingRowsCount] = React.useState(false);
  const [rowsCount, setRowsCount] = React.useState<number>();
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [lastFetchDate, setLastFetchDate] = React.useState(new Date());
  const [whereInput, setWhereInput] = React.useState(initialWhere || '');
  const [appliedWhere, setAppliedWhere] = React.useState(initialWhere || '');
  const lastPageSearch = React.useRef(page);

  const serializeRows = React.useCallback(
    (rows: Record<string, unknown>[]) =>
      rows.map((row) => ({
        ...row,
        __table_hash_item: `row_${generateHash()}`,
      })),
    [],
  );

  const handleLoadRowsCount = React.useCallback(async () => {
    if (loadingRowsCount) return;

    setLoadingRowsCount(true);

    try {
      const total = await getTableRowsCount(idConnection, {
        schema,
        table,
        where: appliedWhere || undefined,
      });

      setRowsCount(total);
    } catch (error: unknown) {
      onDataError(error);
    } finally {
      setLoadingRowsCount(false);
    }
  }, [
    idConnection,
    schema,
    table,
    appliedWhere,
    loadingRowsCount,
    getTableRowsCount,
    onDataError,
  ]);

  const loadData = React.useCallback(async () => {
    const newPage = page + 1;

    if (loading || newPage === lastPageSearch.current) return;

    setLoading(true);

    try {
      const { data } = await getTableData(idConnection, {
        schema,
        table,
        page: newPage,
        where: appliedWhere || undefined,
        orderBy: sort,
      });

      setLastFetchDate(new Date());

      lastPageSearch.current = newPage;

      if (!data.length) return;

      setPage(newPage);
      setItems((prevState) => [...prevState, ...serializeRows(data)]);
    } catch (error: unknown) {
      onDataError(error);
    } finally {
      setLoading(false);
    }
  }, [
    idConnection,
    loading,
    schema,
    table,
    page,
    appliedWhere,
    sort,
    getTableData,
    serializeRows,
    onDataError,
  ]);

  const refreshData = React.useCallback(
    async (beforeApplyRows?: () => void) => {
      if (loading) return;

      setLoading(true);
      setRowsCount(undefined);

      try {
        const { data } = await getTableData(idConnection, {
          schema,
          table,
          page: 1,
          where: appliedWhere || undefined,
          orderBy: sort,
        });

        lastPageSearch.current = 1;
        setPage(1);
        setLastFetchDate(new Date());
        beforeApplyRows?.();
        setItems(serializeRows(data));
      } catch (error: unknown) {
        onDataError(error);
      } finally {
        setLoading(false);
      }
    },
    [idConnection, loading, schema, table, appliedWhere, sort, getTableData, serializeRows, onDataError],
  );

  const sortData = React.useCallback(
    async (column: IColumn, sortType: ISortDirection | null | undefined, beforeApplyRows?: () => void) => {
      if (loading || !column.sortable) return;

      const nextSort = getNextSort(sort, column.attribute, sortType);
      setLoading(true);

      try {
        const { data } = await getTableData(idConnection, {
          schema,
          table,
          page: 1,
          where: appliedWhere || undefined,
          orderBy: nextSort,
        });

        setSort(nextSort);
        beforeApplyRows?.();
        setItems(serializeRows(data));
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } catch (error: unknown) {
        onDataError(error);
      } finally {
        setLoading(false);
      }
    },
    [idConnection, schema, table, appliedWhere, sort, loading, getTableData, serializeRows, onDataError],
  );

  const applyFilterData = React.useCallback(
    async (nextWhereInput: string, beforeApplyRows?: () => void) => {
      if (loading) return;

      const newWhere = nextWhereInput || undefined;
      setLoading(true);
      setWhereInput(nextWhereInput);

      try {
        const { data } = await getTableData(idConnection, {
          schema,
          table,
          page: 1,
          where: newWhere,
          orderBy: sort,
        });

        setAppliedWhere(nextWhereInput);
        setRowsCount(undefined);
        beforeApplyRows?.();
        setItems(serializeRows(data));
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } catch (error: unknown) {
        onDataError(error);
      } finally {
        setLoading(false);
      }
    },
    [getTableData, idConnection, loading, onDataError, schema, serializeRows, sort, table],
  );

  return {
    items,
    loading,
    loadingRowsCount,
    rowsCount,
    sort,
    lastFetchDate,
    whereInput,
    appliedWhere,
    setWhereInput,
    handleLoadRowsCount,
    loadData,
    refreshData,
    sortData,
    applyFilterData,
  };
};
