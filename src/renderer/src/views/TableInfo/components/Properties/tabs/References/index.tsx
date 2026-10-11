import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Bar } from '@renderer/components/Bar';
import { useTableInfoStore, type TableInfoStoreApi } from '@renderer/stores/TableInfo';
import { toDateTime } from '@renderer/utils/date';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useOpenTableTab } from '@renderer/hooks/useOpenTableTab';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort } from '@renderer/utils/tableSort';
import { useFilteredSortedRows } from '../../hooks/useFilteredSortedRows';
import FilterInput from '@renderer/components/FilterInput';
import { getReferenceRowKey, getReferenceSearchValues } from './utils';
import { IReferenceRow } from './dtos';

interface IReferencesProps {
  tableStore: TableInfoStoreApi;
}

const References = ({ tableStore }: IReferencesProps) => {
  const {
    tableInfo: { properties: theme },
  } = useThemeStore((state) => state.activeTheme);
  const t = useI18nStore((state) => state.t);
  const { openTable } = useOpenTableTab();
  const { usedAsReference, loadTableUsedAsReference, lastFetchDate, loading, tableContext } = useTableInfoStore(
    tableStore,
    useShallow((state) => ({
      usedAsReference: state.usedAsReference,
      loadTableUsedAsReference: state.loadTableUsedAsReference,
      lastFetchDate: state.lastFetchDate,
      loading: state.loading,
      tableContext: state.tableContext,
    })),
  );
  const { idConnection: id_connection, schema, table } = tableContext;

  const [referenceFilterText, setReferenceFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.usedAsReference);

  const rowsSerialized = React.useMemo(
    () =>
      usedAsReference.map((ref) => ({
        ...ref,
        source_table: !ref.table_schema ? ref.table_name : `${ref.table_schema}.${ref.table_name}`,
      })),
    [usedAsReference],
  );

  const filteredAndSortedRows = useFilteredSortedRows({
    rows: rowsSerialized,
    filterText: referenceFilterText,
    sort,
    getSearchValues: getReferenceSearchValues,
  });

  const handleSortReferences = React.useCallback(
    (column: IColumn<IReferenceRow>, sortType?: ISortDirection | null) => {
      setSort((current) => getNextSort(current, column.attribute, sortType));
    },
    [],
  );

  const handleCellLinkClick = React.useCallback((attribute: string, value: string) => {
    if (attribute !== 'source_table') return;
    const row = rowsSerialized.find((r) => r.source_table === value);
    if (row) openTable(id_connection, row.table_schema, row.table_name);
  }, [id_connection, openTable, rowsSerialized]);

  const tableColumns = React.useMemo<IColumn<IReferenceRow>[]>(
    () => [
      {
        label: t('field.name'),
        attribute: 'constraint_name',
        sortable: true,
      },
      {
        label: t('field.table'),
        attribute: 'source_table',
        isLink: true,
        sortable: true,
      },
      {
        label: t('field.column'),
        attribute: 'column_name',
        sortable: true,
      },
      {
        label: t('field.referencedColumnTitle'),
        attribute: 'reference_column_name',
        sortable: true,
      },
    ],
    [t],
  );

  React.useEffect(() => {
    loadTableUsedAsReference(id_connection, { schema, table });
  }, [id_connection, loadTableUsedAsReference, schema, table]);

  return (
    <>
      <FilterInput
        filterBar={theme.bar}
        placeholder={t('placeholder.filterReferences')}
        value={referenceFilterText}
        onChange={setReferenceFilterText}
      />

      <Table
        rowKeyExtractor={getReferenceRowKey}
        loading={loading.usedAsReference}
        rows={filteredAndSortedRows}
        sort={sort}
        onSort={handleSortReferences}
        onCellLinkClick={handleCellLinkClick}
        columns={tableColumns}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <RefreshButton
          menuPlacement="top"
          color={theme.bar.color}
          onRefresh={() => loadTableUsedAsReference(id_connection, { schema, table })}
        />

        <Spacer />

        <Text userSelect={false} title={t('common.totalItems')} color={theme.bar.color}>
          {t(
            filteredAndSortedRows.length === 1
              ? 'common.itemCountSingular'
              : 'common.itemCountPlural',
            { count: filteredAndSortedRows.length },
          )}
        </Text>

        <Text userSelect={false} title={t('common.lastUpdatedAt')} color={theme.bar.color}>
          {t('common.updatedAt', { date: lastFetchDateSerialized })}
        </Text>
      </Bar>
    </>
  );
};

export default React.memo(References);
