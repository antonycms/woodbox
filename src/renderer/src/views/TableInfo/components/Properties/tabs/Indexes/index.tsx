import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Bar } from '@renderer/components/Bar';
import type { IIndexInfo } from '@renderer/contexts/Store';
import { useStoreContext } from '@renderer/contexts/Store';
import { type IPendingIndexCreate, useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { AddIcon, CancelIcon, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort } from '@renderer/utils/tableSort';
import { useFilteredSortedRows } from '../../hooks/useFilteredSortedRows';
import { useSelectionReconciliation } from '../../hooks/useSelectionReconciliation';
import { usePropertiesKeyboardShortcuts } from '../../hooks/usePropertiesKeyboardShortcuts';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import FilterBar from '../../components/FilterBar';
import { generateIndexesDdl } from '../Columns/ddl';
import ModalNewIndex from './components/ModalNewIndex';
import { getRendererDialect } from '@renderer/database/dialects';
import { formatSizeFromBytes } from '@renderer/utils/methods';

const getIndexSelectionKey = (index: IIndexInfo) =>
  (index as IIndexInfo & { __pendingId?: string }).__pendingId || index.index_name;

const getIndexSizeText = (index: IIndexInfo) => {
  if (index.index_size_bytes === null || index.index_size_bytes === undefined) return undefined;

  const bytes = Number(index.index_size_bytes);

  if (!Number.isFinite(bytes)) return undefined;

  return formatSizeFromBytes(bytes);
};

const getIndexColumnsText = (index: IIndexInfo) => {
  const columnNames = index.column_names || [];

  return columnNames
    .map((columnName, indexColumn) => {
      const order = index.column_orders?.[indexColumn];

      return order ? `${columnName} ${order}` : columnName;
    })
    .join(', ');
};

type IIndexInfoSerialized = IIndexInfo & {
  column_names_display?: string;
  index_size?: string;
};

const getIndexSearchValues = (index: IIndexInfoSerialized) => [
  index.index_name,
  Array.isArray(index.column_names) ? index.column_names.join(', ') : index.column_names,
  index.column_names_display,
  index.is_unique,
  index.is_primary,
  index.index_method,
  index.is_valid,
  index.expression,
  index.predicate,
  index.index_size,
];

const Indexes = ({
  id_connection,
  schema,
  table,
  mode,
  tableComment,
  onCreateApplied,
}: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { connections } = useStoreContext();
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
  } = useTableInfoContext();
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
    // Monta uma vez: a aba é recriada quando a tabela/conexão muda.
    if (mode === 'create') return;

    loadTableIndexes(id_connection, { schema, table });
  }, []);

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
          title="Remover itens selecionados"
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

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredAndSortedIndexes?.length > 1
            ? `${filteredAndSortedIndexes?.length} Itens`
            : `${filteredAndSortedIndexes?.length || 0} Item`}
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
