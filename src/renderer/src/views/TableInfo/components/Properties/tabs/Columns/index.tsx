import { selectConnectionPresentations } from '@renderer/stores/Workspace/selectors';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { resolvePropertySelection } from '../../hooks/resolvePropertySelection';
import type { ColumnGridInput } from '@renderer/stores/TableInfo/types';
import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import type { IColumnInfo } from '@shared/types/database';
import { generateHash } from '@shared/utils/string';
import type {
  IPendingColumnChange,
  IPendingColumnCreate,
  IPendingIndexCreate,
  IPendingReferenceCreate,
} from '@renderer/database/ddl/types';
import { useTableInfoStore, type TableInfoStoreApi } from '@renderer/stores/TableInfo';
import { AddIcon, CancelIcon, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import type { IColumn, ISortDirection, ITableSort, TableEditBatch } from '@renderer/components/Table/dtos';
import { getNextSort } from '@renderer/utils/tableSort';
import { useFilteredSortedRows } from '../../hooks/useFilteredSortedRows';
import { useSelectionReconciliation } from '../../hooks/useSelectionReconciliation';
import { usePropertiesKeyboardShortcuts } from '../../hooks/usePropertiesKeyboardShortcuts';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import FilterInput from '@renderer/components/FilterInput';
import { requestStructureDdl, toStructureColumn, toStructureReference, toStructureRestriction } from '@renderer/stores/TableInfo/ddl';
import ModalNewColumn from './components/ModalNewColumn';
import {
  getColumnGridIdentity,
  getColumnGridTypeText,
  getColumnSearchValues,
  getColumnSelectionKey,
  getEditedColumnFields,
  getGeneratedConstraintName,
  getOriginalColumnName,
  parseBooleanLabelValue,
  serializeColumnBooleanLabels,
} from './utils';

interface IColumnsProps {
  tableStore: TableInfoStoreApi;
}

const Columns = ({ tableStore }: IColumnsProps) => {
  const {
    tableInfo: { properties: theme },
  } = useThemeStore((state) => state.activeTheme);
  const showToast = useToastStore((state) => state.showToast);
  const t = useI18nStore((state) => state.t);
  const {
    columns,
    pendingColumns,
    pendingDroppedColumns,
    pendingChangedColumns,
    pendingReferences,
    indexes,
    pendingIndexes,
    columnTypes,
    references,
    restrictions,
    addPendingColumn,
    addPendingIndex,
    addPendingRestriction,
    addPendingReference,
    removePendingColumn,
    addPendingDroppedColumns,
    removePendingDroppedColumns,
    removePendingChangedColumns,
    clearPendingChanges,
    loadColumnTypes,
    loadTableColumns,
    loadTableReferences,
    loadTableRestrictions,
    openPendingChangesSqlModal,
    lastFetchDate,
    loading,
    tableContext,
  } = useTableInfoStore(
    tableStore,
    useShallow((state) => ({
      columns: state.columns,
      pendingColumns: state.pendingColumns,
      pendingDroppedColumns: state.pendingDroppedColumns,
      pendingChangedColumns: state.pendingChangedColumns,
      pendingReferences: state.pendingReferences,
      indexes: state.indexes,
      pendingIndexes: state.pendingIndexes,
      columnTypes: state.columnTypes,
      references: state.references,
      restrictions: state.restrictions,
      addPendingColumn: state.addPendingColumn,
      addPendingIndex: state.addPendingIndex,
      addPendingRestriction: state.addPendingRestriction,
      addPendingReference: state.addPendingReference,
      removePendingColumn: state.removePendingColumn,
      addPendingDroppedColumns: state.addPendingDroppedColumns,
      removePendingDroppedColumns: state.removePendingDroppedColumns,
      removePendingChangedColumns: state.removePendingChangedColumns,
      clearPendingChanges: state.clearPendingChanges,
      loadColumnTypes: state.loadColumnTypes,
      loadTableColumns: state.loadTableColumns,
      loadTableReferences: state.loadTableReferences,
      loadTableRestrictions: state.loadTableRestrictions,
      openPendingChangesSqlModal: state.openPendingChangesSqlModal,
      lastFetchDate: state.lastFetchDate,
      loading: state.loading,
      tableContext: state.tableContext,
    })),
  );
  const { idConnection: id_connection, schema, table, mode, objectType, dialect } = tableContext;

  const structure = useWorkspaceStore((state) => selectConnectionPresentations(state).get(id_connection)?.structure);
  const catalogStatus = useWorkspaceStore((state) => state.dialectCatalog.status);
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedColumns, setSelectedColumns] = React.useState<IColumnInfo[]>([]);
  const [columnFilterText, setColumnFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [showNewColumnModal, setShowNewColumnModal] = React.useState(false);
  const isReadOnlyObject = objectType === 'view' || objectType === 'materialized_view';

  const lastFetchDateSerialized = toDateTime(lastFetchDate.columns);
  const booleanLabels = React.useMemo(
    () => ({ yes: t('common.yes'), no: t('common.no') }),
    [t],
  );
  const droppedColumnNames = React.useMemo(
    () => new Set(pendingDroppedColumns.map((column) => column.column_name)),
    [pendingDroppedColumns],
  );
  const changedColumnsByOriginalName = React.useMemo(
    () =>
      new Map(
        pendingChangedColumns.map((column) => [
          column.__originalColumn.column_name,
          serializeColumnBooleanLabels(column, booleanLabels),
        ]),
      ),
    [booleanLabels, pendingChangedColumns],
  );
  const existingColumns = React.useMemo(
    () => columns.map((column) => serializeColumnBooleanLabels(column, booleanLabels)),
    [booleanLabels, columns],
  );
  const editedColumnRows = React.useMemo(
    () =>
      new Map(
        pendingChangedColumns.map((column) => [
          column.__originalColumn.column_name,
          getEditedColumnFields(column, booleanLabels),
        ]),
      ),
    [booleanLabels, pendingChangedColumns],
  );
  const pendingColumnRows = React.useMemo(
    () => pendingColumns.map((column) => serializeColumnBooleanLabels(column, booleanLabels)),
    [booleanLabels, pendingColumns],
  );
  const allColumns = React.useMemo(
    () => [
      ...existingColumns.map(
        (column) => changedColumnsByOriginalName.get(column.column_name) || column,
      ),
      ...pendingColumnRows,
    ],
    [changedColumnsByOriginalName, existingColumns, pendingColumnRows],
  );
  const getSearchValues = React.useCallback((column: IColumnInfo) =>
    getColumnSearchValues(column, getColumnGridTypeText(column)), []);
  const filteredColumnsAndSortedColumns = useFilteredSortedRows({
    rows: existingColumns,
    filterText: columnFilterText,
    sort,
    getSearchValues,
  });

  const filteredPendingColumnRows = useFilteredSortedRows({
    rows: pendingColumnRows,
    filterText: columnFilterText,
    sort,
    getSearchValues,
  });
  const newColumnRows = React.useMemo(
    () =>
      new Map(
        filteredPendingColumnRows.map((column) => [
          (column as IPendingColumnCreate).__pendingId,
          column,
        ]),
      ),
    [filteredPendingColumnRows],
  );

  const handleSortColumns = React.useCallback(
    (column: IColumn<IColumnInfo>, sortType?: ISortDirection | null) => {
      setSort((current) => getNextSort(current, column.attribute, sortType));
    },
    [],
  );

  const tableColumns = React.useMemo<IColumn<IColumnInfo>[]>(
    () => [
      {
        label: t('column.columnName'),
        attribute: 'column_name',
        editable: !isReadOnlyObject,
        sortable: true,
      },
      {
        label: t('field.type'),
        attribute: 'data_type',
        editable: !isReadOnlyObject,
        sortable: true,
        type: 'autocomplete-free',
        dataAutocomplete: columnTypes,
        getEditValue: (column) => getColumnGridTypeText(column),
        render: (column) => getColumnGridTypeText(column),
      },
      {
        label: t('field.nullable'),
        attribute: 'is_nullable_label',
        editable: !isReadOnlyObject,
        sortable: true,
        type: 'autocomplete',
        dataAutocomplete: [booleanLabels.yes, booleanLabels.no],
      },
      ...(structure?.supportsAutoIncrement
        ? [
            {
              label: t('column.autoInc'),
              attribute: 'is_auto_increment_label' as const,
              editable: !isReadOnlyObject,
              sortable: true,
              type: 'autocomplete' as const,
              dataAutocomplete: [booleanLabels.yes, booleanLabels.no],
            },
          ]
        : []),
      {
        label: t('field.default'),
        attribute: 'column_default',
        editable: !isReadOnlyObject,
        sortable: true,
      },
      {
        label: t('field.comment'),
        attribute: 'description',
        editable: !isReadOnlyObject,
        sortable: true,
      },
    ],
    [booleanLabels, columnTypes, structure?.supportsAutoIncrement, tableStore, isReadOnlyObject, t],
  );

  const handleOpenNewColumnModal = React.useCallback(() => {
    setShowNewColumnModal(true);
    setContextMenuPosition(null);
  }, []);

  const handleAddPendingColumn = React.useCallback(
    (
      column: Parameters<typeof addPendingColumn>[0],
      options?: {
        constraintType?: 'primary_key' | 'unique_key';
        reference?: IPendingReferenceCreate;
        index?: IPendingIndexCreate;
      },
    ) => {
      const state = tableStore.getState();
      const changes = new Map(state.pendingChangedColumns.map((item) => [item.__originalColumn.column_name, item]));
      const allColumns = [...state.columns.map((item) => changes.get(item.column_name) || item), ...state.pendingColumns];
      const { references, pendingReferences, indexes, pendingIndexes } = state;
      const columnName = column.column_name.toLowerCase();
      const alreadyExists = allColumns.some(
        (item) => item.column_name.toLowerCase() === columnName,
      );

      if (alreadyExists) {
        showToast({ type: 'warn', title: t('toast.columnExists') });
        return false;
      }

      if (options?.reference) {
        const referenceConstraintName = options.reference.constraint_name.toLowerCase();
        const referenceAlreadyExists = [...references, ...pendingReferences].some(
          (item) => item.constraint_name.toLowerCase() === referenceConstraintName,
        );

        if (referenceAlreadyExists) {
          showToast({ type: 'warn', title: t('toast.foreignKeyExists') });
          return false;
        }
      }

      if (options?.index) {
        const indexName = options.index.index_name.toLowerCase();
        const indexAlreadyExists = [...indexes, ...pendingIndexes].some(
          (item) => item.index_name.toLowerCase() === indexName,
        );

        if (indexAlreadyExists) {
          showToast({ type: 'warn', title: t('toast.indexExists') });
          return false;
        }
      }

      addPendingColumn(column);

      if (options?.index) {
        addPendingIndex(options.index);
      }

      if (options?.constraintType) {
        addPendingRestriction({
          __pendingId: generateHash(),
          constraint_name: getGeneratedConstraintName(table, options.constraintType, [
            column.column_name,
          ]),
          constraint_type: options.constraintType,
          column_names: [column.column_name],
        });
      }

      if (options?.reference) {
        addPendingReference({
          ...options.reference,
          table_schema: schema,
          table_name: table,
          column_name: column.column_name,
        });
      }

      return true;
    },
    [
      addPendingColumn,
      addPendingIndex,
      addPendingReference,
      addPendingRestriction,
      allColumns,
      indexes,
      pendingIndexes,
      pendingReferences,
      references,
      schema,
      showToast,
      table,
      t,
    ],
  );

  const handleEditColumnBatch = React.useCallback(
    ({ edits }: TableEditBatch) => {
      const inputs: ColumnGridInput[] = [];
      const newRows = new Map(pendingColumnRows.map((item) => [(item as IPendingColumnCreate).__pendingId, item]));
      for (const edit of edits) {
        const column = edit.isNewRow
          ? newRows.get(String(edit.rowKey))
          : filteredColumnsAndSortedColumns[edit.rowIndex];
        if (!column) continue;
        const identity = getColumnGridIdentity(column);
        if (edit.attribute === 'is_nullable_label' || edit.attribute === 'is_auto_increment_label') {
          inputs.push({ identity, edit: {
            attribute: edit.attribute === 'is_nullable_label' ? 'is_nullable' : 'is_auto_increment',
            value: parseBooleanLabelValue(edit.value, booleanLabels),
          } });
        } else if (edit.attribute === 'column_name' || edit.attribute === 'data_type' ||
                   edit.attribute === 'column_default' || edit.attribute === 'description') {
          inputs.push({ identity, edit: { attribute: edit.attribute, value: edit.value ?? null } });
        }
      }
      tableStore.getState().editColumnGrid(inputs);
    },
    [booleanLabels, filteredColumnsAndSortedColumns, pendingColumnRows, tableStore],
  );

  const handleRemoveSelectedColumns = React.useCallback(() => {
    if (!selectedColumns.length) {
      showToast({ type: 'warn', title: t('toast.selectColumnsRemove') });
      return;
    }

    selectedColumns.forEach((column) => {
      const pendingId = (column as IPendingColumnCreate).__pendingId;

      if (pendingId) {
        removePendingColumn(pendingId);
        return;
      }

      addPendingDroppedColumns([(column as IPendingColumnChange).__originalColumn || column]);
    });

    setContextMenuPosition(null);
  }, [selectedColumns, removePendingColumn, addPendingDroppedColumns, showToast, t]);

  const handleClearPendingChanges = React.useCallback(() => {
    clearPendingChanges();
    setSelectedColumns([]);
  }, [clearPendingChanges]);

  const handleSavePendingChanges = React.useCallback(() => {
    openPendingChangesSqlModal(
      id_connection,
      { schema, table },
      { mode },
    );
  }, [
    id_connection,
    mode,
    openPendingChangesSqlModal,
    schema,
    table,
  ]);

  const handleUndoSelectedDroppedColumns = React.useCallback(() => {
    const names = selectedColumns.map(getOriginalColumnName);
    removePendingDroppedColumns(names);
    removePendingChangedColumns(names);
    setSelectedColumns([]);
  }, [
    selectedColumns,
    changedColumnsByOriginalName,
    droppedColumnNames,
    removePendingDroppedColumns,
    removePendingChangedColumns,
  ]);

  const contextMenuOptions = React.useMemo(() => {
    if (isReadOnlyObject) return [];

    return [
      {
        text: t('column.newColumn'),
        onClick: handleOpenNewColumnModal,
      },
      {
        text: t('common.duplicateSelectedItems'),
        onClick: () => null,
      },
      {
        text: t('context.deleteSelectedItems'),
        onClick: handleRemoveSelectedColumns,
      },
      {
        text: t('modal.generateDdl'),
        onClick: async () => {
          const context = tableStore.getState().tableContext;
          const isCurrent = () => tableStore.getState().tableContext === context;
          const state = tableStore.getState();
          const changes = new Map(state.pendingChangedColumns.map((column) => [column.__originalColumn.column_name, column]));
          const current = state.columns.map((column) => changes.get(column.column_name) || column);
          const selected = resolvePropertySelection(selectedColumns, current, state.pendingColumns, getOriginalColumnName);
          const sql = await requestStructureDdl({type:'add-columns',policyId:dialect,target:{schema,table},columns:selected.map(toStructureColumn),references:state.references.map(toStructureReference),restrictions:state.restrictions.map(toStructureRestriction)}, isCurrent);
          if (!sql || !isCurrent()) return;
          setDdlSql(sql);
          setShowDdlModal(true);
        },
      },
    ];
  }, [
    schema,
    table,
    selectedColumns,
    references,
    restrictions,
    dialect,
    handleOpenNewColumnModal,
    handleRemoveSelectedColumns,
    isReadOnlyObject,
    t,
  ]);

  const onContextMenuTable = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      setContextMenuPosition({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  React.useEffect(() => {
    // Monta uma vez: a aba é recriada quando a tabela/conexão muda.
    loadColumnTypes(id_connection);

    if (mode === 'create') return;

    loadTableColumns(id_connection, { schema, table }, true);
    loadTableRestrictions(id_connection, { schema, table }, true);
    loadTableReferences(id_connection, { schema, table }, true);
  }, []);

  React.useEffect(() => {
    setSelectedColumns([]);
  }, [columnFilterText]);

  useSelectionReconciliation({
    rows: allColumns,
    setSelectedRows: setSelectedColumns,
    getSelectionKey: getColumnSelectionKey,
  });

  const handleKeyDown = usePropertiesKeyboardShortcuts({
    onRemove: handleRemoveSelectedColumns,
    onSave: handleSavePendingChanges,
    onUndo: handleUndoSelectedDroppedColumns,
  });
  const displayedColumnCount = filteredColumnsAndSortedColumns.length;

  return (
    <div style={{ display: 'contents' }} onKeyDown={isReadOnlyObject ? undefined : handleKeyDown}>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL
        show={showDdlModal}
        sql={ddlSql}
        onClose={() => setShowDdlModal(false)}
      />

      <ModalNewColumn
        show={showNewColumnModal}
        tableStore={tableStore}
        onClose={() => setShowNewColumnModal(false)}
        onAdd={handleAddPendingColumn}
      />

      {!structure && (catalogStatus === 'error' || catalogStatus === 'ready') && (
        <Button text onClick={() => { void useWorkspaceStore.getState().loadDialectCatalog().catch(() => {}); }}>
          {t('column.retryDraft')}
        </Button>
      )}

      <FilterInput
        filterBar={theme.bar}
        placeholder={t('placeholder.filterColumns')}
        value={columnFilterText}
        onChange={setColumnFilterText}
      />

      <Table
        loading={loading.columns}
        rowKeyExtractor={getColumnSelectionKey}
        onContextMenu={isReadOnlyObject ? undefined : onContextMenuTable}
        onSelectRow={setSelectedColumns}
        rows={filteredColumnsAndSortedColumns}
        onEditBatch={isReadOnlyObject ? undefined : handleEditColumnBatch}
        editedRows={editedColumnRows}
        newRows={newColumnRows}
        newRowsPosition="end"
        removedRows={droppedColumnNames}
        sort={sort}
        onSort={handleSortColumns}
        columns={tableColumns}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        {!isReadOnlyObject && (
          <>
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
              onClick={handleClearPendingChanges}
            >
              <CancelIcon size={16} />
            </Button>

            <Button
              title={t('common.add')}
              text
              smallIcon
              color={theme.bar.color}
              onClick={handleOpenNewColumnModal}
            >
              <AddIcon size={14} />
            </Button>

            <Button
              title={t('common.removeSelectedItems')}
              text
              smallIcon
              color={theme.bar.color}
              onClick={handleRemoveSelectedColumns}
            >
              <RemoveIcon size={16} />
            </Button>
          </>
        )}

        {mode !== 'create' && (
          <RefreshButton
            menuPlacement="top"
            color={theme.bar.color}
            onRefresh={() => loadTableColumns(id_connection, { schema, table })}
          />
        )}

        <Spacer />

        <Text userSelect={false} title={t('common.totalItems')} color={theme.bar.color}>
          {t(displayedColumnCount === 1 ? 'common.itemCountSingular' : 'common.itemCountPlural', {
            count: displayedColumnCount,
          })}
        </Text>

        {mode !== 'create' && (
          <Text userSelect={false} title={t('common.lastUpdatedAt')} color={theme.bar.color}>
            {t('common.updatedAt', { date: lastFetchDateSerialized })}
          </Text>
        )}
      </Bar>
    </div>
  );
};

export default React.memo(Columns);
