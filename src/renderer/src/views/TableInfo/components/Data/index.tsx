import { useRowChanges } from '@renderer/hooks/useRowChanges';
import { normalizeCellValue } from '@renderer/utils/tableRows';
import { ValuePreview, type ValuePreviewRequest } from './components/ValuePreview';
import { useShallow } from 'zustand/react/shallow';
import { getErrorMessage } from '@shared/utils/error';
import React from 'react';
import Table, {
  type ITableContextMenuData,
  type ITableSelectedCellData,
} from '@renderer/components/Table';
import styles from './styles.module.css';
import { useI18nStore } from '@renderer/stores/I18n';
import { useTableInfoStore, type TableInfoStoreApi } from '@renderer/stores/TableInfo';
import { toDateTime } from '@renderer/utils/date';
import type { IColumn, ISortDirection } from '@renderer/components/Table/dtos';
import { useThemeStore } from '@renderer/stores/Theme';
import ModalGenerateDDL from '../Properties/components/ModalGenerateDDL';
import ModalDataError from './components/ModalDataError';
import FilterInput from '@renderer/components/FilterInput';
import { ModalExportData } from '@renderer/components/ModalExportData';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import useFilterHistory from '@renderer/hooks/useFilterHistory';
import { useOpenTableTab } from '@renderer/hooks/useOpenTableTab';
import { DataContextMenu } from './components/DataContextMenu';
import { DataToolbar } from './components/DataToolbar';
import { NoPrimaryKeyModal } from './components/NoPrimaryKeyModal';
import { useTableDataLoading } from './hooks/useTableDataLoading';
import { useTableDataPersistence } from './hooks/useTableDataPersistence';
import type { IContextMenuTable } from './types';

interface IDataProps {
  tableStore: TableInfoStoreApi;
  initialWhere?: string;
  filterLocked?: boolean;
  onRegisterRefresh?: (refresh: () => void | Promise<void>) => void;
  onPendingRowsChangesChange?: (hasPendingChanges: boolean) => void;
}

