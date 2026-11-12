import type { InitialWhere, IParamsGetTableData, PreparedInitialWhere } from '@shared/types/database';
import { filterPreparationError, isInitialWhereValue } from '@renderer/database/tableFilters';
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
  initialWhere?: InitialWhere;
  onDataError: (error: unknown) => void;
}

export const useTableDataLoading = ({
  idConnection,
  schema,
  table,
  initialWhere,
  onDataError,
}: UseTableDataLoadingParams) => {
  const { getTableData, getTableRowsCount, prepareInitialWhere } = useDatabaseStore(
    useShallow((state) => ({
      getTableData: state.getTableData,
      getTableRowsCount: state.getTableRowsCount,
      prepareInitialWhere: state.prepareInitialWhere,
    })),
  );

  const [items, setItems] = React.useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [resultRevision, setResultRevision] = React.useState(0);
  const [loadingRowsCount, setLoadingRowsCount] = React.useState(false);
  const [rowsCount, setRowsCount] = React.useState<number>();
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [lastFetchDate, setLastFetchDate] = React.useState(new Date());
  const initialText = typeof initialWhere === 'string' ? initialWhere : '';
  const [whereInput, setWhereInputText] = React.useState(initialText);
  const [appliedWhere, setAppliedWhere] = React.useState(initialText);
  const [filterPreparing, setFilterPreparing] = React.useState(!!initialWhere && typeof initialWhere !== 'string');
  const appliedWhereRef = React.useRef(initialText);
  const resolved = React.useRef(typeof initialWhere === 'string' || initialWhere === undefined);
  const draftEdited = React.useRef(false);
  const initialPreparation = React.useRef<Promise<PreparedInitialWhere> | undefined>(undefined);
  const setWhereInput = React.useCallback((value: string) => {
    draftEdited.current = true;
    setWhereInputText(value);
  }, []);
  const lastPageSearch = React.useRef(page);

  const scopeRef = React.useRef({ idConnection, schema, table, active: true,
    dataToken: undefined as object | undefined, countToken: undefined as object | undefined });
  if (scopeRef.current.idConnection !== idConnection || scopeRef.current.schema !== schema || scopeRef.current.table !== table) {
    scopeRef.current = { idConnection, schema, table, active: true, dataToken: undefined, countToken: undefined };
  }
  const scope = scopeRef.current;

  const beginRequest = React.useCallback((count = false) => {
    if (scopeRef.current !== scope || !scope.active) return;
    const token = {};
    const key = count ? 'countToken' : 'dataToken';
    scope[key] = token;
    return () => scopeRef.current === scope && scope.active && scope[key] === token;
  }, [scope]);

  const condition = React.useCallback(() => ({ where: appliedWhereRef.current || undefined }), []);
  const needsInitialWhere = () => !resolved.current;

  const resolveInitialWhere = React.useCallback(async (isCurrent: () => boolean) => {
    try {
      if (!isInitialWhereValue(initialWhere)) throw filterPreparationError('invalid-filter');
      if (!initialPreparation.current) {
        const promise = prepareInitialWhere(idConnection, { ...initialWhere, schema, table });
        initialPreparation.current = promise;
        void promise.catch(() => { if (initialPreparation.current === promise) initialPreparation.current = undefined; });
      }
      const result = await initialPreparation.current;
      if (isCurrent() && !resolved.current) {
        resolved.current = true;
        appliedWhereRef.current = result.where;
        setAppliedWhere((previous) => isCurrent() ? result.where : previous);
        if (!draftEdited.current) setWhereInputText((previous) => isCurrent() ? result.where : previous);
      }
      return result;
    } finally {
      if (isCurrent()) setFilterPreparing(false);
    }
  }, [idConnection, schema, table, initialWhere, prepareInitialWhere]);

  const readData = React.useCallback(async (params: IParamsGetTableData, isCurrent: () => boolean) => {
    if (needsInitialWhere()) await resolveInitialWhere(isCurrent);
    if (!isCurrent()) return { data: [] };
    const { where: _where, ...readParams } = params;
    return getTableData(idConnection, { ...readParams, ...condition() });
  }, [idConnection, getTableData, resolveInitialWhere, condition]);

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

    const isCurrent = beginRequest(true);
    if (!isCurrent) return;
    setLoadingRowsCount(true);

    try {
      if (needsInitialWhere()) await resolveInitialWhere(isCurrent);
      if (!isCurrent()) return;
      const total = await getTableRowsCount(idConnection, {
        schema,
        table,
        ...condition(),
      });

      setRowsCount((previous) => isCurrent() ? total : previous);
    } catch (error: unknown) {
      if (isCurrent()) onDataError(error);
    } finally {
      if (isCurrent()) setLoadingRowsCount((previous) => isCurrent() ? false : previous);
    }
  }, [
    idConnection,
    schema,
    table,
    appliedWhere,
    loadingRowsCount,
    getTableRowsCount,
    beginRequest,
    condition,
    resolveInitialWhere,
    sort,
    onDataError,
  ]);

  const loadData = React.useCallback(async () => {
    const newPage = page + 1;

    if (loading || newPage === lastPageSearch.current) return;

    const isCurrent = beginRequest();
    if (!isCurrent) return;
    setLoading(true);

    try {
      if (!isCurrent()) return;
      const { data } = await readData({
        schema,
        table,
        page: newPage,
        ...condition(),
        orderBy: sort,
      }, isCurrent);

      if (!isCurrent()) return;
      setLastFetchDate((previous) => isCurrent() ? new Date() : previous);

      lastPageSearch.current = newPage;

      if (!data.length) return;

      setPage((previous) => isCurrent() ? newPage : previous);
      setItems((prevState) => isCurrent() ? [...prevState, ...serializeRows(data)] : prevState);
    } catch (error: unknown) {
      if (isCurrent()) onDataError(error);
    } finally {
      if (isCurrent()) setLoading((previous) => isCurrent() ? false : previous);
    }
  }, [
    idConnection,
    loading,
    schema,
    table,
    page,
    appliedWhere,
    sort,
    readData,
    beginRequest,
    condition,
    serializeRows,
    onDataError,
  ]);

  const refreshData = React.useCallback(
    async (beforeApplyRows?: () => void) => {
      if (loading) return;

      const isCurrent = beginRequest();
      if (!isCurrent) return;
      scope.countToken = undefined;
      setLoadingRowsCount((previous) => isCurrent() && !scope.countToken ? false : previous);
      setLoading(true);
      setResultRevision((previous) => previous + 1);
      setRowsCount(undefined);

      try {
        if (!isCurrent()) return;
        const { data } = await readData({
          schema,
          table,
          page: 1,
          ...condition(),
          orderBy: sort,
        }, isCurrent);

        if (!isCurrent()) return;
        lastPageSearch.current = 1;
        setPage((previous) => isCurrent() ? 1 : previous);
        setLastFetchDate((previous) => isCurrent() ? new Date() : previous);
        beforeApplyRows?.();
        setItems((previous) => isCurrent() ? serializeRows(data) : previous);
      } catch (error: unknown) {
        if (isCurrent()) onDataError(error);
      } finally {
        if (isCurrent()) setLoading((previous) => isCurrent() ? false : previous);
      }
    },
    [idConnection, loading, schema, table, appliedWhere, sort, readData, serializeRows, onDataError, beginRequest, condition],
  );

  const sortData = React.useCallback(
    async (column: IColumn, sortType: ISortDirection | null | undefined, beforeApplyRows?: () => void) => {
      if (loading || !column.sortable) return;

      const nextSort = getNextSort(sort, column.attribute, sortType);
      const isCurrent = beginRequest();
      if (!isCurrent) return;
      setLoading(true);
      setResultRevision((previous) => previous + 1);

      try {
        if (!isCurrent()) return;
        const { data } = await readData({
          schema,
          table,
          page: 1,
          ...condition(),
          orderBy: nextSort,
        }, isCurrent);

        if (!isCurrent()) return;
        setSort((previous) => isCurrent() ? nextSort : previous);
        beforeApplyRows?.();
        setItems((previous) => isCurrent() ? serializeRows(data) : previous);
        setPage((previous) => isCurrent() ? 1 : previous);
        lastPageSearch.current = 1;
        setLastFetchDate((previous) => isCurrent() ? new Date() : previous);
      } catch (error: unknown) {
        if (isCurrent()) onDataError(error);
      } finally {
        if (isCurrent()) setLoading((previous) => isCurrent() ? false : previous);
      }
    },
    [idConnection, schema, table, appliedWhere, sort, loading, readData, serializeRows, onDataError, beginRequest, condition],
  );

  const applyFilterData = React.useCallback(
    async (nextWhereInput: string, beforeApplyRows?: () => void, fromHistory = false) => {
      if (loading || filterPreparing) return;
      if (needsInitialWhere() && !draftEdited.current && !fromHistory) {
        onDataError(filterPreparationError('invalid-filter'));
        return;
      }

      const newWhere = nextWhereInput || undefined;
      const isCurrent = beginRequest();
      if (!isCurrent) return;
      setLoading(true);
      setResultRevision((previous) => previous + 1);
      setWhereInputText(nextWhereInput);
      initialPreparation.current = undefined;

      try {
        const { data } = await getTableData(idConnection, {
          schema,
          table,
          page: 1,
          where: newWhere,
          orderBy: sort,
        });

        if (!isCurrent()) return;
        scope.countToken = undefined;
        setLoadingRowsCount((previous) => isCurrent() && !scope.countToken ? false : previous);
        resolved.current = true;
        appliedWhereRef.current = nextWhereInput;
        initialPreparation.current = undefined;
        setAppliedWhere((previous) => isCurrent() ? nextWhereInput : previous);
        setRowsCount((previous) => isCurrent() ? undefined : previous);
        beforeApplyRows?.();
        setItems((previous) => isCurrent() ? serializeRows(data) : previous);
        setPage((previous) => isCurrent() ? 1 : previous);
        lastPageSearch.current = 1;
        setLastFetchDate((previous) => isCurrent() ? new Date() : previous);
      } catch (error: unknown) {
        if (isCurrent()) onDataError(error);
      } finally {
        if (isCurrent()) setLoading((previous) => isCurrent() ? false : previous);
      }
    },
    [getTableData, idConnection, loading, onDataError, schema, serializeRows, sort, table, beginRequest, filterPreparing],
  );

  React.useEffect(() => {
    scope.active = true;
    setLoading(false);
    setLoadingRowsCount(false);
    setRowsCount(undefined);
    setPage(0);
    lastPageSearch.current = 0;
    setItems([]);
    setResultRevision((previous) => previous + 1);
    setSort([]);
    setWhereInputText(initialText);
    setAppliedWhere(initialText);
    appliedWhereRef.current = initialText;
    resolved.current = typeof initialWhere === 'string' || initialWhere === undefined;
    draftEdited.current = false;
    initialPreparation.current = undefined;
    setFilterPreparing(!resolved.current);
    return () => { scope.active = false; };
  }, [scope]);

  return {
    items,
    resultRevision,
    loading,
    loadingRowsCount,
    rowsCount,
    sort,
    lastFetchDate,
    whereInput,
    appliedWhere,
    filterPreparing,
    filterBlocked: needsInitialWhere(),
    setWhereInput,
    handleLoadRowsCount,
    loadData,
    refreshData,
    sortData,
    applyFilterData,
  };
};
