import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { ContextMenu } from '@renderer/components/ContextMenu';
import Editor from '@renderer/components/Editor';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import ResizableContainer from '@renderer/components/ResizableContainer';
import ReferenceSelection from '@renderer/components/ReferenceSelection';
import { Spacer } from '@renderer/components/Spacer';
import Table, { ITableContextMenuData, ITableSelectedCellData } from '@renderer/components/Table';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import { CancelIcon, ExportIcon, IconRefresh, PanelFile, SaveIcon } from '@renderer/styles/icons';
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
import { IColumn } from '@renderer/components/Table/dtos';
import { useToast } from '@renderer/contexts/Toast';
import { generateUpdateDdl } from '@renderer/views/TableInfo/components/Properties/tabs/Columns/ddl';
import { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import { getRendererDialect } from '@renderer/database/dialects';
import styles from './styles.module.css';

import IconMdiClose from '~icons/mdi/close';

interface ITabContentSelectProps {
  id_connection: string;
  data: IQueryResult;
  references: Map<string, IColumnReferenceInfo[]>;
  readOnly?: boolean;
  onScrollEnd(): void;
  onSort(column: IColumn<any>): void;
  onRefresh(): void;
  onCancelQuery(): void;
  cancelingQuery?: boolean;
}

type PreviewTab = 'value' | 'reference' | 'selection';

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
  const { addTab } = useAppTabContext();
  const { getTableData, getTableRestrictions, runSql, connections } = useStoreContext();
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
  const [referenceLoadingKeys, setReferenceLoadingKeys] = React.useState<Set<string>>(new Set());
  const [referenceError, setReferenceError] = React.useState<string>();
  const [referenceCache, setReferenceCache] = React.useState(
    new Map<string, Record<string, any>>(),
  );
  const [restrictionsCache, setRestrictionsCache] = React.useState(
    new Map<string, IColumnRestrictionsInfo[]>(),
  );
  const [editedFieldsRows, setEditedFieldsRows] = React.useState(
    new Map<number, Record<string, any>>(),
  );
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const [now, setNow] = React.useState(Date.now());

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

  const closeValuePreview = () => {
    setShowValuePreview(false);
    setActivePreviewTab('value');
    setReferenceCache(new Map());
    setReferenceError(undefined);
    setReferenceLoadingKeys(new Set());
  };

  const previewValue = React.useMemo(() => {
    const value = selectedCell?.value;

    if (value === undefined || value === null) return '';

    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }

    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  }, [selectedCell]);

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

  const selectedReferenceCacheKey = React.useMemo(() => {
    if (!selectedReference) return undefined;
    if (selectedCell?.value === null || selectedCell?.value === undefined) return undefined;

    return [
      selectedReference.reference_table_schema,
      selectedReference.reference_table_name,
      selectedReference.reference_column_name,
      String(selectedCell.value),
    ].join('.');
  }, [selectedReference, selectedCell?.value]);

  const referenceRow = selectedReferenceCacheKey
    ? referenceCache.get(selectedReferenceCacheKey)
    : undefined;

  const referenceLoading = selectedReferenceCacheKey
    ? referenceLoadingKeys.has(selectedReferenceCacheKey)
    : false;

  const referenceTableName = selectedReference
    ? `${
        selectedReference.reference_table_schema
          ? `${selectedReference.reference_table_schema}.`
          : ''
      }${selectedReference.reference_table_name}`
    : '';

  const referencePreviewValue = React.useMemo(() => {
    return referenceTableName
      ? `// ${referenceTableName}\n\n${JSON.stringify(referenceRow || {}, null, 2)}`
      : JSON.stringify(referenceRow || {}, null, 2);
  }, [referenceTableName, referenceRow]);

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

  const handleApplySelectedCellValue = React.useCallback(
    (value: any) => {
      if (!selectedCell?.column.editable) return;

      const row = selectedCell.row as any;
      const attribute = String(selectedCell.column.attribute);
      const normalizedValue = value === '' ? null : value;

      handleEditRow(row.__row_index ?? selectedCell.rowIndex, attribute, normalizedValue);

      setSelectedCell((prevState) =>
        prevState ? { ...prevState, value: normalizedValue } : prevState,
      );
    },
    [handleEditRow, selectedCell],
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
    if (!editedFieldsRows.size || saving) return;

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

      const sql = generateUpdateDdl(
        dialect,
        editableTable.schema,
        editableTable.name,
        rowsToUpdate,
        primaryKeyColumns,
      );

      if (!sql) return;

      await runSql(id_connection, sql);

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
    onRefresh,
    runSql,
    saving,
    showToast,
  ]);

  const handleCancelSelectedRowsEditions = React.useCallback(() => {
    if (!selectedRows.length) return;

    setEditedFieldsRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        nextState.delete(row.__key_row);
      });

      return nextState;
    });
  }, [selectedRows]);

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

  const loadReferenceRow = async () => {
    setReferenceError(undefined);

    if (activePreviewTab !== 'reference') return;
    if (!selectedReference || !selectedReferenceCacheKey) return;
    if (referenceCache.has(selectedReferenceCacheKey)) return;
    if (referenceLoadingKeys.has(selectedReferenceCacheKey)) return;
    if (referenceError) return;

    setReferenceLoadingKeys((prevState) => {
      const newState = new Set(prevState);
      newState.add(selectedReferenceCacheKey);
      return newState;
    });

    try {
      const escapedValue = String(selectedCell?.value).replace(/'/g, "''");

      const result = await getTableData(id_connection, {
        schema: selectedReference.reference_table_schema,
        table: selectedReference.reference_table_name,
        page: 1,
        limit: 1,
        where: `"${selectedReference.reference_column_name}" = '${escapedValue}'`,
      });

      setReferenceCache((prevState) => {
        const newState = new Map(prevState);
        newState.set(selectedReferenceCacheKey, result.data?.[0] || {});
        return newState;
      });
    } catch (error) {
      setReferenceError(error?.message || 'Erro ao carregar referência');
    } finally {
      setReferenceLoadingKeys((prevState) => {
        const newState = new Set(prevState);
        newState.delete(selectedReferenceCacheKey);
        return newState;
      });
    }
  };

  React.useEffect(() => {
    loadReferenceRow();
  }, [
    activePreviewTab,
    selectedReference,
    selectedReferenceCacheKey,
    referenceCache,
    referenceLoadingKeys,
    referenceError,
    selectedCell?.value,
    getTableData,
    id_connection,
  ]);

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

  const onCellLinkClick = (attribute: string, value: any) => {
    const ref = tabFkMap.get(attribute);

    if (!ref || value === null || value === undefined) return;

    const escapedValue = String(value).replace(/'/g, "''");
    const initialWhere = `"${ref.reference_column_name}" = '${escapedValue}'`;

    const tabTitle = `${ref.reference_table_schema ? `${ref.reference_table_schema}.` : ''}${
      ref.reference_table_name
    } [${ref.reference_column_name}=${value}]`;

    addTab({
      title: tabTitle,
      data: {
        type: 'table-info',
        id_connection,
        schema: ref.reference_table_schema,
        table: ref.reference_table_name,
        initialWhere,
        filterLocked: true,
        initialTab: 'tabData',
      },
      component: () => (
        <TableInfoWithContext
          id_connection={id_connection}
          schema={ref.reference_table_schema}
          table={ref.reference_table_name}
          initialWhere={initialWhere}
          filterLocked
          initialTab="tabData"
        />
      ),
    });
  };

  React.useEffect(() => {
    setEditedFieldsRows(new Map());
    setSelectedRows([]);
  }, [data.rows, data.columns, data.query]);

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
                    readonly
                    hidePreview
                    value={previewValue}
                  />
                </TabContent>

                {!!selectedReference && (
                  <TabContent idTab="reference">
                    {referenceLoading ? (
                      <div className={styles.previewLoading}>
                        <MultiplesBarLoading background="transparent" />
                      </div>
                    ) : referenceError ? (
                      <Text color={activeTheme.queryEditor.bar.color}>{referenceError}</Text>
                    ) : (
                      <Editor
                        dialect={dialect.editorDialect}
                        language="json"
                        readonly
                        hidePreview
                        value={referencePreviewValue}
                      />
                    )}
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
          <Button
            text
            smallIcon
            title="Atualizar dados"
            onClick={onRefresh}
            disabled={data.loading}
            color={activeTheme.queryEditor.bar.color}
          >
            <IconRefresh size={18} />
          </Button>
        )}

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
