import { serializeInitialWhere } from '@renderer/database/tableFilters';
import { getTableFilterErrorMessage } from '@renderer/database/tableFilters';
import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Button } from '@renderer/components/Button';
import {
  ContextMenu,
  type IContextMenuOption,
  type IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import Editor from '@renderer/components/Editor';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import Table, { type ITableContextMenuData } from '@renderer/components/Table';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import type { IColumnReferenceInfo } from '@shared/types/database';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useThemeStore } from '@renderer/stores/Theme';
import { copyToClipboard } from '@renderer/utils/methods';
import type { IColumn } from '@renderer/components/Table/dtos';
import { useOpenTableTab } from '@renderer/hooks/useOpenTableTab';
import styles from './styles.module.css';

import IconMdiArrowLeft from '~icons/mdi/arrow-left';
import IconMdiArrowRight from '~icons/mdi/arrow-right';
import IconMdiClose from '~icons/mdi/close';
import IconMdiCodeJson from '~icons/mdi/code-json';
import IconMdiTable from '~icons/mdi/table';

interface IReferencePreviewProps {
  active: boolean;
  idConnection: string;
  initialReference?: IColumnReferenceInfo;
  initialValue: unknown;
  onClose?: () => void;
  enableOpenTableNavigation?: boolean;
  onOpenTable?: (
    idConnection: string,
    schema: string,
    table: string,
    filterColumn: string,
    filterValue: unknown,
  ) => void | Promise<void>;
}

interface IReferenceHistoryItem {
  reference: IColumnReferenceInfo;
  value: unknown;
}

interface IReferenceContextMenu {
  data: ITableContextMenuData;
  position: IContextMenuPosition;
}

const getTableName = (reference?: IColumnReferenceInfo) =>
  reference
    ? `${reference.reference_table_schema ? `${reference.reference_table_schema}.` : ''}${
        reference.reference_table_name
      }`
    : '';

const getReferenceKey = (connectionId: string, item?: IReferenceHistoryItem) => item
  ? JSON.stringify([connectionId, item.reference.reference_table_schema, item.reference.reference_table_name,
      serializeInitialWhere({ column: item.reference.reference_column_name, value: item.value })])
  : '';

const getTableKey = (connectionId: string, schema: string, table: string) => [connectionId, schema, table].join('\0');

