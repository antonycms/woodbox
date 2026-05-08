import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { ContextMenu } from '@renderer/components/ContextMenu';
import Editor from '@renderer/components/Editor';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { Spacer } from '@renderer/components/Spacer';
import Table, { ITableContextMenuData, ITableSelectedCellData } from '@renderer/components/Table';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import { CancelIcon, ExportIcon, IconRefresh, PanelFile, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { copyToClipboard } from '@renderer/utils/methods';
import TableInfoWithContext from '@renderer/views/TableInfo';
import type { IContextMenuTable } from '@renderer/views/TableInfo/components/Data';
import { IColumnReferenceInfo, useStoreContext } from '@renderer/contexts/Store';
import { IColumn } from '@renderer/components/Table/dtos';
import { IQueryResult } from '../../dtos';
import styles from './styles.module.css';

interface ITabContentSelectProps {
  id_connection: string;
  data: IQueryResult;
  references: Map<string, IColumnReferenceInfo[]>;
  onScrollEnd(): void;
  onSort(column: IColumn<any>): void;
  onRefresh(): void;
}

export const TabContentSelect = (props: ITabContentSelectProps) => {
  const { id_connection, data, onScrollEnd, onSort, onRefresh, references } = props;

  const { activeTheme } = useThemeContext();
  const { addTab } = useAppTabContext();
  const { getTableData } = useStoreContext();

  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [showValuePreview, setShowValuePreview] = React.useState(false);
  const [previewWidth, setPreviewWidth] = React.useState(420);
  const [selectedCell, setSelectedCell] = React.useState<ITableSelectedCellData>();
  const [activePreviewTab, setActivePreviewTab] = React.useState<'value' | 'reference'>('value');
  const [referenceLoadingKeys, setReferenceLoadingKeys] = React.useState<Set<string>>(new Set());
  const [referenceError, setReferenceError] = React.useState<string>();
  const [referenceCache, setReferenceCache] = React.useState<Map<string, Record<string, any>>>(
    new Map(),
  );

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

  return (
    <>
      <div className={styles.content}>
        <div className={styles.tableWrapper}>
          <Table
            loading={!!data.loading}
            rows={data.rows}
            sort={data.orderBy}
            onSort={onSort}
            onScrollEnd={onScrollEnd}
            onContextMenu={onContextMenuTable}
            onSelectCellData={setSelectedCell}
            onCellLinkClick={onCellLinkClick}
            columns={data.columns.map((column) => ({
              title: 'Clique para ordenar por essa coluna',
              attribute: column,
              label: column,
              sortable: true,
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
              <div className={styles.previewTabs}>
                <button
                  className={
                    activePreviewTab === 'value' ? styles.previewTabActive : styles.previewTab
                  }
                  onClick={() => setActivePreviewTab('value')}
                >
                  Valor
                </button>

                <button
                  className={
                    activePreviewTab === 'reference' ? styles.previewTabActive : styles.previewTab
                  }
                  disabled={!selectedReference}
                  onClick={() => setActivePreviewTab('reference')}
                >
                  Referência
                </button>

                <button
                  className={styles.previewCloseButton}
                  title="Fechar visualização"
                  onClick={closeValuePreview}
                >
                  <CancelIcon size={14} />
                </button>
              </div>

              <div className={styles.previewContent}>
                {activePreviewTab === 'value' && (
                  <Editor
                    dialect="postgres"
                    language="json"
                    readonly
                    hidePreview
                    value={previewValue}
                  />
                )}

                {activePreviewTab === 'reference' &&
                  (referenceLoading ? (
                    <div className={styles.previewLoading}>
                      <MultiplesBarLoading />
                    </div>
                  ) : referenceError ? (
                    <Text color={activeTheme.queryEditor.bar.color}>{referenceError}</Text>
                  ) : (
                    <Editor
                      dialect="postgres"
                      language="json"
                      readonly
                      hidePreview
                      value={referencePreviewValue}
                    />
                  ))}
              </div>
            </div>
          </ResizableContainer>
        )}
      </div>

      <Bar
        backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
        borderColor={activeTheme.queryEditor.bar.borderColor}
      >
        <Button text smallIcon title="Salvar" color={activeTheme.queryEditor.bar.color}>
          <SaveIcon size={16} />
        </Button>

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

        <Button
          text
          smallIcon
          title="Atualizar dados"
          onClick={onRefresh}
          color={activeTheme.queryEditor.bar.color}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text
          title="Tempo de execução da query"
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {data.execution_time_ms < 1000
            ? `${data.execution_time_ms}ms`
            : `${(data.execution_time_ms / 1000).toFixed(2)}s`}
        </Text>

        <Text
          title="Total de Linhas sendo exibidas"
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          Linhas exibidas: {data.rows.length}
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
    </>
  );
};
