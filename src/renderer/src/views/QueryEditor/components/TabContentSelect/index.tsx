import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import {
  ContextMenu,
  type IContextMenuOption,
  type IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import ReferencePreview from '@renderer/components/ReferencePreview';
import ResizableContainer from '@renderer/components/ResizableContainer';
import ReferenceSelection from '@renderer/components/ReferenceSelection';
import ReferenceValuePreview from '@renderer/components/ReferenceValuePreview';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Spacer } from '@renderer/components/Spacer';
import Table, { ITableContextMenuData, ITableSelectedCellData } from '@renderer/components/Table';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import type { ITab } from '@renderer/components/Tabs/components/TabBar';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import {
  AddIcon,
  CancelIcon,
  CountIcon,
  PanelFile,
  RecordIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { copyToClipboard } from '@renderer/utils/methods';
import { generateHash } from '@renderer/utils/string';
import TableInfoWithContext from '@renderer/views/TableInfo';
import type { IContextMenuTable } from '@renderer/views/TableInfo/components/Data';
import {
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  useStoreContext,
} from '@renderer/contexts/Store';
import { IColumn, ISortDirection } from '@renderer/components/Table/dtos';
import { useToast } from '@renderer/contexts/Toast';
import ModalGenerateDDL from '@renderer/views/TableInfo/components/Properties/components/ModalGenerateDDL';
import {
  generateDeleteDdl,
  generateInsertDdl,
  generateUpdateDdl,
} from '@renderer/views/TableInfo/components/Properties/tabs/Columns/ddl';
import { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import { getRendererDialect } from '@renderer/database/dialects';
import { emitConfirmOpenTableWithFilter } from '@renderer/views/TableInfo/events';
import { prepareQueryVariables } from '../../utils/queryVariables';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import styles from './styles.module.css';

import IconMdiClose from '~icons/mdi/close';

interface ITabContentSelectProps {
  id_connection: string;
  data: IQueryResult;
  references: Map<string, IColumnReferenceInfo[]>;
  readOnly?: boolean;
  onScrollEnd(): void;
  onSort(column: IColumn<any>, sortType?: ISortDirection | null): void;
  onRefresh(): void;
  onCancelQuery(): void;
  onToggleCapture(): void;
  onClearCapture(): void;
  cancelingQuery?: boolean;
}

type PreviewTab = 'value' | 'reference' | 'selection';

type OpenTableWithFilterParams = {
  idConnection: string;
  schema: string;
  table: string;
  initialWhere: string;
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

  const { activeTheme } = useThemeContext();
  const { t, language } = useI18n();
  const { addTab, getTab, setActiveTabId } = useAppTabContext();
  const { getTableRestrictions, getQueryRowsCount, runSql, connections } = useStoreContext();
  const { showToast } = useToast();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );

  const [saving, setSaving] = React.useState(false);
  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [captureMenuPosition, setCaptureMenuPosition] = React.useState<IContextMenuPosition>();
  const [showValuePreview, setShowValuePreview] = React.useState(false);
  const [previewWidth, setPreviewWidth] = React.useState(420);
  const [selectedCell, setSelectedCell] = React.useState<ITableSelectedCellData>();
  const [previewTabBarId] = React.useState(`select_preview_${generateHash()}`);
  const [activePreviewTab, setActivePreviewTab] = React.useState<PreviewTab>('value');
  const [restrictionsCache, setRestrictionsCache] = React.useState(
    new Map<string, IColumnRestrictionsInfo[]>(),
  );
  const [editedFieldsRows, setEditedFieldsRows] = React.useState(
    new Map<number, Record<string, any>>(),
  );
  const [droppedRows, setDroppedRows] = React.useState<Map<React.Key, Record<string, any>>>(
    new Map(),
  );
  const [newRows, setNewRows] = React.useState<Map<React.Key, Record<string, any>>>(new Map());
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [loadingRowsCount, setLoadingRowsCount] = React.useState(false);
  const [rowsCount, setRowsCount] = React.useState<number>();

  const singleResultTable = data.tables_info?.length === 1 ? data.tables_info[0] : undefined;
  const editableTable = readOnly ? undefined : singleResultTable;

  const executionTimeMs = React.useMemo(() => {
    if (data.loading && data.date_run) {
      const startedAt = new Date(data.date_run).getTime();

      if (!Number.isNaN(startedAt)) return Math.max(0, now - startedAt);
    }

    return data.execution_time_ms;
  }, [data.loading, data.date_run, data.execution_time_ms, now]);

  const formatExecutionTime = (timeMs?: number) => {
    if (typeof timeMs !== 'number' || Number.isNaN(timeMs)) return '-';

    return timeMs < 1000 ? `${timeMs}ms` : `${(timeMs / 1000).toFixed(2)}s`;
  };

  const hasCapturedRows = !!data.capture?.rows.length;

  const captureButtonColor = data.capture?.active
    ? activeTheme.__colors.red
    : hasCapturedRows
      ? activeTheme.__colors.orange
      : activeTheme.queryEditor.bar.color;

  const stringifyCaptureValue = (value: unknown) =>
    JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item));

  const downloadCaptureFile = React.useCallback(
    (content: string, extension: string, type: string) => {
      const startedAt = data.capture?.started_at || new Date().toISOString();
      const fileDate = startedAt.replace(/[:.]/g, '-');
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `woodbox-captura-query-${fileDate}.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [data.capture?.started_at],
  );

  const formatCaptureCsvCell = (value: unknown) => {
    if (value === null || value === undefined) return '""';

    const text =
      typeof value === 'object' || typeof value === 'bigint'
        ? stringifyCaptureValue(value)
        : String(value);

    return `"${text.replace(/"/g, '""')}"`;
  };

  const buildCaptureCsv = (capturedRows: NonNullable<IQueryResult['capture']>['rows']) => {
    const columns = [
      ...capturedRows.reduce((acc, capturedRow) => {
        if (!capturedRow.row || typeof capturedRow.row !== 'object') return acc;

        Object.keys(capturedRow.row).forEach((column) => acc.add(column));

        return acc;
      }, new Set<string>()),
    ];
    const header = ['captured_at', ...columns].map(formatCaptureCsvCell).join(',');
    const rows = capturedRows.map((capturedRow) => {
      const row = capturedRow.row && typeof capturedRow.row === 'object' ? capturedRow.row : {};

      return [capturedRow.captured_at, ...columns.map((column) => row[column])]
        .map(formatCaptureCsvCell)
        .join(',');
    });

    return [header, ...rows].join('\n');
  };

  const handleExportCaptureJsonl = React.useCallback(() => {
    const capturedRows = data.capture?.rows || [];

    if (!capturedRows.length) {
      showToast({
        type: 'warn',
        title: t('toast.noCapturedRows'),
        description: t('toast.noCapturedRowsHelp'),
      });
      return;
    }

    const jsonl = capturedRows.map((row) => stringifyCaptureValue(row)).join('\n');
    downloadCaptureFile(jsonl, 'jsonl', 'application/x-ndjson;charset=utf-8');

    showToast({
      type: 'success',
      title: t('toast.captureExported'),
      description: t('capture.exportedRowsJsonl', {
        count: capturedRows.length.toLocaleString(language),
      }),
    });
  }, [data.capture?.rows, downloadCaptureFile, language, showToast, t]);

  const handleExportCaptureCsv = React.useCallback(() => {
    const capturedRows = data.capture?.rows || [];

    if (!capturedRows.length) {
      showToast({
        type: 'warn',
        title: t('toast.noCapturedRows'),
        description: t('toast.noCapturedRowsHelp'),
      });
      return;
    }

    const csv = buildCaptureCsv(capturedRows);
    downloadCaptureFile(`\ufeff${csv}`, 'csv', 'text/csv;charset=utf-8');

    showToast({
      type: 'success',
      title: t('toast.captureExported'),
      description: t('capture.exportedRowsCsv', {
        count: capturedRows.length.toLocaleString(language),
      }),
    });
  }, [data.capture?.rows, downloadCaptureFile, language, showToast, t]);

  const openCaptureMenu = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCaptureMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const captureMenuOptions = React.useMemo<IContextMenuOption[]>(
    () =>
      [
        {
          text: data.capture?.active ? 'Parar captura' : 'Iniciar captura',
          onClick: onToggleCapture,
        },
        hasCapturedRows && {
          text: 'Exportar captura como JSONL',
          onClick: handleExportCaptureJsonl,
        },
        hasCapturedRows && {
          text: 'Exportar captura como CSV',
          onClick: handleExportCaptureCsv,
        },
        hasCapturedRows && {
          text: 'Descartar captura',
          onClick: onClearCapture,
        },
      ].filter(Boolean) as IContextMenuOption[],
    [
      data.capture?.active,
      handleExportCaptureCsv,
      handleExportCaptureJsonl,
      hasCapturedRows,
      onClearCapture,
      onToggleCapture,
    ],
  );

  const handleLoadRowsCount = React.useCallback(async () => {
    if (loadingRowsCount || data.loading) return;

    setLoadingRowsCount(true);

    try {
      const preparedQuery = prepareQueryVariables(data.query, data.variableValues);
      const total = await getQueryRowsCount(id_connection, preparedQuery);

      setRowsCount(total);
    } catch (error) {
      showToast({
        type: 'error',
        title: t('toast.countRowsError'),
        description: error instanceof Error ? error.message : t('common.unknownError'),
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

  const closeValuePreview = React.useCallback(() => {
    setShowValuePreview(false);
    setActivePreviewTab('value');
  }, []);

  const selectedCellValue = React.useMemo(() => {
    if (!selectedCell) return undefined;

    const row = selectedCell.row as any;
    const attribute = String(selectedCell.column.attribute);
    const editedRow = editedFieldsRows.get(row.__key_row);
    const newRow = newRows.get(row.__key_row);

    if (newRow && attribute in newRow) return newRow[attribute];
    if (editedRow && attribute in editedRow) return editedRow[attribute];

    return row[attribute];
  }, [editedFieldsRows, newRows, selectedCell]);

  const tabFkMap = React.useMemo(() => {
    const map = new Map<string, IColumnReferenceInfo>();

    data?.tables_info?.forEach?.(({ name, schema }) => {
      const key = `${schema ? schema + '.' : ''}${name}`;

      references.get(key)?.forEach((ref) => map.set(ref.column_name, ref));
    });

    return map;
  }, [data?.tables_info, references]);

  const selectedReference = selectedCell
    ? tabFkMap.get(String(selectedCell.column.attribute))
    : undefined;

  const canSelectReferenceValue = !!selectedReference && selectedCell?.column.editable === true;

  const previewTabs = React.useMemo(
    () =>
      [
        { idTab: 'value', title: t('tabs.value') },
        selectedReference && { idTab: 'reference', title: t('reference.singular') },
        canSelectReferenceValue && { idTab: 'selection', title: t('tabs.selection') },
      ].filter(Boolean) as ITab[],
    [canSelectReferenceValue, selectedReference, t],
  );

  const toggleValuePreview = React.useCallback(() => {
    if (showValuePreview) {
      closeValuePreview();
      return;
    }

    setShowValuePreview(true);
  }, [closeValuePreview, showValuePreview]);

  const handlePreviewResize = React.useCallback((size: { width?: number }) => {
    if (size.width) setPreviewWidth(size.width);
  }, []);

  const handleActivePreviewTab = React.useCallback((tab?: ITab) => {
    setActivePreviewTab(tab?.idTab as PreviewTab);
  }, []);

  const closeDdlModal = React.useCallback(() => {
    setShowDdlModal(false);
  }, []);

  const closeContextMenuTable = React.useCallback(() => {
    setContextMenuTable(undefined);
  }, []);

  const closeCaptureMenu = React.useCallback(() => {
    setCaptureMenuPosition(undefined);
  }, []);

  const handleReferenceSelectionError = React.useCallback(
    (error: unknown) => {
      showToast({
        type: 'error',
        title: t('toast.selectionLoadError'),
        description: error instanceof Error ? error.message : t('common.unknownError'),
        delay: 8000,
      });
    },
    [showToast, t],
  );

  const rowsWithPendingStyles = React.useMemo(
    () =>
      data.rows.map((row, index) => {
        if (droppedRows.has(index)) {
          return {
            ...row,
            __pendingAction: 'drop',
            __style: {
              ...(row as any).__style,
              backgroundColor: activeTheme.__colors.redTransparent,
              textDecoration: 'line-through',
            },
          };
        }

        if (!editedFieldsRows.has(index)) return row;

        return {
          ...row,
          __style: {
            ...(row as any).__style,
            backgroundColor: activeTheme.__colors.orangeTransparent,
          },
        };
      }),
    [
      activeTheme.__colors.orangeTransparent,
      activeTheme.__colors.redTransparent,
      data.rows,
      droppedRows,
      editedFieldsRows,
    ],
  );

  const handleEditRow = React.useCallback(
    (index: number, attribute: string, value: any) => {
      const normalizedValue = value === '' ? null : value;
      const row = data.rows[index];

      setEditedFieldsRows((prevState) => {
        const nextState = new Map(prevState);
        const prevRowEdited = { ...(prevState.get(index) || {}) };
        const originalValue = row?.[attribute];

        if (String(originalValue ?? '') === String(normalizedValue ?? '')) {
          delete prevRowEdited[attribute];

          if (Object.keys(prevRowEdited).length) nextState.set(index, prevRowEdited);
          else nextState.delete(index);

          return nextState;
        }

        nextState.set(index, { ...prevRowEdited, [attribute]: normalizedValue });

        return nextState;
      });
    },
    [data.rows],
  );

  const handleEditNewRow = React.useCallback((rowKey: React.Key, attribute: string, value: any) => {
    const normalizedValue = value === '' ? null : value;

    setNewRows((prevState) => {
      const nextState = new Map(prevState);
      const prevRowEdited = { ...(nextState.get(rowKey) || {}) };

      nextState.set(rowKey, { ...prevRowEdited, [attribute]: normalizedValue });

      return nextState;
    });
  }, []);

  const handleApplySelectedCellValue = React.useCallback(
    (value: any) => {
      if (!selectedCell?.column.editable) return;

      const row = selectedCell.row as any;
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
    [handleEditNewRow, handleEditRow, selectedCell],
  );

  const handleApplySelectedPreviewValue = React.useCallback(
    (value: string) => {
      if (!selectedCell?.column.editable) return;

      handleApplySelectedCellValue(value);
    },
    [handleApplySelectedCellValue, selectedCell],
  );

  const getPrimaryKeyColumns = React.useCallback(async () => {
    if (!editableTable?.name) return [];

    const key = `${editableTable.schema}.${editableTable.name}`;

    let _restrictions = restrictionsCache.get(key);

    if (!_restrictions) {
      _restrictions = await getTableRestrictions(id_connection, {
        schema: editableTable.schema,
        table: editableTable.name,
      });

      setRestrictionsCache((prevState) => {
        const nextState = new Map(prevState);
        nextState.set(key, _restrictions || []);
        return nextState;
      });
    }

    const pk = _restrictions.find((restriction) => restriction.constraint_type === 'primary_key');

    return pk?.column_names || [];
  }, [id_connection, editableTable, getTableRestrictions, restrictionsCache]);

  const handleSave = React.useCallback(async () => {
    const rowsToInsert = [...newRows.values()].filter((row) => Object.keys(row).length);
    const rowsToDelete = [...droppedRows.values()];

    if ((!rowsToInsert.length && !editedFieldsRows.size && !rowsToDelete.length) || saving) {
      return;
    }

    if (!editableTable?.name) {
      showToast({
        type: 'error',
        title: t('toast.saveNotPossible'),
        description: t('toast.querySingleTableRequired'),
      });

      return;
    }

    setSaving(true);

    try {
      let deleteSql = '';
      let updateSql = '';

      if (editedFieldsRows.size || rowsToDelete.length) {
        const primaryKeyColumns = await getPrimaryKeyColumns();

        if (!primaryKeyColumns.length) {
          const fullName = [editableTable.schema, editableTable.name].filter(Boolean).join('.');

          showToast({
            type: 'error',
            title: t('toast.saveNotPossible'),
            description: t('query.tableNoPrimaryKey', { table: fullName }),
          });

          return;
        }

        const missingPk = primaryKeyColumns.find((pkColumn) => !data.columns?.includes(pkColumn));

        if (missingPk) {
          showToast({
            type: 'error',
            title: t('toast.saveNotPossible'),
            description: t('query.rowMissingPk', { pk: missingPk }),
          });

          return;
        }

        if (rowsToDelete.length) {
          deleteSql = generateDeleteDdl(
            dialect,
            editableTable.schema,
            editableTable.name,
            rowsToDelete,
            primaryKeyColumns,
          );
        }

        if (editedFieldsRows.size) {
          const rowsToUpdate = [...editedFieldsRows.entries()]
            .map(([index, changes]) => ({
              originalRow: data.rows[index],
              changes,
              rowKey: index,
            }))
            .filter((row) => !droppedRows.has(row.rowKey));

          updateSql = generateUpdateDdl(
            dialect,
            editableTable.schema,
            editableTable.name,
            rowsToUpdate,
            primaryKeyColumns,
          );
        }
      }

      const insertSql = generateInsertDdl(
        dialect,
        editableTable.schema,
        editableTable.name,
        rowsToInsert,
        data.columns,
      );
      const sql = [deleteSql, insertSql, updateSql].filter((item) => item.trim()).join('\n\n');

      if (!sql) return;

      await runSql(id_connection, sql);

      setNewRows(new Map());
      setEditedFieldsRows(new Map());
      setDroppedRows(new Map());
      showToast({ type: 'success', title: t('toast.dataSaved') });
      onRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: t('toast.dataSaveError'),
        description: error?.message,
        delay: 8000,
      });
    } finally {
      setSaving(false);
    }
  }, [
    data.rows,
    data.columns,
    droppedRows,
    editedFieldsRows,
    editableTable,
    getPrimaryKeyColumns,
    id_connection,
    newRows,
    onRefresh,
    runSql,
    saving,
    showToast,
    t,
  ]);

  const handleCancelSelectedRowsEditions = React.useCallback(() => {
    if (!selectedRows.length) return;

    setNewRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        if (row.__is_new_row) nextState.delete(row.__key_row);
      });

      return nextState;
    });

    setEditedFieldsRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        nextState.delete(row.__key_row);
      });

      return nextState;
    });
  }, [selectedRows]);

  const handleSetSelectedCellsNull = React.useCallback(() => {
    const cells = contextMenuTable?.data?.selectedCells || [];

    cells.forEach(({ row, column, rowIndex }) => {
      if (!column.editable) return;

      const rowData = row as any;
      const attribute = String(column.attribute);

      if (rowData.__is_new_row) {
        handleEditNewRow(rowData.__key_row, attribute, null);
        return;
      }

      handleEditRow(rowData.__row_index ?? rowIndex, attribute, null);
    });

    setContextMenuTable(undefined);
  }, [contextMenuTable, handleEditNewRow, handleEditRow]);

  const handleUndoSelectedDroppedRows = React.useCallback(() => {
    if (!selectedRows.length) return;

    setDroppedRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        nextState.delete(row.__key_row);
      });

      return nextState;
    });
  }, [selectedRows]);

  const handleRemoveSelectedRows = React.useCallback(() => {
    if (!editableTable) return;

    if (!selectedRows.length) {
      showToast({ type: 'warn', title: t('toast.selectRowsRemove') });
      return;
    }

    setNewRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        if (row.__is_new_row) nextState.delete(row.__key_row);
      });

      return nextState;
    });

    setDroppedRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        if (!row.__is_new_row) nextState.set(row.__key_row, row);
      });

      return nextState;
    });

    setEditedFieldsRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        nextState.delete(row.__key_row);
      });

      return nextState;
    });

    setContextMenuTable(undefined);
  }, [editableTable, selectedRows, showToast, t]);

  const handleAddRow = React.useCallback(() => {
    setNewRows((prevState) => new Map(prevState).set(`new_${generateHash()}`, {}));
  }, []);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

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
    ],
  );

  React.useEffect(() => {
    if (!selectedReference && activePreviewTab !== 'value') {
      setActivePreviewTab('value');
      return;
    }

    if (activePreviewTab === 'selection' && !canSelectReferenceValue) {
      setActivePreviewTab(selectedReference ? 'reference' : 'value');
    }
  }, [activePreviewTab, canSelectReferenceValue, selectedReference]);

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
        emitConfirmOpenTableWithFilter({ ...params, tabId });
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

  const onCellLinkClick = React.useCallback(
    (attribute: string, value: any) => {
      const ref = tabFkMap.get(attribute);

      if (!ref || value === null || value === undefined) return;

      const escapedValue = String(value).replace(/'/g, "''");
      const initialWhere = `${dialect.quoteIdent(ref.reference_column_name)} = '${escapedValue}'`;

      openTableDataTabWithFilter({
        idConnection: id_connection,
        schema: ref.reference_table_schema,
        table: ref.reference_table_name,
        initialWhere,
      });
    },
    [dialect, id_connection, openTableDataTabWithFilter, tabFkMap],
  );

  const handleFkPreviewClick = React.useCallback(
    (attribute: string, value: any) => {
      const ref = tabFkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;

      setShowValuePreview(true);
      setActivePreviewTab('reference');
    },
    [tabFkMap],
  );

  React.useEffect(() => {
    setEditedFieldsRows(new Map());
    setDroppedRows(new Map());
    setNewRows(new Map());
    setSelectedRows([]);
  }, [data.rows, data.columns, data.query]);

  React.useEffect(() => {
    setRowsCount(undefined);
  }, [data.query, data.variableValues]);

  React.useEffect(() => {
    if (!data.loading) return;

    setNow(Date.now());

    const interval = setInterval(() => setNow(Date.now()), 100);

    return () => clearInterval(interval);
  }, [data.loading, data.date_run, data.queryExecutionId]);

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
      editable: !!editableTable,
      isLink: tabFkMap.has(column),
    }));
  }, [data.columns, editableTable, readOnly, resultColumnsInfo, tabFkMap]);

  const contextMenuOptions = React.useMemo<IContextMenuOption[]>(() => {
    return [
      {
        text: t('common.copy'),
        onClick: () => copyToClipboard(contextMenuTable?.data?.cellsText || ''),
      },
      {
        text: t('context.copyRow'),
        onClick: () => copyToClipboard(contextMenuTable?.data?.rowsText || ''),
      },
      {
        text: t('context.copyRowJson'),
        onClick: () => copyToClipboard(contextMenuTable?.data?.rowsJson || ''),
      },
      {
        text: t('context.setSelectedCellsNull'),
        onClick: handleSetSelectedCellsNull,
        show: () => !!contextMenuTable?.data?.selectedCells?.some(({ column }) => column.editable),
      },
      {
        text: t('context.deleteSelectedItems'),
        onClick: handleRemoveSelectedRows,
        show: () => !!editableTable,
      },
      {
        text: t('context.insertDdlRow'),
        onClick: () => {
          if (!singleResultTable) return;

          setDdlSql(
            generateInsertDdl(
              dialect,
              singleResultTable.schema,
              singleResultTable.name,
              contextMenuTable?.data?.rows || [],
              data.columns,
            ),
          );
          setShowDdlModal(true);
        },
        show: () => !!singleResultTable,
      },
      {
        text: t('context.insertDdlSelectedCells'),
        onClick: () => {
          if (!singleResultTable) return;

          setDdlSql(
            generateInsertDdl(
              dialect,
              singleResultTable.schema,
              singleResultTable.name,
              contextMenuTable?.data?.selectedCellRows || [],
              data.columns,
            ),
          );
          setShowDdlModal(true);
        },
        show: () => !!singleResultTable,
      },
    ];
  }, [
    contextMenuTable,
    data.columns,
    dialect,
    editableTable,
    handleRemoveSelectedRows,
    handleSetSelectedCellsNull,
    singleResultTable,
    t,
  ]);

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
            loading={!!data.loading}
            rows={rowsWithPendingStyles}
            editedRows={editedFieldsRows}
            sort={readOnly ? undefined : data.orderBy}
            onSort={readOnly ? undefined : onSort}
            onScrollEnd={readOnly ? undefined : onScrollEnd}
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

              <TabWindow activeTabId={activePreviewTab}>
                <TabContent idTab="value">
                  <ReferenceValuePreview
                    key={`${selectedCell?.rowIndex ?? 'none'}:${selectedCell?.colIndex ?? 'none'}`}
                    column={selectedCell?.column}
                    dialect={dialect.editorDialect}
                    readonly={!selectedCell?.column.editable}
                    value={selectedCellValue}
                    onChange={handleApplySelectedPreviewValue}
                  />
                </TabContent>

                {!!selectedReference && (
                  <TabContent idTab="reference">
                    <ReferencePreview
                      active={activePreviewTab === 'reference'}
                      idConnection={id_connection}
                      initialReference={selectedReference}
                      initialValue={selectedCellValue}
                    />
                  </TabContent>
                )}

                {canSelectReferenceValue && (
                  <TabContent idTab="selection">
                    <ReferenceSelection
                      active={activePreviewTab === 'selection'}
                      idConnection={id_connection}
                      reference={selectedReference}
                      onDataError={handleReferenceSelectionError}
                      onSelectValue={handleApplySelectedCellValue}
                    />
                  </TabContent>
                )}
              </TabWindow>
            </div>
          </ResizableContainer>
        )}
      </div>

      <Bar
        backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
        borderColor={activeTheme.queryEditor.bar.borderColor}
      >
        {!readOnly && (
          <Button
            text
            smallIcon
            title={t('common.save')}
            color={activeTheme.queryEditor.bar.color}
            onClick={handleSave}
            loading={saving}
          >
            <SaveIcon size={16} />
          </Button>
        )}

        {!!editableTable && (
          <Button
            text
            smallIcon
            title={t('common.addRow')}
            onClick={handleAddRow}
            disabled={data.loading}
            color={activeTheme.queryEditor.bar.color}
          >
            <AddIcon size={14} />
          </Button>
        )}

        <Button
          text
          smallIcon
          title={showValuePreview ? t('tooltip.closeValuePreview') : t('tooltip.openPreview')}
          onClick={toggleValuePreview}
          color={activeTheme.queryEditor.bar.color}
        >
          <PanelFile size={16} />
        </Button>

        {!readOnly && (
          <RefreshButton
            menuPlacement="top"
            color={activeTheme.queryEditor.bar.color}
            disabled={data.loading}
            onRefresh={onRefresh}
          />
        )}

        <Button
          text
          smallIcon
          title={t('tooltip.captureOptions')}
          onClick={openCaptureMenu}
          disabled={data.loading}
          color={captureButtonColor}
        >
          <RecordIcon size={16} />
        </Button>

        <Button
          text
          smallIcon
          title={t('common.countTotalRows')}
          className={styles.countButton}
          onClick={handleLoadRowsCount}
          loading={loadingRowsCount}
          disabled={data.loading}
          color={activeTheme.queryEditor.bar.color}
        >
          <CountIcon size={16} />
          {rowsCount !== undefined && (
            <span className={styles.countValue}>{rowsCount.toLocaleString(language)}</span>
          )}
        </Button>

        {!!data.loading && (
          <Button
            text
            smallIcon
            title={t('common.cancelQuery')}
            onClick={onCancelQuery}
            loading={cancelingQuery}
            color={activeTheme.queryEditor.bar.color}
          >
            <CancelIcon size={16} />
          </Button>
        )}

        <Spacer />

        {(data.capture?.active || !!data.capture?.rows.length) && (
          <Text
            title={data.capture.active ? t('capture.activeTitle') : t('capture.stoppedTitle')}
            userSelect={false}
            color={
              data.capture.active ? activeTheme.__colors.red : activeTheme.queryEditor.bar.color
            }
          >
            {t('capture.status', {
              count: data.capture.rows.length.toLocaleString(language),
            })}
          </Text>
        )}

        <Text
          title={
            data.loading ? t('tooltip.currentQueryExecutionTime') : t('tooltip.queryExecutionTime')
          }
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {data.loading
            ? t('query.runningFor', { time: formatExecutionTime(executionTimeMs) })
            : formatExecutionTime(executionTimeMs)}
        </Text>

        <Text
          title={t('common.totalRowsDisplayed')}
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {t('query.displayedRows', { count: (data.rows || []).length })}
        </Text>

        <Text
          title={t('common.lastUpdatedAt')}
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {t('common.updatedAt', { date: toDateTime(data.date_run) })}
        </Text>
      </Bar>

      <ModalGenerateDDL
        show={showDdlModal}
        sql={ddlSql}
        dialect={dialect}
        onClose={closeDdlModal}
      />

      <ContextMenu
        position={contextMenuTable?.position}
        onClose={closeContextMenuTable}
        options={contextMenuOptions}
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