const ReferencePreview = ({
  active,
  idConnection,
  initialReference,
  initialValue,
  onClose,
  enableOpenTableNavigation,
  onOpenTable,
}: IReferencePreviewProps) => {
  const {
    tableInfo: { data: theme },
  } = useThemeStore((state) => state.activeTheme);
  const t = useI18nStore((state) => state.t);
  const { openTableWithFilter } = useOpenTableTab();
  const { readInitialWhere, getTableReferences } = useDatabaseStore(
    useShallow((state) => ({
      readInitialWhere: state.readInitialWhere,
      getTableReferences: state.getTableReferences,
    })),
  );

  const [history, setHistory] = React.useState<IReferenceHistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<'table' | 'json'>('table');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [rowsCache, setRowsCache] = React.useState(new Map<string, Record<string, unknown>>());
  const [columnsCache, setColumnsCache] = React.useState(new Map<string, IColumn[]>());
  const [referencesCache, setReferencesCache] = React.useState(
    new Map<string, IColumnReferenceInfo[]>(),
  );
  const [contextMenu, setContextMenu] = React.useState<IReferenceContextMenu>();

  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const currentItem = history[historyIndex];
  const currentReference = currentItem?.reference;
  const currentTableKey = currentReference
    ? getTableKey(idConnection, currentReference.reference_table_schema, currentReference.reference_table_name)
    : '';
  const currentReferenceKey = getReferenceKey(idConnection, currentItem);
  const scope = React.useRef({ idConnection, currentItem, active });
  scope.current = { idConnection, currentItem, active };
  const currentRow = currentReferenceKey ? rowsCache.get(currentReferenceKey) : undefined;
  const currentColumns = currentTableKey ? columnsCache.get(currentTableKey) || [] : [];
  const currentReferences = currentTableKey ? referencesCache.get(currentTableKey) || [] : [];
  const currentFkMap = React.useMemo(
    () => new Map(currentReferences.map((reference) => [reference.column_name, reference])),
    [currentReferences],
  );
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;
  const canOpenTable = !!onOpenTable || !!enableOpenTableNavigation;

  const currentRows = React.useMemo(() => (currentRow ? [currentRow] : []), [currentRow]);

  const referencePreviewValue = React.useMemo(() => {
    const tableName = getTableName(currentReference);
    const value = JSON.stringify(currentRow || {}, null, 2);

    return tableName ? `// ${tableName}\n\n${value}` : value;
  }, [currentReference, currentRow]);

  const loadReferenceData = React.useCallback(async () => {
    if (!active || !currentReference || !currentItem || loading || error) return;
    if (rowsCache.has(currentReferenceKey) && columnsCache.has(currentTableKey)) return;
    const requestScope = scope.current;
    const isCurrent = () => mounted.current && scope.current.idConnection === requestScope.idConnection
      && scope.current.currentItem === requestScope.currentItem && scope.current.active;
    setLoading(true);
    setError(undefined);
    try {
      const target = {
        schema: currentReference.reference_table_schema,
        table: currentReference.reference_table_name,
      };
      const needsColumns = !columnsCache.has(currentTableKey);
      const rowRequest = readInitialWhere(idConnection, {
        ...target, column: currentReference.reference_column_name, value: currentItem.value,
        page: 1, limit: 1, includeColumns: needsColumns,
      });
      const referencesRequest = referencesCache.has(currentTableKey)
        ? Promise.resolve(undefined)
        : getTableReferences(idConnection, target);
      const [result, references] = await Promise.all([rowRequest, referencesRequest]);
      if (!isCurrent()) return;
      if (result.error) throw result.error;
      const columns = result.columns;
      if (columns) {
        const referenceColumns = references || [];
        const fkMap = new Map(
          referenceColumns.map((reference) => [reference.column_name, reference]),
        );

        setColumnsCache((prevState) => {
          const nextState = new Map(prevState);
          nextState.set(
            currentTableKey,
            columns.map(
              (column): IColumn => ({
                label: column.column_name,
                info: column.data_type,
                attribute: column.column_name,
                isLink: fkMap.has(column.column_name),
              }),
            ),
          );
          return nextState;
        });
      }

      if (references) {
        setReferencesCache((prevState) => {
          const nextState = new Map(prevState);
          nextState.set(currentTableKey, references);
          return nextState;
        });
      }

      if (result) {
        setRowsCache((prevState) => {
          const nextState = new Map(prevState);
          nextState.set(currentReferenceKey, result.data?.[0] || {});
          return nextState;
        });
      }
    } catch (error: unknown) {
      if (isCurrent()) setError(getTableFilterErrorMessage(error, t));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [active, columnsCache, currentReference, currentItem, currentTableKey, currentReferenceKey, readInitialWhere,
    getTableReferences, idConnection, t, loading, error, referencesCache, rowsCache]);

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>, data: ITableContextMenuData) => {
      event.preventDefault();

      setContextMenu({ data, position: { x: event.clientX, y: event.clientY } });
    },
    [],
  );

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(undefined);
  }, []);

  const contextMenuOptions = React.useMemo<IContextMenuOption[]>(
    () => [
      {
        text: t('common.copy'),
        onClick: () => copyToClipboard(contextMenu?.data.getCellsText() || ''),
      },
    ],
    [contextMenu, t],
  );

  const handleOpenNestedReference = React.useCallback(
    (attribute: string, value: unknown) => {
      const reference = currentFkMap.get(attribute);

      if (!reference || value === null || value === undefined) return;

      setHistory((prevState) => [...prevState.slice(0, historyIndex + 1), { reference, value }]);
      setHistoryIndex((prevState) => prevState + 1);
      setViewMode('table');
    },
    [currentFkMap, historyIndex],
  );

  const handleOpenReferencedTable = React.useCallback(
    async (attribute: string, value: unknown) => {
      const reference = currentFkMap.get(attribute);

      if (!reference || value === null || value === undefined) return;

      if (!canOpenTable) {
        setHistory((prevState) => [...prevState.slice(0, historyIndex + 1), { reference, value }]);
        setHistoryIndex((prevState) => prevState + 1);
        setViewMode('table');
        return;
      }

      const openReferencedTable = onOpenTable || openTableWithFilter;

      try { await openReferencedTable(
        idConnection,
        reference.reference_table_schema,
        reference.reference_table_name,
        reference.reference_column_name,
        value,
      ); } catch (error) { setError(getTableFilterErrorMessage(error, t)); }
    },
    [canOpenTable, currentFkMap, historyIndex, idConnection, onOpenTable, openTableWithFilter, t],
  );

  React.useEffect(() => {
    if (!initialReference || initialValue === null || initialValue === undefined) {
      setHistory([]);
      setHistoryIndex(0);
      setError(undefined);
      return;
    }

    setHistory([{ reference: initialReference, value: initialValue }]);
    setHistoryIndex(0);
    setError(undefined);
  }, [initialReference, initialValue]);

  React.useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  if (!currentReference) {
    return (
      <div className={styles.emptyState}>
        <Text color={theme.bar.color}>{t('message.selectFkCellReference')}</Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.toolbar}
        style={
          {
            backgroundColor: theme.bar.backgroundColor,
            '--reference-border-color': theme.bar.borderColor,
          } as React.CSSProperties
        }
      >
        <Button
          text
          smallIcon
          title={t('tooltip.referenceBack')}
          color={theme.bar.color}
          disabled={!canGoBack}
          onClick={() => setHistoryIndex((prevState) => Math.max(0, prevState - 1))}
        >
          <IconMdiArrowLeft width={16} />
        </Button>

        <Button
          text
          smallIcon
          title={t('tooltip.referenceForward')}
          color={theme.bar.color}
          disabled={!canGoForward}
          onClick={() =>
            setHistoryIndex((prevState) => Math.min(history.length - 1, prevState + 1))
          }
        >
          <IconMdiArrowRight width={16} />
        </Button>

        <div className={styles.title} style={{ color: theme.bar.color }}>
          {getTableName(currentReference)}
        </div>

        <Button
          text
          smallIcon
          title={viewMode === 'table' ? t('tooltip.viewJson') : t('tooltip.viewTable')}
          color={theme.bar.color}
          onClick={() => setViewMode((prevState) => (prevState === 'table' ? 'json' : 'table'))}
        >
          {viewMode === 'table' ? <IconMdiCodeJson width={16} /> : <IconMdiTable width={16} />}
        </Button>

        {onClose && (
          <Button
            text
            smallIcon
            title={t('common.close')}
            color={theme.bar.color}
            onClick={onClose}
          >
            <IconMdiClose width={16} />
          </Button>
        )}
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <MultiplesBarLoading background="transparent" />
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <Text color={theme.bar.color}>{error}</Text>
          </div>
        ) : viewMode === 'json' ? (
          <Editor
            language="json"
            readonly
            hidePreview
            value={referencePreviewValue}
          />
        ) : (
          <Table
            key={currentReferenceKey}
            columns={currentColumns}
            rows={currentRows}
            initialAnalysisMode
            rowKeyExtractor={() => currentReferenceKey}
            onCellLinkClick={canOpenTable ? handleOpenReferencedTable : handleOpenNestedReference}
            onCellLinkPreviewClick={handleOpenNestedReference}
            cellLinkClickMode={canOpenTable ? 'ctrl' : 'single'}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>

      <ContextMenu
        position={contextMenu?.position}
        onClose={closeContextMenu}
        options={contextMenuOptions}
      />
    </div>
  );
};

export default ReferencePreview;
