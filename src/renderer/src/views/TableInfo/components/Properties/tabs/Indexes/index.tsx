import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Bar } from '@renderer/components/Bar';
import type { IIndexInfo } from '@shared/types/database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import type {
  IPendingIndexCreate,
} from '@renderer/database/ddl/types';
import { useTableInfoStore } from '@renderer/stores/TableInfo';
import { ITableInfoViewProps } from '@renderer/views/TableInfo/dtos';
import { AddIcon, CancelIcon, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort } from '@renderer/utils/tableSort';
import { useFilteredSortedRows } from '../../hooks/useFilteredSortedRows';
import { useSelectionReconciliation } from '../../hooks/useSelectionReconciliation';
import { usePropertiesKeyboardShortcuts } from '../../hooks/usePropertiesKeyboardShortcuts';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import FilterBar from '../../components/FilterBar';
import { generateIndexesDdl } from '@renderer/database/ddl';
import ModalNewIndex from './components/ModalNewIndex';
import { getRendererDialect } from '@renderer/database/dialects';
import { IIndexInfoSerialized } from './dtos';
import {
  getIndexColumnsText,
  getIndexSearchValues,
  getIndexSelectionKey,
  getIndexSizeText,
} from './utils';

const Indexes = ({ tableStore,
  id_connection,
  schema,
  table,
  mode,
  tableComment,
  onCreateApplied,
}: ITableInfoViewProps) => {
  const {
    tableInfo: { properties: theme },
  } = useThemeStore((state) => state.activeTheme);
  const showToast = useToastStore((state) => state.showToast);
  const t = useI18nStore((state) => state.t);
  const connections = useWorkspaceStore((state) => state.connections);
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const {
    columns,
    pendingColumns,
    pendingDroppedColumns,
    indexes,
    pendingIndexes,
    pendingDroppedIndexes,
    addPendingIndex,
    removePendingIndex,
    addPendingDroppedIndexes,
    removePendingDroppedIndexes,
    clearPendingChanges,
    loadTableIndexes,
    openPendingChangesSqlModal,
    lastFetchDate,
    loading,
  } = useTableInfoStore(
    tableStore,
    useShallow((state) => ({
      columns: state.columns,
      pendingColumns: state.pendingColumns,
      pendingDroppedColumns: state.pendingDroppedColumns,
      indexes: state.indexes,
      pendingIndexes: state.pendingIndexes,
      pendingDroppedIndexes: state.pendingDroppedIndexes,
      addPendingIndex: state.addPendingIndex,
      removePendingIndex: state.removePendingIndex,
      addPendingDroppedIndexes: state.addPendingDroppedIndexes,
      removePendingDroppedIndexes: state.removePendingDroppedIndexes,
      clearPendingChanges: state.clearPendingChanges,
      loadTableIndexes: state.loadTableIndexes,
      openPendingChangesSqlModal: state.openPendingChangesSqlModal,
      lastFetchDate: state.lastFetchDate,
      loading: state.loading,
    })),
  );
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedIndexes, setSelectedIndexes] = React.useState<IIndexInfo[]>([]);
  const [indexFilterText, setIndexFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [showNewIndexModal, setShowNewIndexModal] = React.useState(false);

  const droppedIndexNames = React.useMemo(
    () => new Set(pendingDroppedIndexes.map((index) => index.index_name)),
    [pendingDroppedIndexes],
  );
  const droppedColumnNames = React.useMemo(
    () => new Set(pendingDroppedColumns.map((column) => column.column_name)),
    [pendingDroppedColumns],
  );
  const availableColumnNames = React.useMemo(
    () => [
      ...columns
        .filter((column) => !droppedColumnNames.has(column.column_name))
        .map((column) => column.column_name),
      ...pendingColumns.map((column) => column.column_name),
    ],
    [columns, droppedColumnNames, pendingColumns],
  );
  const existingIndexes = React.useMemo<IIndexInfoSerialized[]>(
    () =>
      indexes.map((index) => ({
        ...index,
        column_names_display: getIndexColumnsText(index),
        index_size: getIndexSizeText(index),
      })),
    [indexes],
  );
  const pendingIndexRows = React.useMemo<IIndexInfoSerialized[]>(
    () =>
      pendingIndexes.map((index) => ({
        ...index,
        column_names_display: getIndexColumnsText(index),
        index_size: getIndexSizeText(index),
      })),
    [pendingIndexes],
  );
  const allIndexes = React.useMemo<IIndexInfoSerialized[]>(
    () => [...existingIndexes, ...pendingIndexRows],
    [existingIndexes, pendingIndexRows],
  );
  const filteredAndSortedIndexes = useFilteredSortedRows({
    rows: existingIndexes,
    filterText: indexFilterText,
    sort,
    getSearchValues: getIndexSearchValues,
  });

  const filteredPendingIndexRows = useFilteredSortedRows({
    rows: pendingIndexRows,
    filterText: indexFilterText,
    sort,
    getSearchValues: getIndexSearchValues,
  });
  const newIndexRows = React.useMemo(
    () =>
      new Map(
        filteredPendingIndexRows.map((index) => [
          (index as IPendingIndexCreate).__pendingId,
          index,
        ]),
      ),
    [filteredPendingIndexRows],
  );

  const handleSortIndexes = React.useCallback(
    (column: IColumn<IIndexInfoSerialized>, sortType?: ISortDirection | null) => {
      setSort((current) => getNextSort(current, column.attribute, sortType));
    },
    [],
  );

  const tableColumns = React.useMemo<IColumn<IIndexInfoSerialized>[]>(
    () => [
      {
        label: t('field.name'),
        attribute: 'index_name',
        sortable: true,
      },
      {
        label: t('field.columns'),
        attribute: 'column_names_display',
        sortable: true,
      },
      {
        label: t('index.uniqueSingle'),
        attribute: 'is_unique',
        sortable: true,
      },
      {
        label: t('field.primaryKey'),
        attribute: 'is_primary',
        sortable: true,
      },
      {
        label: t('field.method'),
        attribute: 'index_method',
        sortable: true,
      },
      {
        label: t('field.valid'),
        attribute: 'is_valid',
        sortable: true,
      },
      {
        label: t('field.expression'),
        attribute: 'expression',
        sortable: true,
      },
      {
        label: t('field.predicate'),
        attribute: 'predicate',
        sortable: true,
      },
      {
        label: t('field.size'),
        attribute: 'index_size',
        sortable: true,
      },
    ],
    [t],
  );

  const handleOpenNewIndexModal = React.useCallback(() => {
    setShowNewIndexModal(true);
    setContextMenuPosition(null);
  }, []);

  const handleSavePendingChanges = React.useCallback(() => {
    openPendingChangesSqlModal(
      id_connection,
      { schema, table },
      {
        mode,
        tableComment,
        onApplied: onCreateApplied,
      },
    );
  }, [
    id_connection,
    mode,
    onCreateApplied,
    openPendingChangesSqlModal,
    schema,
    table,
    tableComment,
  ]);

  const handleAddPendingIndex = React.useCallback(
    (index: IPendingIndexCreate) => {
      const indexName = index.index_name.toLowerCase();
      const alreadyExists = allIndexes.some((item) => item.index_name.toLowerCase() === indexName);

      if (alreadyExists) {
        showToast({ type: 'warn', title: t('toast.indexExists') });
        return false;
      }

      addPendingIndex(index);
      return true;
    },
    [addPendingIndex, allIndexes, showToast],
  );

  const handleRemoveSelectedIndexes = React.useCallback(() => {
    if (!selectedIndexes.length) {
      showToast({ type: 'warn', title: t('toast.selectIndexesRemove') });
      return;
    }

    selectedIndexes.forEach((index) => {
      const pendingId = (index as IPendingIndexCreate).__pendingId;

      if (pendingId) {
        removePendingIndex(pendingId);
        return;
      }

      addPendingDroppedIndexes([index]);
    });

    setContextMenuPosition(null);
  }, [selectedIndexes, removePendingIndex, addPendingDroppedIndexes, showToast]);

  const handleUndoSelectedDroppedIndexes = React.useCallback(() => {
    const indexNames = selectedIndexes
      .filter((index) => droppedIndexNames.has(index.index_name))
      .map((index) => index.index_name);

    if (!indexNames.length) return;

    removePendingDroppedIndexes(indexNames);
    setSelectedIndexes([]);
  }, [selectedIndexes, droppedIndexNames, removePendingDroppedIndexes]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: t('modal.newIndex'),
        onClick: handleOpenNewIndexModal,
      },
      {
        text: t('context.deleteSelectedItems'),
        onClick: handleRemoveSelectedIndexes,
      },
      {
        text: t('modal.generateDdl'),
        onClick: () => {
          setDdlSql(generateIndexesDdl(selectedIndexes));
          setShowDdlModal(true);
        },
      },
    ];
  }, [selectedIndexes, handleOpenNewIndexModal, handleRemoveSelectedIndexes, t]);

  const onContextMenuTable = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      setContextMenuPosition({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  const handleKeyDown = usePropertiesKeyboardShortcuts({
    onRemove: handleRemoveSelectedIndexes,
    onSave: handleSavePendingChanges,
    onUndo: handleUndoSelectedDroppedIndexes,
  });

  React.useEffect(() => {
    if (mode === 'create') return;

    loadTableIndexes(id_connection, { schema, table });
  }, [id_connection, loadTableIndexes, mode, schema, table]);

  React.useEffect(() => {
    setSelectedIndexes([]);
  }, [indexFilterText]);

  useSelectionReconciliation({
    rows: allIndexes,
    setSelectedRows: setSelectedIndexes,
    getSelectionKey: getIndexSelectionKey,
  });

  return (
    <div style={{ display: 'contents' }} onKeyDown={handleKeyDown}>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL
        show={showDdlModal}
        sql={ddlSql}
        dialect={dialect}
        onClose={() => setShowDdlModal(false)}
      />

      <ModalNewIndex
        show={showNewIndexModal}
        table={table}
        columns={availableColumnNames}
        indexMethods={dialect.indexMethods || []}
        onClose={() => setShowNewIndexModal(false)}
        onAdd={handleAddPendingIndex}
      />

      <FilterBar
        placeholder={t('placeholder.filterIndexes')}
        value={indexFilterText}
        onChange={setIndexFilterText}
      />

      <Table
        rowKeyExtractor={getIndexSelectionKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedIndexes}
        loading={loading.indexes}
        rows={filteredAndSortedIndexes}
        sort={sort}
        onSort={handleSortIndexes}
        newRows={newIndexRows}
        newRowsPosition="end"
        removedRows={droppedIndexNames}
        columns={tableColumns}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title={t('common.save')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleSavePendingChanges}
        >
          <SaveIcon size={16} />
        </Button>

        <Button
          title={t('common.cancelChanges')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={clearPendingChanges}
        >
          <CancelIcon size={16} />
        </Button>

        <Button
          title={t('common.add')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleOpenNewIndexModal}
        >
          <AddIcon size={14} />
        </Button>

        <Button
          title={t('common.removeSelectedItems')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleRemoveSelectedIndexes}
        >
          <RemoveIcon size={16} />
        </Button>

        {mode !== 'create' && (
          <RefreshButton
            menuPlacement="top"
            color={theme.bar.color}
            onRefresh={() => loadTableIndexes(id_connection, { schema, table })}
          />
        )}

        <Spacer />

        <Text userSelect={false} title={t('common.totalItems')} color={theme.bar.color}>
          {t(
            filteredAndSortedIndexes.length === 1
              ? 'common.itemCountSingular'
              : 'common.itemCountPlural',
            { count: filteredAndSortedIndexes.length },
          )}
        </Text>

        {mode !== 'create' && (
          <Text userSelect={false} title={t('common.lastUpdatedAt')} color={theme.bar.color}>
            {t('common.updatedAt', { date: toDateTime(lastFetchDate.indexes) })}
          </Text>
        )}
      </Bar>
    </div>
  );
};

export default Indexes;
