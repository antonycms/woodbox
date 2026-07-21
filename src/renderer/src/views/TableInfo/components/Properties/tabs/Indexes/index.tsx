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
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateIndexesDdl } from '../Columns/ddl';
import ModalNewIndex from './components/ModalNewIndex';
import { getRendererDialect } from '@renderer/database/dialects';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import { formatSizeFromBytes } from '@renderer/utils/methods';
import styles from '../Columns/styles.module.css';

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
      __colors,
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

  const indexFilterTextSerialized = indexFilterText.trim().toLowerCase();
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
  const allIndexes = React.useMemo<IIndexInfo[]>(
    () => [
      ...indexes.map((index) => {
        const indexWithSize = {
          ...index,
          column_names_display: getIndexColumnsText(index),
          index_size: getIndexSizeText(index),
        };

        if (!droppedIndexNames.has(index.index_name)) return indexWithSize;

        return {
          ...indexWithSize,
          __pendingAction: 'drop',
          __style: {
            backgroundColor: __colors.redTransparent,
            textDecoration: 'line-through',
          },
        };
      }),
      ...pendingIndexes.map((index) => ({
        ...index,
        column_names_display: getIndexColumnsText(index),
        index_size: getIndexSizeText(index),
      })),
    ],
    [__colors.redTransparent, indexes, droppedIndexNames, pendingIndexes],
  );
  const filteredAndSortedIndexes = React.useMemo(() => {
    if (!indexFilterTextSerialized) return sortRows(allIndexes, sort);

    const texts = indexFilterTextSerialized.split(',').map((text) => text.trim());
    const indexesFiltered = allIndexes.filter((index) =>
      [
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
      ].some((value) =>
        texts.some(
          (text) =>
            text &&
            String(value ?? '')
              .toLowerCase()
              .includes(text),
        ),
      ),
    );

    return sortRows(indexesFiltered, sort);
  }, [allIndexes, indexFilterTextSerialized, sort]);

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
      .filter(
        (index) =>
          (index as { __pendingAction?: string }).__pendingAction === 'drop' ||
          droppedIndexNames.has(index.index_name),
      )
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

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        handleRemoveSelectedIndexes();
        return;
      }

      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSavePendingChanges();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleUndoSelectedDroppedIndexes();
      }
    },
    [handleRemoveSelectedIndexes, handleSavePendingChanges, handleUndoSelectedDroppedIndexes],
  );

  React.useEffect(() => {
    if (mode === 'create') return;

    loadTableIndexes(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedIndexes([]);
  }, [indexFilterTextSerialized]);

  React.useEffect(() => {
    setSelectedIndexes((currentSelectedIndexes) => {
      if (!currentSelectedIndexes.length) return currentSelectedIndexes;

      const indexesByKey = new Map(allIndexes.map((index) => [getIndexSelectionKey(index), index]));
      const nextSelectedIndexes = currentSelectedIndexes
        .map((index) => indexesByKey.get(getIndexSelectionKey(index)))
        .filter((index): index is IIndexInfo => !!index);

      if (
        nextSelectedIndexes.length === currentSelectedIndexes.length &&
        nextSelectedIndexes.every((index, idx) => index === currentSelectedIndexes[idx])
      ) {
        return currentSelectedIndexes;
      }

      return nextSelectedIndexes;
    });
  }, [allIndexes]);

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

      <div
        className={styles.filterBar}
        style={{
          backgroundColor: theme.bar.backgroundColor,
          borderColor: theme.bar.borderColor,
        }}
      >
        <input
          className={styles.filterInput}
          placeholder={t('placeholder.filterIndexes')}
          value={indexFilterText}
          onChange={(event) => setIndexFilterText(event.target.value)}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <Table
        rowKeyExtractor={getIndexSelectionKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedIndexes}
        loading={loading.indexes}
        rows={filteredAndSortedIndexes}
        sort={sort}
        onSort={(column, sortType) =>
          setSort((current) => getNextSort(current, column.attribute, sortType))
        }
        columns={[
          {
            title: t('common.orderByColumn'),
            label: t('field.name'),
            attribute: 'index_name',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('field.columns'),
            attribute: 'column_names_display',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('index.uniqueSingle'),
            attribute: 'is_unique',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('field.primaryKey'),
            attribute: 'is_primary',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('field.method'),
            attribute: 'index_method',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('field.valid'),
            attribute: 'is_valid',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('field.expression'),
            attribute: 'expression',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('field.predicate'),
            attribute: 'predicate',
            sortable: true,
          },
          {
            title: t('common.orderByColumn'),
            label: t('field.size'),
            attribute: 'index_size',
            sortable: true,
          },
        ]}
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
