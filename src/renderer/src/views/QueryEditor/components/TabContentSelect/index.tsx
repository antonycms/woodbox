import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { ContextMenu } from '@renderer/components/ContextMenu';
import Editor from '@renderer/components/Editor';
import ReferencePreview from '@renderer/components/ReferencePreview';
import ResizableContainer from '@renderer/components/ResizableContainer';
import ReferenceSelection from '@renderer/components/ReferenceSelection';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Spacer } from '@renderer/components/Spacer';
import Table, { ITableContextMenuData, ITableSelectedCellData } from '@renderer/components/Table';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import {
  AddIcon,
  CancelIcon,
  CountIcon,
  ExportIcon,
  PanelFile,
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
import {
  generateInsertDdl,
  generateUpdateDdl,
} from '@renderer/views/TableInfo/components/Properties/tabs/Columns/ddl';
import { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import { getRendererDialect } from '@renderer/database/dialects';
import { emitConfirmOpenTableWithFilter } from '@renderer/views/TableInfo/events';
import { prepareQueryVariables } from '../../utils/queryVariables';
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
    cancelingQuery,
    references,
    readOnly,
  } = props;

  const { activeTheme } = useThemeContext();
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
  const [newRows, setNewRows] = React.useState<Map<React.Key, Record<string, any>>>(new Map());
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const [now, setNow] = React.useState(Date.now());
  const [loadingRowsCount, setLoadingRowsCount] = React.useState(false);
  const [rowsCount, setRowsCount] = React.useState<number>();

  const editableTable = readOnly
    ? undefined
    : data.tables_info?.length !== 1
    ? undefined
    : data.tables_info[0];

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
        title: 'Erro ao contar linhas.',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
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
  ]);

  const closeValuePreview = () => {
    setShowValuePreview(false);
    setActivePreviewTab('value');
  };

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

  const previewValue = React.useMemo(() => {
    const value = selectedCellValue;

    if (value === undefined || value === null) return '';

    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }

    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  }, [selectedCellValue]);

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

  const rowsWithPendingStyles = React.useMemo(
    () =>
      data.rows.map((row, index) => {
        if (!editedFieldsRows.has(index)) return row;

        return {
          ...row,
          __style: {
            ...(row as any).__style,
            backgroundColor: '#d2992233',
          },
        };
      }),
    [data.rows, editedFieldsRows],
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

    if ((!rowsToInsert.length && !editedFieldsRows.size) || saving) return;

    if (!editableTable?.name) {
      showToast({
        type: 'error',
        title: 'Não foi possível salvar.',
        description: 'A query precisa retornar dados de uma única tabela identificável.',
      });

      return;
    }

    setSaving(true);

    try {
      let updateSql = '';

      if (editedFieldsRows.size) {
        const primaryKeyColumns = await getPrimaryKeyColumns();

        if (!primaryKeyColumns.length) {
          const fullName = [editableTable.schema, editableTable.name].filter(Boolean).join('.');

          showToast({
            type: 'error',
            title: 'Não foi possível salvar.',
            description: `A tabela "${fullName}" não possui primary key.`,
          });

          return;
        }

        const missingPk = primaryKeyColumns.find((pkColumn) => !data.columns?.includes(pkColumn));

        if (missingPk) {
          showToast({
            type: 'error',
            title: 'Não foi possível salvar.',
            description: `A linha alterada não possui informação da PK "${missingPk}" no resultado da query.`,
          });

          return;
        }

        const rowsToUpdate = [...editedFieldsRows.entries()].map(([index, changes]) => ({
          originalRow: data.rows[index],
          changes,
        }));

        updateSql = generateUpdateDdl(
          dialect,
          editableTable.schema,
          editableTable.name,
          rowsToUpdate,
          primaryKeyColumns,
        );
      }

      const insertSql = generateInsertDdl(
        dialect,
        editableTable.schema,
        editableTable.name,
        rowsToInsert,
        data.columns,
      );
      const sql = [insertSql, updateSql].filter((item) => item.trim()).join('\n\n');

      if (!sql) return;

      await runSql(id_connection, sql);

      setNewRows(new Map());
      setEditedFieldsRows(new Map());
      showToast({ type: 'success', title: 'Dados salvos com sucesso!' });
      onRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erro ao salvar dados.',
        description: error?.message,
        delay: 8000,
      });
    } finally {
      setSaving(false);
    }
  }, [
    data.rows,
    data.columns,
    editedFieldsRows,
    editableTable,
    getPrimaryKeyColumns,
    id_connection,
    newRows,
    onRefresh,
    runSql,
    saving,
    showToast,
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

  const handleAddRow = React.useCallback(() => {
    setNewRows((prevState) => new Map(prevState).set(`new_${generateHash()}`, {}));
  }, []);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelSelectedRowsEditions();
      }
    },
    [handleCancelSelectedRowsEditions, handleSave],
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

  const onContextMenuTable = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: ITableContextMenuData,
  ) => {
    setContextMenuTable({ data, position: { x: event.clientX, y: event.clientY } });
  };

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

  const onCellLinkClick = (attribute: string, value: any) => {
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
  };

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

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
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
            columns={(data.columns || []).map((column) => ({
              title: readOnly ? undefined : 'Clique para ordenar por essa coluna',
              attribute: column,
              label: column,
              sortable: !readOnly,
              editable: !!editableTable,
              isLink: tabFkMap.has(column),
            }))}
          />
        </div>

        {showValuePreview && (
          <ResizableContainer
            width={previewWidth}
            minWidth={260}
            maxWidth={900}
            direction="horizontal"
            horizontalResizeSide="left"
            className={styles.previewResizable}
            onResize={(size) => size.width && setPreviewWidth(size.width)}
          >
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <TabBar
                  borderBottom
                  idTabBar={previewTabBarId}
                  activeTabId={activePreviewTab}
                  onActiveTab={(tab) => setActivePreviewTab(tab?.idTab as PreviewTab)}
                  ascentColor={activeTheme.queryEditor.tab.ascentColor}
                  backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
                  backgroundColorBar={activeTheme.queryEditor.tab.bar.backgroundColor}
                  borderColor={activeTheme.queryEditor.tab.borderColor}
                  color={activeTheme.queryEditor.tab.color}
                  tabs={[
                    { idTab: 'value', title: 'Valor' },
                    selectedReference && { idTab: 'reference', title: 'Referência' },
                    canSelectReferenceValue && { idTab: 'selection', title: 'Seleção' },
                  ].filter(Boolean)}
                />

                <Button
                  title="Fechar visualização"
                  backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
                  color={activeTheme.queryEditor.tab.color}
                  onClick={closeValuePreview}
                  width="auto"
                  icon={() => <IconMdiClose width={16} />}
                />
              </div>

              <TabWindow activeTabId={activePreviewTab}>
                <TabContent idTab="value">
                  <Editor
                    dialect={dialect.editorDialect}
                    language="json"
                    readonly={!selectedCell?.column.editable}
                    hidePreview
                    value={previewValue}
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
                      onDataError={(error) => {
                        showToast({
                          type: 'error',
                          title: 'Erro ao carregar referência.',
                          description:
                            error instanceof Error ? error.message : 'Erro desconhecido.',
                          delay: 8000,
                        });
                      }}
                    />
                  </TabContent>
                )}

                {canSelectReferenceValue && (
                  <TabContent idTab="selection">
                    <ReferenceSelection
                      active={activePreviewTab === 'selection'}
                      idConnection={id_connection}
                      reference={selectedReference}
                      onDataError={(error) => {
                        showToast({
                          type: 'error',
                          title: 'Erro ao carregar seleção.',
                          description:
                            error instanceof Error ? error.message : 'Erro desconhecido.',
                          delay: 8000,
                        });
                      }}
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
            title="Salvar"
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
            title="Adicionar linha"
            onClick={handleAddRow}
            disabled={data.loading}
            color={activeTheme.queryEditor.bar.color}
          >
            <AddIcon size={14} />
          </Button>
        )}

        <Button text smallIcon title="Exportar" color={activeTheme.queryEditor.bar.color}>
          <ExportIcon size={16} />
        </Button>

        <Button
          text
          smallIcon
          title={showValuePreview ? 'Fechar visualizacão' : 'Abrir visualizacão'}
          onClick={() => {
            if (showValuePreview) {
              closeValuePreview();
              return;
            }

            setShowValuePreview(true);
          }}
          color={activeTheme.queryEditor.bar.color}
        >
          <PanelFile size={16} />
        </Button>

        {!!data.loading && (
          <Button
            text
            smallIcon
            title="Cancelar query"
            onClick={onCancelQuery}
            loading={cancelingQuery}
            color={activeTheme.queryEditor.bar.color}
          >
            <CancelIcon size={16} />
          </Button>
        )}

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
          title="Contar linhas totais"
          className={styles.countButton}
          onClick={handleLoadRowsCount}
          loading={loadingRowsCount}
          disabled={data.loading}
          color={activeTheme.queryEditor.bar.color}
        >
          <CountIcon size={16} />
          {rowsCount !== undefined && (
            <span className={styles.countValue}>{rowsCount.toLocaleString('pt-BR')}</span>
          )}
        </Button>

        <Spacer />

        <Text
          title={data.loading ? 'Tempo de execução atual da query' : 'Tempo de execução da query'}
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {data.loading
            ? `Executando há ${formatExecutionTime(executionTimeMs)}`
            : formatExecutionTime(executionTimeMs)}
        </Text>

        <Text
          title="Total de Linhas sendo exibidas"
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          Linhas exibidas: {(data.rows || []).length}
        </Text>

        <Text
          title="Data da última atualização"
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          Atualizado em {toDateTime(data.date_run)}
        </Text>
      </Bar>

      <ContextMenu
        position={contextMenuTable?.position}
        onClose={() => setContextMenuTable(undefined)}
        options={[
          {
            text: 'Copiar',
            onClick: () => copyToClipboard(contextMenuTable?.data?.cellsText || ''),
          },
          {
            text: 'Copiar linha',
            onClick: () => copyToClipboard(contextMenuTable?.data?.rowsText || ''),
          },
          {
            text: 'Copiar linha como JSON',
            onClick: () => copyToClipboard(contextMenuTable?.data?.rowsJson || ''),
          },
        ]}
      />
    </div>
  );
};