const Data = ({
  tableStore,
  initialWhere,
  filterLocked,
  onRegisterRefresh,
  onPendingRowsChangesChange,
}: IDataProps) => {
  const {
    tableInfo: { data: theme },
    modal: colors,
  } = useThemeStore((state) => state.activeTheme);
  const {
    columns,
    references,
    restrictions,
    loadTableColumns,
    loadTableReferences,
    loadTableRestrictions,
    loading: loadingTableInfo,
    tableContext,
  } = useTableInfoStore(
    tableStore,
    useShallow((state) => ({
      columns: state.columns,
      references: state.references,
      restrictions: state.restrictions,
      loadTableColumns: state.loadTableColumns,
      loadTableReferences: state.loadTableReferences,
      loadTableRestrictions: state.loadTableRestrictions,
      loading: state.loading,
      tableContext: state.tableContext,
    })),
  );

  const { openTableWithFilter } = useOpenTableTab();
  const t = useI18nStore((state) => state.t);
  const { idConnection: id_connection, schema, table, objectType, dialect } = tableContext;

  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [dataErrorMessage, setDataErrorMessage] = React.useState<string>();
  const [showNoPkModal, setShowNoPkModal] = React.useState(false);
  const [applyingChanges, setApplyingChanges] = React.useState(false);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [valuePreview, setValuePreview] = React.useState<ValuePreviewRequest>();
  const showValuePreview = !!valuePreview;
  const [selectedCell, setSelectedCell] = React.useState<ITableSelectedCellData>();
  const [filterHistory, addFilterHistory] = useFilterHistory([id_connection, schema, table]);
  const isReadOnlyObject = objectType === 'view' || objectType === 'materialized_view';

  const handleDataError = React.useCallback(
    (error: unknown) => {
      setDataErrorMessage(getErrorMessage(error) || t('common.unknownError'));
    },
    [t],
  );

  const {
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
  } = useTableDataLoading({
    idConnection: id_connection,
    schema,
    table,
    initialWhere,
    onDataError: handleDataError,
  });

  const closeContextMenuTable = React.useCallback(() => {
    setContextMenuTable(undefined);
  }, []);

  const {
    editedFieldsRows,
    droppedRows,
    newRows,
    primaryKeyColumns,
    hasPendingRowsChanges,
    handleEditNewRow,
    handleEditRow,
    removedRowKeys,
    handleAddItem,
    handleDuplicateSelectedRows,
    handleCancelSelectedRowsEditions,
    handleUndoSelectedDroppedRows,
    handleRemoveSelectedRows,
    setSelectedRows,
    resetRows,
  } = useRowChanges({ items, columns, restrictions, onCloseMenu: closeContextMenuTable });

  const { handleSaveItems, handleApplyWithoutPrimaryKey } = useTableDataPersistence({
    idConnection: id_connection,
    schema,
    table,
    dialect,
    columns,
    items,
    editedFieldsRows,
    droppedRows,
    newRows,
    primaryKeyColumns,
    applyingChanges,
    setApplyingChanges,
    setShowNoPkModal,
    refreshData,
    resetRows,
  });

  const selectedCellValue = React.useMemo(() => {
    if (!selectedCell) return undefined;

    const row = selectedCell.row;
    const attribute = String(selectedCell.column.attribute);
    const editedRow = editedFieldsRows.get(row.__key_row);
    const newRow = newRows.get(row.__key_row);

    if (newRow && attribute in newRow) return newRow[attribute];
    if (editedRow && attribute in editedRow) return editedRow[attribute];

    return row[attribute];
  }, [editedFieldsRows, newRows, selectedCell]);

  const fkMap = React.useMemo(
    () => new Map(references.map((r) => [r.column_name, r])),
    [references],
  );

  const selectedReference = selectedCell
    ? fkMap.get(String(selectedCell.column.attribute))
    : undefined;

  const closeValuePreview = React.useCallback(() => {
    setValuePreview(undefined);
  }, []);

  const toggleValuePreview = React.useCallback(() => {
    if (showValuePreview) {
      closeValuePreview();
      return;
    }

    setValuePreview({ tab: 'value' });
  }, [closeValuePreview, showValuePreview]);

  const handleWhereInputChange = React.useCallback(
    (value: string) => {
      if (!filterLocked) setWhereInput(value);
    },
    [filterLocked],
  );

  const closeDdlModal = React.useCallback(() => {
    setShowDdlModal(false);
  }, []);

  const openDdlModal = React.useCallback(() => {
    setShowDdlModal(true);
  }, []);

  const openExportModal = React.useCallback(() => {
    setShowExportModal(true);
    setContextMenuTable(undefined);
  }, []);

  const closeExportModal = React.useCallback(() => {
    setShowExportModal(false);
  }, []);

  const closeDataErrorModal = React.useCallback(() => {
    setDataErrorMessage(undefined);
  }, []);

  const closeNoPkModal = React.useCallback(() => {
    setShowNoPkModal(false);
  }, []);

  const handleFkCellClick = React.useCallback(
    (attribute: string, value: unknown) => {
      const ref = fkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;
      openTableWithFilter(
        id_connection,
        ref.reference_table_schema,
        ref.reference_table_name,
        ref.reference_column_name,
        String(value),
      );
    },
    [fkMap, id_connection, openTableWithFilter],
  );

  const handleFkPreviewClick = React.useCallback(
    (attribute: string, value: unknown) => {
      const ref = fkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;

      setValuePreview({ tab: 'reference' });
    },
    [fkMap],
  );

  const isLoading = loadingTableInfo.columns || loading;

  const lastFetchDateSerialized = toDateTime(lastFetchDate);

  const columnsSerialized = React.useMemo(
    () =>
      columns.map<IColumn>((column) => ({
        label: column.column_name,
        info: column.data_type,
        attribute: column.column_name,
        required: !!column.is_nullable,
        sortable: true,
        editable: !isReadOnlyObject,
        isLink: fkMap.has(column.column_name),
      })),
    [columns, fkMap, isReadOnlyObject],
  );

  const columnNames = React.useMemo(() => columns.map((column) => column.column_name), [columns]);

  const exportSource = React.useMemo(
    () => ({
      type: 'table' as const,
      schema,
      table,
      where: appliedWhere || undefined,
      orderBy: sort,
    }),
    [appliedWhere, schema, sort, table],
  );

  const handleApplySelectedCellValue = React.useCallback(
    (value: unknown) => {
      if (!selectedCell) return;

      const row = selectedCell.row;
      const attribute = String(selectedCell.column.attribute);
      const normalizedValue = normalizeCellValue(value);

      if (row.__is_new_row) {
        handleEditNewRow(row.__key_row, attribute, normalizedValue);
      } else {
        handleEditRow(
          row.__row_index ?? selectedCell.rowIndex,
          attribute,
          normalizedValue,
          row.__key_row,
        );
      }

      setSelectedCell((prevState) =>
        prevState ? { ...prevState, value: normalizedValue } : prevState,
      );
    },
    [handleEditNewRow, handleEditRow, selectedCell],
  );

  const onContextMenuTable = React.useCallback((
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: ITableContextMenuData,
  ) => {
    setContextMenuTable({
      data,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  }, []);

  const rowKeyExtractor = React.useCallback((row: Record<string, unknown>, index: number) => {
    return typeof row.__table_hash_item === 'string' ? row.__table_hash_item : index;
  }, []);

  const handleRefresh = React.useCallback(async () => {
    await refreshData(resetRows);
  }, [refreshData, resetRows]);

  const handleSetSelectedCellsNull = React.useCallback(() => {
    const cells = contextMenuTable?.data?.getSelectedCells() || [];

    cells.forEach(({ row, column, rowIndex }) => {
      if (!column.editable) return;

      const rowData = row;
      const attribute = String(column.attribute);

      if (rowData.__is_new_row) {
        handleEditNewRow(rowData.__key_row, attribute, null, false);
        return;
      }

      handleEditRow(rowData.__row_index ?? rowIndex, attribute, null, rowData.__key_row);
    });

    setContextMenuTable(undefined);
  }, [contextMenuTable, handleEditNewRow, handleEditRow]);

  const handleSort = React.useCallback(
    async (column: IColumn, sortType?: ISortDirection | null) => {
      await sortData(column, sortType, resetRows);
    },
    [sortData, resetRows],
  );

  const applyFilter = React.useCallback(
    async (nextWhereInput: string) => {
      await applyFilterData(nextWhereInput, () => {
        addFilterHistory(nextWhereInput);
        resetRows();
      });
    },
    [addFilterHistory, applyFilterData, resetRows],
  );

  const handleFilterKeyDown = React.useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;

      await applyFilter(whereInput);
    },
    [applyFilter, whereInput],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSaveItems();
        return;
      }

      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        handleRemoveSelectedRows();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelSelectedRowsEditions();
        handleUndoSelectedDroppedRows();
        return;
      }
    },
    [
      handleCancelSelectedRowsEditions,
      handleRemoveSelectedRows,
      handleSaveItems,
      handleUndoSelectedDroppedRows,
    ],
  );

  React.useEffect(() => {
    // Monta uma vez: a aba de dados é recriada quando a tabela/conexão muda.
    loadData();
  }, []);

  React.useEffect(() => {
    onRegisterRefresh?.(handleRefresh);
  }, [onRegisterRefresh, handleRefresh]);

  React.useEffect(() => {
    onPendingRowsChangesChange?.(hasPendingRowsChanges);
  }, [hasPendingRowsChanges, onPendingRowsChangesChange]);

  React.useEffect(() => {
    if (columns.length === 0) {
      loadTableColumns(id_connection, { table, schema });
    }

    if (references.length === 0) {
      loadTableReferences(id_connection, { table, schema });
    }

    if (restrictions.length === 0) {
      loadTableRestrictions(id_connection, { table, schema });
    }
  }, [
    id_connection,
    table,
    schema,
    columns.length,
    references.length,
    restrictions.length,
    loadTableColumns,
    loadTableReferences,
    loadTableRestrictions,
  ]);

  return (
    <div
      className={styles.container}
      onKeyDown={isReadOnlyObject ? undefined : handleKeyDown}
      style={
        {
          '--data-border-color': theme.bar.borderColor,
        } as React.CSSProperties
      }
    >
      <FilterInput
        filterBar={{
          ...theme.bar,
          inputOpacity: filterLocked ? 0.6 : 1,
        }}
        placeholder={t('placeholder.filterResults')}
        value={whereInput}
        suggestions={columnNames}
        onChange={handleWhereInputChange}
        historyItems={filterHistory}
        onHistorySelect={applyFilter}
        onKeyDown={handleFilterKeyDown}
        disabled={filterLocked}
      />

      <div className={styles.content}>
        <div className={styles.tableWrapper}>
          <Table
            columns={columnsSerialized}
            rows={items}
            sort={sort}
            onSort={handleSort}
            rowKeyExtractor={rowKeyExtractor}
            onScrollEnd={loadData}
            loading={isLoading}
            onContextMenu={onContextMenuTable}
            onSelectRow={setSelectedRows}
            onSelectCellData={setSelectedCell}
            editedRows={editedFieldsRows}
            newRows={newRows}
            removedRows={removedRowKeys}
            onCellLinkClick={handleFkCellClick}
            onCellLinkPreviewClick={handleFkPreviewClick}
            onEditNewRow={isReadOnlyObject ? undefined : handleEditNewRow}
            onEditRow={isReadOnlyObject ? undefined : handleEditRow}
          />
        </div>

        <ValuePreview
          preview={valuePreview}
          id_connection={id_connection}
          dialect={dialect.editorDialect}
          selectedCell={selectedCell}
          selectedCellValue={selectedCellValue}
          selectedReference={selectedReference}
          onClose={closeValuePreview}
          onDataError={handleDataError}
          onApplyValue={handleApplySelectedCellValue}
        />
      </div>

      <DataToolbar
        backgroundColor={theme.bar.backgroundColor}
        borderColor={theme.bar.borderColor}
        color={theme.bar.color}
        isReadOnlyObject={isReadOnlyObject}
        applyingChanges={applyingChanges}
        loadingRowsCount={loadingRowsCount}
        rowsCount={rowsCount}
        showValuePreview={showValuePreview}
        lastFetchDateSerialized={lastFetchDateSerialized}
        onSaveItems={handleSaveItems}
        onAddItem={handleAddItem}
        onDuplicateSelectedRows={handleDuplicateSelectedRows}
        onRemoveSelectedRows={handleRemoveSelectedRows}
        onToggleValuePreview={toggleValuePreview}
        onRefresh={handleRefresh}
        onOpenExportModal={openExportModal}
        onLoadRowsCount={handleLoadRowsCount}
      />

      <ModalGenerateDDL
        show={showDdlModal}
        sql={ddlSql}
        dialect={dialect}
        onClose={closeDdlModal}
      />

      <ModalExportData
        show={showExportModal}
        idConnection={id_connection}
        source={exportSource}
        fileName={[schema, table].filter(Boolean).join('.')}
        onClose={closeExportModal}
      />

      <ModalDataError message={dataErrorMessage} onClose={closeDataErrorModal} />

      <NoPrimaryKeyModal
        show={showNoPkModal}
        applyingChanges={applyingChanges}
        color={colors.color || theme.bar.color}
        cancelButtonColor={colors.cancelButtonColor}
        cancelButtonBackgroundColor={colors.cancelButtonBackgroundColor}
        saveButtonColor={colors.saveButtonColor}
        saveButtonBackgroundColor={colors.saveButtonBackgroundColor}
        onClose={closeNoPkModal}
        onApplyWithoutPrimaryKey={handleApplyWithoutPrimaryKey}
      />

      <DataContextMenu
        contextMenuTable={contextMenuTable}
        columnNames={columnNames}
        dialect={dialect}
        schema={schema}
        table={table}
        isReadOnlyObject={isReadOnlyObject}
        onClose={closeContextMenuTable}
        onOpenExportModal={openExportModal}
        onSetSelectedCellsNull={handleSetSelectedCellsNull}
        onRemoveSelectedRows={handleRemoveSelectedRows}
        onSetDdlSql={setDdlSql}
        onShowDdlModal={openDdlModal}
      />
    </div>
  );
};

export default Data;
export type { IContextMenuTable } from './types';
