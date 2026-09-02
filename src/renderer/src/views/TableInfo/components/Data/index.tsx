import React from 'react';
import Table, {
  type ITableContextMenuData,
  type ITableSelectedCellData,
} from '@renderer/components/Table';
import ReferencePreview from '@renderer/components/ReferencePreview';
import ReferenceValuePreview from '@renderer/components/ReferenceValuePreview';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { Spacer } from '@renderer/components/Spacer';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import type { ITab } from '@renderer/components/Tabs/components/TabBar';
import { copyToClipboard } from '@renderer/utils/methods';
import { ContextMenu, type IContextMenuOption } from '@renderer/components/ContextMenu';
import {
  AddIcon,
  CountIcon,
  DuplicateIcon,
  ExportIcon,
  PanelFile,
  RemoveIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import { RefreshButton } from '@renderer/components/RefreshButton';
import styles from './styles.module.css';
import { useStoreContext } from '@renderer/contexts/Store';
import { useI18n } from '@renderer/contexts/I18n';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { ITableInfoProps } from '../../dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { toDateTime } from '@renderer/utils/date';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { getNextSort } from '@renderer/utils/tableSort';
import { generateHash } from '@renderer/utils/string';
import ModalGenerateDDL from '../Properties/components/ModalGenerateDDL';
import {
  generateDeleteDdl,
  generateInsertDdl,
  generateUpdateDdl,
} from '../Properties/tabs/Columns/ddl';
import ModalDataError from './components/ModalDataError';
import ReferenceSelection from '@renderer/components/ReferenceSelection';
import { getRendererDialect } from '@renderer/database/dialects';
import ColumnFilterInput from '@renderer/components/ColumnFilterInput';
import { ModalExportData } from '@renderer/components/ModalExportData';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import useFilterHistory from '@renderer/hooks/useFilterHistory';

import IconMdiClose from '~icons/mdi/close';

interface IDataProps extends ITableInfoProps {
  onOpenTable?: (
    idConnection: string,
    schema: string,
    table: string,
    filterColumn: string,
    filterValue: string,
  ) => void;
  onRegisterRefresh?: (refresh: () => void | Promise<void>) => void;
  onPendingRowsChangesChange?: (hasPendingChanges: boolean) => void;
}

type PreviewTab = 'value' | 'reference' | 'selection';

const normalizeCellValue = (value: any) => (value === '' ? null : value);

const Data = ({
  id_connection,
  schema,
  table,
  appTabId,
  initialWhere,
  filterLocked,
  onOpenTable,
  onRegisterRefresh,
  onPendingRowsChangesChange,
  objectType = 'table',
}: IDataProps) => {
  const {
    activeTheme: {
      tableInfo: { data: theme, tab: tabTheme },
      modal: colors,
    },
  } = useThemeContext();
  const {
    columns,
    references,
    restrictions,
    loadTableColumns,
    loadTableReferences,
    loadTableRestrictions,
    loading: loadingTableInfo,
  } = useTableInfoContext();

  const { getTableData, getTableRowsCount, runSql, connections } = useStoreContext();
  const { t, language } = useI18n();
  const { showToast } = useToast();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingRowsCount, setLoadingRowsCount] = React.useState(false);
  const [rowsCount, setRowsCount] = React.useState<number>();
  const [dataErrorMessage, setDataErrorMessage] = React.useState<string>();
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const lastPageSearch = React.useRef(page);
  const [lastFetchDate, setLastFetchDate] = React.useState(new Date());
  const [editedFieldsRows, setEditedFieldsRows] = React.useState<
    Map<React.Key, Record<string, any>>
  >(new Map());
  const [droppedRows, setDroppedRows] = React.useState<Map<React.Key, Record<string, any>>>(
    new Map(),
  );
  const [newRows, setNewRows] = React.useState<Map<React.Key, Record<string, any>>>(new Map());
  const [showNoPkModal, setShowNoPkModal] = React.useState(false);
  const [applyingChanges, setApplyingChanges] = React.useState(false);
  const [whereInput, setWhereInput] = React.useState(initialWhere || '');
  const [appliedWhere, setAppliedWhere] = React.useState(initialWhere || '');
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [showValuePreview, setShowValuePreview] = React.useState(false);
  const [previewWidth, setPreviewWidth] = React.useState(420);
  const [selectedCell, setSelectedCell] = React.useState<ITableSelectedCellData>();
  const [previewTabBarId] = React.useState(`table_data_preview_${generateHash()}`);
  const [activePreviewTab, setActivePreviewTab] = React.useState<PreviewTab>('value');
  const [filterHistory, addFilterHistory] = useFilterHistory([id_connection, schema, table]);
  const isReadOnlyObject = objectType === 'view' || objectType === 'materialized_view';

  const handleDataError = React.useCallback(
    (error: unknown) => {
      setDataErrorMessage(error instanceof Error ? error.message : t('common.unknownError'));
    },
    [t],
  );

  const handleLoadRowsCount = React.useCallback(async () => {
    if (loadingRowsCount) return;

    setLoadingRowsCount(true);

    try {
      const total = await getTableRowsCount(id_connection, {
        schema,
        table,
        where: appliedWhere || undefined,
      });

      setRowsCount(total);
    } catch (error: unknown) {
      handleDataError(error);
    } finally {
      setLoadingRowsCount(false);
    }
  }, [
    id_connection,
    schema,
    table,
    appliedWhere,
    loadingRowsCount,
    getTableRowsCount,
    handleDataError,
  ]);

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

  const serializeRows = React.useCallback(
    (rows: any[]) =>
      rows.map((row) => ({
        ...row,
        __table_hash_item: `row_${generateHash()}`,
      })),
    [],
  );

  const fkMap = React.useMemo(
    () => new Map(references.map((r) => [r.column_name, r])),
    [references],
  );

  const selectedReference = selectedCell
    ? fkMap.get(String(selectedCell.column.attribute))
    : undefined;

  const previewTabs = React.useMemo(
    () =>
      [
        { idTab: 'value', title: t('tabs.value') },
        !!selectedReference && { idTab: 'reference', title: t('reference.singular') },
        !!selectedReference && { idTab: 'selection', title: t('tabs.selection') },
      ].filter(Boolean) as ITab[],
    [!!selectedReference, t],
  );

  const closeValuePreview = React.useCallback(() => {
    setShowValuePreview(false);
    setActivePreviewTab('value');
  }, []);

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

  const handleWhereInputChange = React.useCallback(
    (value: string) => {
      if (!filterLocked) setWhereInput(value);
    },
    [filterLocked],
  );

  const closeDdlModal = React.useCallback(() => {
    setShowDdlModal(false);
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

  const closeContextMenuTable = React.useCallback(() => {
    setContextMenuTable(undefined);
  }, []);

  const handleFkCellClick = React.useCallback(
    (attribute: string, value: any) => {
      const ref = fkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;
      onOpenTable?.(
        id_connection,
        ref.reference_table_schema,
        ref.reference_table_name,
        ref.reference_column_name,
        String(value),
      );
    },
    [fkMap, id_connection, onOpenTable],
  );

  const handleFkPreviewClick = React.useCallback(
    (attribute: string, value: any) => {
      const ref = fkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;

      setShowValuePreview(true);
      setActivePreviewTab('reference');
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

  const primaryKeyColumns = React.useMemo(
    () =>
      restrictions.find((restriction) => restriction.constraint_type === 'primary_key')
        ?.column_names || [],
    [restrictions],
  );

  const defaultColumnNames = React.useMemo(
    () =>
      new Set(
        columns.filter((column) => column.column_default).map((column) => column.column_name),
      ),
    [columns],
  );

  const hasPendingRowsChanges = React.useMemo(
    () =>
      [...newRows.values()].some((row) => Object.keys(row).length) ||
      !!editedFieldsRows.size ||
      !!droppedRows.size,
    [newRows, editedFieldsRows, droppedRows],
  );

  const handleEditNewRow = React.useCallback(
    (rowKey: React.Key, attribute: string, value: any, useDefaultOnNull = true) => {
      const normalizedValue = normalizeCellValue(value);

      setNewRows((prevState) => {
        const newState = new Map(prevState);
        const prevRowEdited = { ...(newState.get(rowKey) || {}) };

        if (useDefaultOnNull && normalizedValue === null && defaultColumnNames.has(attribute)) {
          delete prevRowEdited[attribute];
          newState.set(rowKey, prevRowEdited);
          return newState;
        }

        newState.set(rowKey, { ...prevRowEdited, [attribute]: normalizedValue });

        return newState;
      });
    },
    [defaultColumnNames],
  );

  const handleEditRow = React.useCallback(
    (index: number, attribute: string, value: any, rowKey?: React.Key) => {
      const normalizedValue = normalizeCellValue(value);
      const key = rowKey ?? index;
      const row = items[index];

      setEditedFieldsRows((prevState) => {
        const newState = new Map(prevState);
        const prevRowEdited = { ...(newState.get(key) || {}) };
        const originalValue = row?.[attribute];

        if (String(originalValue ?? '') === String(normalizedValue ?? '')) {
          delete prevRowEdited[attribute];

          if (Object.keys(prevRowEdited).length) newState.set(key, prevRowEdited);
          else newState.delete(key);

          return newState;
        }

        newState.set(key, { ...prevRowEdited, [attribute]: normalizedValue });

        return newState;
      });
    },
    [items],
  );

  const handleApplySelectedCellValue = React.useCallback(
    (value: any) => {
      if (!selectedCell) return;

      const row = selectedCell.row as any;
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

  const handleApplySelectedPreviewValue = React.useCallback(
    (value: string) => {
      if (!selectedCell?.column.editable) return;

      handleApplySelectedCellValue(value);
    },
    [handleApplySelectedCellValue, selectedCell],
  );

  const removedRowKeys = React.useMemo(
    () => new Set(droppedRows.keys()),
    [droppedRows],
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

  const rowKeyExtractor = React.useCallback((row: any, index: number) => {
    return row.__table_hash_item ?? index;
  }, []);

  const handleAddItem = React.useCallback(() => {
    const key = `new_${generateHash()}`;

    setNewRows((prevState) => new Map(prevState).set(key, {}));
  }, []);

  const handleDuplicateSelectedRows = React.useCallback(() => {
    if (!selectedRows.length) {
      showToast({ type: 'warn', title: t('toast.selectRowsDuplicate') });
      return;
    }

    setNewRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        const sourceRow = {
          ...row,
          ...(newRows.get(row.__key_row) || {}),
          ...(editedFieldsRows.get(row.__key_row) || {}),
        };

        const duplicatedRow = columns.reduce<Record<string, any>>((acc, column) => {
          if (primaryKeyColumns.includes(column.column_name)) return acc;

          acc[column.column_name] = sourceRow[column.column_name];
          return acc;
        }, {});

        nextState.set(`new_${generateHash()}`, duplicatedRow);
      });

      return nextState;
    });

    setContextMenuTable(undefined);
  }, [columns, editedFieldsRows, newRows, primaryKeyColumns, selectedRows, showToast]);

  const loadData = React.useCallback(async () => {
    const newPage = page + 1;

    if (loading || newPage === lastPageSearch.current) return;

    setLoading(true);

    try {
      const { data } = await getTableData(id_connection, {
        schema,
        table,
        page: newPage,
        where: appliedWhere || undefined,
        orderBy: sort,
      });

      setLastFetchDate(new Date());

      lastPageSearch.current = newPage;

      if (!data.length) return;

      setPage(newPage);
      setItems((prevState) => [...prevState, ...serializeRows(data)]);
    } catch (error: unknown) {
      handleDataError(error);
    } finally {
      setLoading(false);
    }
  }, [
    id_connection,
    loading,
    schema,
    table,
    page,
    appliedWhere,
    sort,
    serializeRows,
    handleDataError,
  ]);

  const handleRefresh = React.useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setRowsCount(undefined);

    try {
      const { data } = await getTableData(id_connection, {
        schema,
        table,
        page: 1,
        where: appliedWhere || undefined,
        orderBy: sort,
      });

      lastPageSearch.current = 1;
      setPage(1);
      setLastFetchDate(new Date());
      setNewRows(new Map());
      setEditedFieldsRows(new Map());
      setDroppedRows(new Map());
      setItems(serializeRows(data));
    } catch (error: unknown) {
      handleDataError(error);
    } finally {
      setLoading(false);
    }
  }, [id_connection, loading, schema, table, appliedWhere, sort, serializeRows, handleDataError]);

  const applyPendingRows = React.useCallback(
    async (whereColumns: string[]) => {
      const rowsToInsert = [...newRows.values()].filter((row) => Object.keys(row).length);
      const hasEditedRows = !!editedFieldsRows.size;
      const hasDroppedRows = !!droppedRows.size;

      if ((!rowsToInsert.length && !hasEditedRows && !hasDroppedRows) || applyingChanges) return;

      const rowsToUpdate = [...editedFieldsRows.entries()]
        .map(([rowKey, changes]) => ({
          originalRow:
            items.find((item) => item.__table_hash_item === rowKey) || items[Number(rowKey)],
          rowKey,
          changes,
        }))
        .filter(
          (row) =>
            row.originalRow && Object.keys(row.changes).length && !droppedRows.has(row.rowKey),
        );

      const deleteSql = generateDeleteDdl(
        dialect,
        schema,
        table,
        [...droppedRows.values()],
        whereColumns,
      );
      const insertSql = generateInsertDdl(
        dialect,
        schema,
        table,
        rowsToInsert,
        columns.map((column) => column.column_name),
      );
      const updateSql = generateUpdateDdl(dialect, schema, table, rowsToUpdate, whereColumns);
      const sql = [deleteSql, insertSql, updateSql].filter((item) => item.trim()).join('\n\n');

      if (!sql.trim()) return;

      setApplyingChanges(true);

      try {
        await runSql(id_connection, sql);
        setNewRows(new Map());
        setEditedFieldsRows(new Map());
        setDroppedRows(new Map());
        setShowNoPkModal(false);
        showToast({ type: 'success', title: t('toast.dataSaved') });
        await handleRefresh();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: t('toast.dataSaveError'),
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setApplyingChanges(false);
      }
    },
    [
      editedFieldsRows,
      droppedRows,
      newRows,
      applyingChanges,
      items,
      schema,
      table,
      columns,
      dialect,
      runSql,
      id_connection,
      showToast,
      handleRefresh,
      t,
    ],
  );

  const handleSaveItems = React.useCallback(() => {
    const hasNewRows = [...newRows.values()].some((row) => Object.keys(row).length);

    if (!hasNewRows && !editedFieldsRows.size && !droppedRows.size) return;

    if ((editedFieldsRows.size || droppedRows.size) && !primaryKeyColumns.length) {
      setShowNoPkModal(true);
      return;
    }

    applyPendingRows(primaryKeyColumns);
  }, [newRows, editedFieldsRows, droppedRows, primaryKeyColumns, applyPendingRows]);

  const handleApplyWithoutPrimaryKey = React.useCallback(() => {
    applyPendingRows(columns.map((column) => column.column_name));
  }, [applyPendingRows, columns]);

  const handleCancelSelectedRowsEditions = React.useCallback(() => {
    if (!selectedRows.length) return;

    setEditedFieldsRows((prevState) => {
      const newState = new Map(prevState);

      selectedRows.forEach((row) => {
        newState.delete(row.__key_row);
      });

      return newState;
    });
  }, [selectedRows]);

  const handleSetSelectedCellsNull = React.useCallback(() => {
    const cells = contextMenuTable?.data?.selectedCells || [];

    cells.forEach(({ row, column, rowIndex }) => {
      if (!column.editable) return;

      const rowData = row as any;
      const attribute = String(column.attribute);

      if (rowData.__is_new_row) {
        handleEditNewRow(rowData.__key_row, attribute, null, false);
        return;
      }

      handleEditRow(rowData.__row_index ?? rowIndex, attribute, null, rowData.__key_row);
    });

    setContextMenuTable(undefined);
  }, [contextMenuTable, handleEditNewRow, handleEditRow]);

  const handleUndoSelectedDroppedRows = React.useCallback(() => {
    if (!selectedRows.length) return;

    setDroppedRows((prevState) => {
      const newState = new Map(prevState);

      selectedRows.forEach((row) => {
        newState.delete(row.__key_row);
      });

      return newState;
    });
  }, [selectedRows]);

  const handleRemoveSelectedRows = React.useCallback(() => {
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
  }, [selectedRows, showToast, t]);

  const handleSort = React.useCallback(
    async (column: IColumn, sortType?: ISortDirection | null) => {
      if (loading || !column.sortable) return;

      const nextSort = getNextSort(sort, column.attribute, sortType);
      setLoading(true);

      try {
        const { data } = await getTableData(id_connection, {
          schema,
          table,
          page: 1,
          where: appliedWhere || undefined,
          orderBy: nextSort,
        });

        setSort(nextSort);
        setNewRows(new Map());
        setEditedFieldsRows(new Map());
        setDroppedRows(new Map());
        setItems(serializeRows(data));
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } catch (error: unknown) {
        handleDataError(error);
      } finally {
        setLoading(false);
      }
    },
    [id_connection, schema, table, appliedWhere, sort, loading, serializeRows, handleDataError],
  );

  const applyFilter = React.useCallback(
    async (nextWhereInput: string) => {
      if (loading) return;

      const newWhere = nextWhereInput || undefined;
      setLoading(true);
      setWhereInput(nextWhereInput);

      try {
        const { data } = await getTableData(id_connection, {
          schema,
          table,
          page: 1,
          where: newWhere,
          orderBy: sort,
        });

        setAppliedWhere(nextWhereInput);
        addFilterHistory(nextWhereInput);
        setRowsCount(undefined);
        setNewRows(new Map());
        setEditedFieldsRows(new Map());
        setDroppedRows(new Map());
        setItems(serializeRows(data));
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } catch (error: unknown) {
        handleDataError(error);
      } finally {
        setLoading(false);
      }
    },
    [
      addFilterHistory,
      getTableData,
      handleDataError,
      id_connection,
      loading,
      schema,
      serializeRows,
      sort,
      table,
    ],
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
    if (!selectedReference && activePreviewTab !== 'value') {
      setActivePreviewTab('value');
    }
  }, [activePreviewTab, selectedReference]);

  React.useEffect(() => {
    onRegisterRefresh?.(handleRefresh);
  }, [onRegisterRefresh, handleRefresh]);

  React.useEffect(() => {
    if (!appTabId) return;

    onPendingRowsChangesChange?.(hasPendingRowsChanges);
  }, [appTabId, hasPendingRowsChanges, onPendingRowsChangesChange]);

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
        text: t('modal.exportData'),
        onClick: openExportModal,
      },
      {
        text: t('context.setSelectedCellsNull'),
        onClick: handleSetSelectedCellsNull,
        show: () => !!contextMenuTable?.data?.selectedCells?.some(({ column }) => column.editable),
      },
      !isReadOnlyObject && {
        text: t('context.deleteSelectedItems'),
        onClick: handleRemoveSelectedRows,
      },
      !isReadOnlyObject && {
        text: t('context.insertDdlRow'),
        onClick: () => {
          setDdlSql(
            generateInsertDdl(
              dialect,
              schema,
              table,
              contextMenuTable?.data?.rows || [],
              columnNames,
            ),
          );
          setShowDdlModal(true);
        },
      },
      !isReadOnlyObject && {
        text: t('context.insertDdlSelectedCells'),
        onClick: () => {
          setDdlSql(
            generateInsertDdl(
              dialect,
              schema,
              table,
              contextMenuTable?.data?.selectedCellRows || [],
              columnNames,
            ),
          );
          setShowDdlModal(true);
        },
      },
    ].filter(Boolean) as IContextMenuOption[];
  }, [
    columnNames,
    contextMenuTable,
    dialect,
    handleRemoveSelectedRows,
    handleSetSelectedCellsNull,
    isReadOnlyObject,
    openExportModal,
    schema,
    table,
    t,
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
      <div className={styles.filterBar} style={{ backgroundColor: theme.bar.backgroundColor }}>
        <ColumnFilterInput
          inputClassName={styles.filterInput}
          placeholder={t('placeholder.filterResults')}
          value={whereInput}
          columnNames={columnNames}
          onChange={handleWhereInputChange}
          historyItems={filterHistory}
          onHistorySelect={applyFilter}
          onKeyDown={handleFilterKeyDown}
          inputStyle={{ color: theme.bar.color, opacity: filterLocked ? 0.6 : 1 }}
          dropdownBackgroundColor={theme.bar.fieldBackgroundColor}
          dropdownBorderColor={theme.bar.borderColor}
          dropdownColor={theme.bar.color}
          disabled={filterLocked}
        />
      </div>

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
            <div className={styles.preview} style={{ backgroundColor: colors.backgroundColor }}>
              <div className={styles.previewHeader}>
                <TabBar
                  borderBottom
                  idTabBar={previewTabBarId}
                  activeTabId={activePreviewTab}
                  onActiveTab={handleActivePreviewTab}
                  ascentColor={tabTheme.ascentColor}
                  backgroundColor={tabTheme.backgroundColor}
                  backgroundColorBar={tabTheme.bar.backgroundColor}
                  borderColor={tabTheme.borderColor}
                  color={tabTheme.color}
                  tabs={previewTabs}
                />

                <Button
                  title={t('tooltip.closeValuePreview')}
                  backgroundColor={tabTheme.backgroundColor}
                  color={tabTheme.color}
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

                {!!selectedReference && (
                  <TabContent idTab="selection">
                    <ReferenceSelection
                      active={activePreviewTab === 'selection'}
                      idConnection={id_connection}
                      reference={selectedReference}
                      onDataError={handleDataError}
                      onSelectValue={handleApplySelectedCellValue}
                    />
                  </TabContent>
                )}
              </TabWindow>
            </div>
          </ResizableContainer>
        )}
      </div>

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        {!isReadOnlyObject && (
          <>
            <Button
              title={t('common.save')}
              text
              smallIcon
              color={theme.bar.color}
              onClick={handleSaveItems}
              loading={applyingChanges}
            >
              <SaveIcon size={16} />
            </Button>

            <Button
              title={t('common.add')}
              text
              smallIcon
              color={theme.bar.color}
              onClick={handleAddItem}
            >
              <AddIcon size={14} />
            </Button>

            <Button
              title={t('common.duplicateSelectedItems')}
              text
              smallIcon
              color={theme.bar.color}
              onClick={handleDuplicateSelectedRows}
            >
              <DuplicateIcon size={20} />
            </Button>

            <Button
              title={t('common.removeSelectedItems')}
              text
              smallIcon
              color={theme.bar.color}
              onClick={handleRemoveSelectedRows}
            >
              <RemoveIcon size={16} />
            </Button>
          </>
        )}

        <Button
          title={showValuePreview ? t('tooltip.closeValuePreview') : t('tooltip.openPreview')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={toggleValuePreview}
        >
          <PanelFile size={16} />
        </Button>

        <RefreshButton menuPlacement="top" color={theme.bar.color} onRefresh={handleRefresh} />

        <Button
          title={t('modal.exportData')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={openExportModal}
        >
          <ExportIcon size={16} />
        </Button>

        <Button
          title={t('common.countTotalRows')}
          text
          smallIcon
          className={styles.countButton}
          color={theme.bar.color}
          loading={loadingRowsCount}
          onClick={handleLoadRowsCount}
        >
          <CountIcon size={16} />
          {rowsCount !== undefined && (
            <span className={styles.countValue}>{rowsCount.toLocaleString(language)}</span>
          )}
        </Button>

        <Spacer />

        <Text userSelect={false} color={theme.bar.color} title={t('common.lastUpdatedAt')}>
          {t('common.updatedAt', { date: lastFetchDateSerialized })}
        </Text>
      </Bar>

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

      <Modal
        title={t('message.noPrimaryKeyWarningTitle')}
        width="560px"
        show={showNoPkModal}
        closeOutside={!applyingChanges}
        onClose={applyingChanges ? undefined : closeNoPkModal}
      >
        <Text color={colors.color || theme.bar.color}>{t('message.noPrimaryKeyWarning')}</Text>

        <div style={{ height: 16 }} />

        <Text color={colors.color || theme.bar.color}>{t('message.useAllColumnsQuestion')}</Text>

        <div style={{ height: 16 }} />

        <Row>
          <Spacer />

          <Button
            text
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            onClick={closeNoPkModal}
            disabled={applyingChanges}
            xs={6}
            sm={4}
            md={3}
          >
            {t('settings.customization.cancel')}
          </Button>

          <Button
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
            onClick={handleApplyWithoutPrimaryKey}
            loading={applyingChanges}
            xs={6}
            sm={5}
            md={4}
          >
            {t('common.useAllColumns')}
          </Button>
        </Row>
      </Modal>

      <ContextMenu
        position={contextMenuTable?.position}
        onClose={closeContextMenuTable}
        options={contextMenuOptions}
      />
    </div>
  );
};

export default Data;

export interface IContextMenuTable {
  data: ITableContextMenuData | null;
  position: {
    x: number;
    y: number;
  };
}
