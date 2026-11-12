import type { InitialWhere } from '@shared/types/database';
import { getTableFilterErrorMessage } from '@renderer/database/tableFilters';
import { useRowChanges } from '@renderer/hooks/useRowChanges';
import { useShallow } from 'zustand/react/shallow';
import { getErrorMessage } from '@shared/utils/error';
import React from 'react';
import { Button } from '@renderer/components/Button';
import { ContextMenu } from '@renderer/components/ContextMenu';
import ReferencePreview from '@renderer/components/ReferencePreview';
import ResizableContainer from '@renderer/components/ResizableContainer';
import ReferenceSelection from '@renderer/components/ReferenceSelection';
import ReferenceValuePreview from '@renderer/components/ReferenceValuePreview';
import Table, { ITableContextMenuData, ITableSelectedCellData } from '@renderer/components/Table';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { useAppTabStore } from '@renderer/stores/AppTab';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { generateHash } from '@shared/utils/string';
import type { IColumnReferenceInfo } from '@shared/types/database';
import TableInfoWithContext from '@renderer/views/TableInfo';
import type { IContextMenuTable } from '@renderer/views/TableInfo/components/Data';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { selectConnectionPresentations } from '@renderer/stores/Workspace/selectors';
import { IColumn, ISortDirection } from '@renderer/components/Table/dtos';
import { useToastStore } from '@renderer/stores/Toast';
import { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import { requestOpenTableWithFilter } from '@renderer/views/TableInfo/openWithFilterRequest';
import { prepareQueryVariables } from '../../utils/queryVariables';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import { ModalExportData } from '@renderer/components/ModalExportData';
import styles from './styles.module.css';
import { ResultContextMenu } from './components/ResultContextMenu';
import { ResultToolbar } from './components/ResultToolbar';
import { useQueryResultEditing } from './hooks/useQueryResultEditing';
import { useQueryResultPreview } from './hooks/useQueryResultPreview';
import { useResultCaptureExport } from './hooks/useResultCaptureExport';
import { useQueryResultSources } from './hooks/useQueryResultSources';

import IconMdiClose from '~icons/mdi/close';

interface ITabContentSelectProps {
  id_connection: string;
  data: IQueryResult;
  references: Map<string, IColumnReferenceInfo[]>;
  readOnly?: boolean;
  onScrollEnd(): void;
  onSort(column: IColumn, sortType?: ISortDirection | null): void;
  onRefresh(): void;
  onCancelQuery(): void;
  onToggleCapture(): void;
  onClearCapture(): void;
  cancelingQuery?: boolean;
}

type OpenTableWithFilterParams = {
  idConnection: string;
  schema: string;
  table: string;
  initialWhere?: InitialWhere;
};

export const TabContentSelect = (props: ITabContentSelectProps) => {
  const {
    id_connection,
    data,
    onScrollEnd,
    onSort,
    onRefresh,
    onCancelQuery,
    onToggleCapture,
    onClearCapture,
    cancelingQuery,
    references,
    readOnly,
  } = props;

  const activeTheme = useThemeStore((state) => state.activeTheme);
  const { t, language } = useI18nStore(
    useShallow((state) => ({ t: state.t, language: state.language })),
  );
  const { addTab, getTab, setActiveTabId } = useAppTabStore(
    useShallow((state) => ({
      addTab: state.addTab,
      getTab: state.getTab,
      setActiveTabId: state.setActiveTabId,
    })),
  );
  const getQueryRowsCount = useDatabaseStore((state) => state.getQueryRowsCount);
  const connections = useWorkspaceStore((state) => state.connections);
  const connectionDialect = useWorkspaceStore(
    (state) => selectConnectionPresentations(state).get(id_connection)?.dialect,
  );
  const showToast = useToastStore((state) => state.showToast);

  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [selectedCell, setSelectedCell] = React.useState<ITableSelectedCellData>();
  const [previewTabBarId] = React.useState(`select_preview_${generateHash()}`);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [loadingRowsCount, setLoadingRowsCount] = React.useState(false);
  const [rowsCount, setRowsCount] = React.useState<number>();

  const { editableTable, canEditCell } = useQueryResultSources(data, readOnly);
  const singleResultTable = data.tables_info?.length === 1 ? data.tables_info[0] : undefined;

  const closeContextMenuTable = React.useCallback(() => {
    setContextMenuTable(undefined);
  }, []);

  const {
    editedFieldsRows,
    droppedRows,
    newRows,
    removedRowKeys,
    handleEditRow,
    handleEditNewRow,
    handleAddItem: handleAddRow,
    handleCancelSelectedRowsEditions,
    handleUndoSelectedDroppedRows,
    handleRemoveSelectedRows,
    setSelectedRows,
    resetRows,
  } = useRowChanges({
    items: data.rows || [],
    onCloseMenu: closeContextMenuTable,
    readOnly: !editableTable,
    discardNewRowsOnCancel: true,
  });

  const connection = connections.find((connection) => connection.id === id_connection);
  const dialect = connectionDialect || 'postgres';

  const {
    captureButtonColor,
    captureMenuPosition,
    captureMenuOptions,
    openCaptureMenu,
    closeCaptureMenu,
  } = useResultCaptureExport({
    data,
    activeColor: activeTheme.queryEditor.capture.activeColor,
    modifiedColor: activeTheme.queryEditor.capture.modifiedColor,
    defaultColor: activeTheme.queryEditor.bar.color,
    onToggleCapture,
    onClearCapture,
  });

  const { saving, handleSave } = useQueryResultEditing({
    idConnection: id_connection,
    data,
    readOnly,
    editedFieldsRows,
    droppedRows,
    newRows,
    resetRows,
    onRefresh,
  });
  const selectedCellEditable = !!selectedCell && !saving &&
    canEditCell(selectedCell.row, String(selectedCell.column.attribute));

  const {
    showValuePreview,
    previewWidth,
    activePreviewTab,
    selectedCellValue,
    tabFkMap,
    selectedReference,
    selectionReference,
    canSelectReferenceValue,
    previewTabs,
    closeValuePreview,
    toggleValuePreview,
    handlePreviewResize,
    handleActivePreviewTab,
    openReferencePreview,
  } = useQueryResultPreview({
    data,
    references,
    selectedCell,
    selectedCellEditable,
    connectionDatabase: connection?.database,
    editedFieldsRows,
    newRows,
  });

  const executionTimeMs = React.useMemo(() => {
    if (data.loading && data.date_run) {
      const startedAt = new Date(data.date_run).getTime();

      if (!Number.isNaN(startedAt)) return Math.max(0, now - startedAt);
    }

    return data.execution_time_ms;
  }, [data.loading, data.date_run, data.execution_time_ms, now]);

  const handleLoadRowsCount = React.useCallback(async () => {
    if (loadingRowsCount || data.loading) return;

    setLoadingRowsCount(true);

    try {
      const preparedQuery = prepareQueryVariables(data.query, data.variableValues);
      const total = await getQueryRowsCount(id_connection, preparedQuery);

      setRowsCount(total);
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: t('toast.countRowsError'),
        description: getErrorMessage(error) || t('common.unknownError'),
        delay: 8000,
      });
    } finally {
      setLoadingRowsCount(false);
    }
  }, [
    id_connection,
    data.query,
    data.variableValues,
    data.loading,
    loadingRowsCount,
    getQueryRowsCount,
    showToast,
    t,
  ]);

  const openExportModal = React.useCallback(() => {
    setShowExportModal(true);
    setContextMenuTable(undefined);
  }, []);

  const closeExportModal = React.useCallback(() => {
    setShowExportModal(false);
  }, []);

  const handleReferenceSelectionError = React.useCallback(
    (error: unknown) => {
      showToast({
        type: 'error',
        title: t('toast.selectionLoadError'),
        description: getErrorMessage(error) || t('common.unknownError'),
        delay: 8000,
      });
    },
    [showToast, t],
  );

  const handleApplySelectedCellValue = React.useCallback(
    (value: unknown) => {
      if (!selectedCellEditable) return;

      const row = selectedCell.row;
      const attribute = String(selectedCell.column.attribute);
      const normalizedValue = value === '' ? null : value;

      if (row.__is_new_row) {
        handleEditNewRow(row.__key_row, attribute, normalizedValue);
      } else {
        handleEditRow(row.__row_index ?? selectedCell.rowIndex, attribute, normalizedValue);
      }

      setSelectedCell((prevState) =>
        prevState ? { ...prevState, value: normalizedValue } : prevState,
      );
    },
    [handleEditNewRow, handleEditRow, selectedCell, selectedCellEditable],
  );

  const handleApplySelectedPreviewValue = React.useCallback(
    (value: string) => {
      if (!selectedCellEditable) return;

      handleApplySelectedCellValue(value);
    },
    [handleApplySelectedCellValue, selectedCellEditable],
  );

  const handleSelectReferenceValue = React.useCallback((value: unknown) => {
    if (!canSelectReferenceValue) return;
    handleApplySelectedCellValue(value);
  }, [canSelectReferenceValue, handleApplySelectedCellValue]);

  const handleSetSelectedCellsNull = React.useCallback(() => {
    if (saving) return;
    const cells = contextMenuTable?.data?.getSelectedCells() || [];

    cells.forEach(({ row, column, rowIndex }) => {
      if (!canEditCell(row, String(column.attribute))) return;

      const rowData = row;
      const attribute = String(column.attribute);

      if (rowData.__is_new_row) {
        handleEditNewRow(rowData.__key_row, attribute, null);
        return;
      }

      handleEditRow(rowData.__row_index ?? rowIndex, attribute, null);
    });

    setContextMenuTable(undefined);
  }, [canEditCell, contextMenuTable, handleEditNewRow, handleEditRow, saving]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

      if (saving) return;
      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete' && editableTable) {
        event.preventDefault();
        handleRemoveSelectedRows();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelSelectedRowsEditions();
        handleUndoSelectedDroppedRows();
      }
    },
    [
      editableTable,
      handleCancelSelectedRowsEditions,
      handleRemoveSelectedRows,
      handleSave,
      handleUndoSelectedDroppedRows,
      saving,
    ],
  );

  const onContextMenuTable = React.useCallback((
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: ITableContextMenuData,
  ) => {
    setContextMenuTable({ data, position: { x: event.clientX, y: event.clientY } });
  }, []);

  const openTableDataTabWithFilter = React.useCallback(
    (params: OpenTableWithFilterParams) => {
      const { idConnection, schema, table, initialWhere } = params;
      const tabId = `${idConnection}_${schema}_${table}`;
      const existingTab = getTab(tabId);

      if (existingTab?.unsaved) {
        setActiveTabId(tabId);
        requestOpenTableWithFilter({ ...params, tabId });
        return;
      }

      addTab({
        id: tabId,
        replaceId: existingTab?.id,
        groupId: existingTab?.groupId,
        title: `${schema ? `${schema}.` : ''}${table}`,
        data: {
          type: 'table-info',
          id_connection: idConnection,
          schema,
          table,
          initialWhere,
          initialTab: 'tabData',
        },
        component: () => (
          <TableInfoWithContext
            id_connection={idConnection}
            schema={schema}
            table={table}
            appTabId={tabId}
            initialWhere={initialWhere}
            initialTab="tabData"
          />
        ),
      });

      if (existingTab) setActiveTabId(tabId);
    },
    [addTab, getTab, setActiveTabId],
  );

  const handleOpenReferenceTable = React.useCallback(
    (idConnection: string, schema: string, table: string, filterColumn: string, filterValue: unknown) => {
      openTableDataTabWithFilter({ idConnection, schema, table, initialWhere: { column: filterColumn, value: structuredClone(filterValue) } });
    },
    [openTableDataTabWithFilter],
  );

  const onCellLinkClick = React.useCallback(
    async (attribute: string, value: unknown) => {
      const ref = tabFkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;
      try {
        await handleOpenReferenceTable(id_connection, ref.reference_table_schema, ref.reference_table_name, ref.reference_column_name, value);
      } catch (error) {
        showToast({ type: 'error', title: t('common.unknownError'), description: getTableFilterErrorMessage(error, t) });
      }
    },
    [handleOpenReferenceTable, id_connection, tabFkMap, showToast, t],
  );

  const handleFkPreviewClick = React.useCallback(
    (attribute: string, value: unknown) => {
      const ref = tabFkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;

      openReferencePreview();
    },
    [openReferencePreview, tabFkMap],
  );

  const resultColumnsInfo = React.useMemo(
    () =>
      new Map(
        data.columns_info
          ?.filter((column) => column.type)
          .map((column) => [column.name, column.type]) || [],
      ),
    [data.columns_info],
  );

  const tableColumns = React.useMemo(() => {
    return (data.columns || []).map((column) => ({
      attribute: column,
      label: column,
      info: resultColumnsInfo.get(column),
      sortable: !readOnly,
      editable: !readOnly && !data.loading && !saving && !column.startsWith('__'),
      isLink: tabFkMap.has(column),
    }));
  }, [
    data.columns,
    readOnly,
    resultColumnsInfo,
    tabFkMap,
    data.loading,
    saving,
  ]);

  const exportSource = React.useMemo(
    () => ({
      type: 'query' as const,
      sql: prepareQueryVariables(data.query, data.variableValues),
      orderBy: data.orderBy,
    }),
    [data.orderBy, data.query, data.variableValues],
  );

  React.useEffect(() => {
    resetRows();
    setSelectedRows([]);
    setSelectedCell(undefined);
  }, [id_connection, data.rows, data.columns, data.query, resetRows, setSelectedRows]);

  React.useEffect(() => {
    setRowsCount(undefined);
  }, [data.query, data.variableValues]);

  React.useEffect(() => {
    if (!data.loading) return;

    setNow(Date.now());

    const interval = setInterval(() => setNow(Date.now()), 100);

    return () => clearInterval(interval);
  }, [data.loading, data.date_run, data.queryExecutionId]);

  return (
    <div
      className={styles.container}
      onKeyDown={handleKeyDown}
      style={
        {
          '--preview-border-color': activeTheme.queryEditor.bar.borderColor,
        } as React.CSSProperties
      }
    >
      <div className={styles.content}>
        <div className={styles.tableWrapper}>
          <Table
            loading={!!data.loading || saving}
            rows={data.rows}
            editedRows={editedFieldsRows}
            removedRows={removedRowKeys}
            sort={readOnly ? undefined : data.orderBy}
            onSort={readOnly || saving ? undefined : onSort}
            onScrollEnd={readOnly || saving ? undefined : onScrollEnd}
            onContextMenu={onContextMenuTable}
            onSelectRow={setSelectedRows}
            onSelectCellData={setSelectedCell}
            onCellLinkClick={onCellLinkClick}
            onCellLinkPreviewClick={handleFkPreviewClick}
            newRows={newRows}
            onEditNewRow={handleEditNewRow}
            onEditRow={handleEditRow}
            columns={tableColumns}
          />
        </div>

        {showValuePreview && (
          <ResizableContainer
            width={previewWidth}
            minWidth={356}
            maxWidth={900}
            direction="horizontal"
            horizontalResizeSide="left"
            className={styles.previewResizable}
            onResize={handlePreviewResize}
          >
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <TabBar
                  borderBottom
                  idTabBar={previewTabBarId}
                  activeTabId={activePreviewTab}
                  onActiveTab={handleActivePreviewTab}
                  ascentColor={activeTheme.queryEditor.tab.ascentColor}
                  backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
                  backgroundColorBar={activeTheme.queryEditor.tab.bar.backgroundColor}
                  borderColor={activeTheme.queryEditor.tab.borderColor}
                  color={activeTheme.queryEditor.tab.color}
                  tabs={previewTabs}
                />

                <Button
                  title={t('tooltip.closeValuePreview')}
                  backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
                  color={activeTheme.queryEditor.tab.color}
                  onClick={closeValuePreview}
                  width="auto"
                  icon={() => <IconMdiClose width={16} />}
                />
              </div>

              <TabWindow>
                <TabContent activeTabId={activePreviewTab} idTab="value">
                  <ReferenceValuePreview
                    key={`${selectedCell?.rowIndex ?? 'none'}:${selectedCell?.colIndex ?? 'none'}`}
                    column={selectedCell?.column}
                    readonly={!selectedCellEditable}
                    value={selectedCellValue}
                    onChange={handleApplySelectedPreviewValue}
                  />
                </TabContent>

                {!!selectedReference && (
                  <TabContent activeTabId={activePreviewTab} idTab="reference">
                    <ReferencePreview
                      active={activePreviewTab === 'reference'}
                      idConnection={id_connection}
                      initialReference={selectedReference}
                      initialValue={selectedCellValue}
                      onOpenTable={handleOpenReferenceTable}
                    />
                  </TabContent>
                )}

                {canSelectReferenceValue && (
                  <TabContent activeTabId={activePreviewTab} idTab="selection">
                    <ReferenceSelection
                      key={JSON.stringify([id_connection, selectionReference])}
                      active={activePreviewTab === 'selection'}
                      idConnection={id_connection}
                      reference={selectionReference}
                      onDataError={handleReferenceSelectionError}
                      onSelectValue={handleSelectReferenceValue}
                    />
                  </TabContent>
                )}
              </TabWindow>
            </div>
          </ResizableContainer>
        )}
      </div>

      <ResultToolbar
        data={data}
        readOnly={readOnly}
        editable={!!editableTable}
        saving={saving}
        cancelingQuery={cancelingQuery}
        loadingRowsCount={loadingRowsCount}
        rowsCount={rowsCount}
        showValuePreview={showValuePreview}
        executionTimeMs={executionTimeMs}
        captureButtonColor={captureButtonColor}
        barTheme={activeTheme.queryEditor.bar}
        captureTheme={activeTheme.queryEditor.capture}
        onSave={handleSave}
        onAddRow={handleAddRow}
        onToggleValuePreview={toggleValuePreview}
        onRefresh={onRefresh}
        onOpenExportModal={openExportModal}
        onOpenCaptureMenu={openCaptureMenu}
        onLoadRowsCount={handleLoadRowsCount}
        onCancelQuery={onCancelQuery}
      />

      <ModalExportData
        show={showExportModal}
        idConnection={id_connection}
        source={exportSource}
        fileName="query-result"
        onClose={closeExportModal}
      />

      <ResultContextMenu
        idConnection={id_connection}
        contextMenuTable={contextMenuTable}
        data={data}
        dialect={dialect}
        editable={!!editableTable && !saving}
        singleResultTable={singleResultTable}
        onClose={closeContextMenuTable}
        onOpenExportModal={openExportModal}
        onSetSelectedCellsNull={handleSetSelectedCellsNull}
        onRemoveSelectedRows={handleRemoveSelectedRows}
      />

      <ContextMenu
        placement="top"
        position={captureMenuPosition}
        onClose={closeCaptureMenu}
        options={captureMenuOptions}
      />
    </div>
  );
};
