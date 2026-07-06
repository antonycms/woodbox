import React from 'react';
import Table, { type ITableSelectedCellData } from '@renderer/components/Table';
import { Text } from '@renderer/components/Text';
import { useStoreContext, type IColumnReferenceInfo } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort } from '@renderer/utils/tableSort';
import { generateHash } from '@renderer/utils/string';
import styles from './styles.module.css';

interface IReferenceSelectionProps {
  active: boolean;
  idConnection: string;
  reference?: IColumnReferenceInfo;
  onDataError(error: unknown): void;
  onSelectValue(value: any): void;
}

const serializeRows = (rows: any[]) =>
  rows.map((row) => ({
    ...row,
    __table_hash_item: `reference_${generateHash()}`,
  }));

const ReferenceSelection = ({
  active,
  idConnection,
  reference,
  onDataError,
  onSelectValue,
}: IReferenceSelectionProps) => {
  const {
    activeTheme: {
      tableInfo: { data: theme },
    },
  } = useThemeContext();
  const { getTableColumns, getTableData } = useStoreContext();
  const [columns, setColumns] = React.useState<IColumn[]>([]);
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [whereInput, setWhereInput] = React.useState('');
  const [appliedWhere, setAppliedWhere] = React.useState('');
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const lastPageSearch = React.useRef(0);

  const referenceKey = React.useMemo(() => {
    if (!reference) return '';

    return [
      reference.reference_table_schema,
      reference.reference_table_name,
      reference.reference_column_name,
    ].join('.');
  }, [reference]);

  const loadPage = React.useCallback(
    async (nextPage: number, nextWhere = appliedWhere, nextSort = sort, replace = false) => {
      if (!reference || loading) return;

      setLoading(true);

      try {
        if (!columns.length) {
          const tableColumns = await getTableColumns(idConnection, {
            schema: reference.reference_table_schema,
            table: reference.reference_table_name,
          });

          setColumns(
            tableColumns.map<IColumn>((column) => ({
              title: 'Clique para ordenar por essa coluna',
              label: column.column_name,
              attribute: column.column_name,
              sortable: true,
            })),
          );
        }

        const { data } = await getTableData(idConnection, {
          schema: reference.reference_table_schema,
          table: reference.reference_table_name,
          page: nextPage,
          where: nextWhere || undefined,
          orderBy: nextSort,
        });

        lastPageSearch.current = nextPage;
        setPage(nextPage);
        setItems((prevState) =>
          replace ? serializeRows(data) : [...prevState, ...serializeRows(data)],
        );
        setHasLoaded(true);
      } catch (error: unknown) {
        onDataError(error);
      } finally {
        setLoading(false);
      }
    },
    [
      appliedWhere,
      columns.length,
      getTableColumns,
      getTableData,
      idConnection,
      loading,
      onDataError,
      reference,
      sort,
    ],
  );

  const loadNextPage = React.useCallback(() => {
    const nextPage = page + 1;

    if (nextPage === lastPageSearch.current) return;

    loadPage(nextPage);
  }, [loadPage, page]);

  const handleSort = React.useCallback(
    async (column: IColumn, sortType?: ISortDirection | null) => {
      if (loading || !column.sortable) return;

      const nextSort = getNextSort(sort, column.attribute, sortType);
      setSort(nextSort);
      setItems([]);
      setPage(0);
      lastPageSearch.current = 0;
      await loadPage(1, appliedWhere, nextSort, true);
    },
    [appliedWhere, loadPage, loading, sort],
  );

  const handleFilterKeyDown = React.useCallback(
    async (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' || loading) return;

      setAppliedWhere(whereInput);
      setItems([]);
      setPage(0);
      lastPageSearch.current = 0;
      await loadPage(1, whereInput, sort, true);
    },
    [loadPage, loading, sort, whereInput],
  );

  const handleSelectCell = React.useCallback(
    (data: ITableSelectedCellData) => {
      if (!reference) return;

      onSelectValue(data.row[reference.reference_column_name]);
    },
    [onSelectValue, reference],
  );

  React.useEffect(() => {
    setColumns([]);
    setItems([]);
    setSort([]);
    setWhereInput('');
    setAppliedWhere('');
    setPage(0);
    setHasLoaded(false);
    lastPageSearch.current = 0;
  }, [referenceKey]);

  React.useEffect(() => {
    if (!active || !reference || hasLoaded) return;

    loadPage(1, '', [], true);
  }, [active, hasLoaded, loadPage, reference]);

  if (!reference) {
    return (
      <div className={styles.emptyState}>
        <Text color={theme.bar.color}>Selecione uma célula com FK para carregar opções.</Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.filterBar} style={{ backgroundColor: theme.bar.backgroundColor }}>
        <input
          className={styles.filterInput}
          placeholder="Filtrar seleção (ex: nome like '%maria%')"
          value={whereInput}
          onChange={(event) => setWhereInput(event.target.value)}
          onKeyDown={handleFilterKeyDown}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <div className={styles.tableWrapper}>
        <Table
          columns={columns}
          rows={items}
          sort={sort}
          loading={loading}
          rowKeyExtractor={(row, index) => row.__table_hash_item ?? index}
          onSort={handleSort}
          onScrollEnd={loadNextPage}
          onSelectCellData={handleSelectCell}
        />
      </div>
    </div>
  );
};

export default ReferenceSelection;
