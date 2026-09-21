import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import Table, { type ITableSelectedCellData } from '@renderer/components/Table';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import ColumnFilterInput from '@renderer/components/ColumnFilterInput';
import { AUTO_REFRESH_OPTIONS } from '@renderer/components/RefreshButton';
import ReferenceValuePreview from '@renderer/components/ReferenceValuePreview';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { ContextMenu, type IContextMenuOption, type IContextMenuPosition } from '@renderer/components/ContextMenu';
import { type IColumn, type ISortDirection, type ITableSort } from '@renderer/components/Table/dtos';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { useI18nStore } from '@renderer/stores/I18n';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { useLatestFunc } from '@renderer/hooks/useLatestFunc';
import { CancelIcon, PanelFile, RecordIcon, RunIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { getNextSort } from '@renderer/utils/tableSort';
import { getRendererDialect } from '@renderer/database/dialects';
import { getFilteredProcessListRows, getProcessListColumns, normalizeProcessRow, type ProcessListRow } from './utils/rows';
import {
  buildProcessCaptureCsv,
  buildProcessCaptureJsonl,
  downloadProcessCaptureFile,
  getProcessCaptureRowHash,
  type IProcessListCapturedRow,
} from './utils/capture';
import styles from './styles.module.css';

import IconMdiClose from '~icons/mdi/close';
import IconMdiPause from '~icons/mdi/pause';

export interface IProcessListProps {
  id_connection: string;
}

interface IProcessListCaptureState {
  active: boolean;
  started_at: string;
  stopped_at?: string;
  rows: IProcessListCapturedRow[];
  rowHashes: string[];
}

const ProcessList = ({ id_connection }: IProcessListProps) => {
  const { processList: theme } = useThemeStore((state) => state.activeTheme);
  const { t, language } = useI18nStore(
    useShallow((state) => ({ t: state.t, language: state.language })),
  );
  const connections = useWorkspaceStore((state) => state.connections);
  const { getProcessList, cancelProcess } = useDatabaseStore(
    useShallow((state) => ({
      getProcessList: state.getProcessList,
      cancelProcess: state.cancelProcess,
    })),
  );
  const showToast = useToastStore((state) => state.showToast);
  const loadingRef = React.useRef(false);
  const [rows, setRows] = React.useState<ProcessListRow[]>([]);
  const [filter, setFilter] = React.useState('');
  const [autoRefreshActive, setAutoRefreshActive] = React.useState(true);
  const [autoRefreshMs, setAutoRefreshMs] = React.useState(5000);
  const [autoRefreshMenuPosition, setAutoRefreshMenuPosition] = React.useState<IContextMenuPosition>();
  const [captureMenuPosition, setCaptureMenuPosition] = React.useState<IContextMenuPosition>();
  const [capture, setCapture] = React.useState<IProcessListCaptureState>();
  const [cancelingProcessPids, setCancelingProcessPids] = React.useState<Set<string>>(new Set());
  const [showValuePreview, setShowValuePreview] = React.useState(false);
  const [previewWidth, setPreviewWidth] = React.useState(420);
  const [selectedCell, setSelectedCell] = React.useState<ITableSelectedCellData<ProcessListRow>>();
  const [previewTabBarId] = React.useState(`process_list_preview_${id_connection}`);
  const [activePreviewTab, setActivePreviewTab] = React.useState('value');
  const [lastFetchDate, setLastFetchDate] = React.useState<Date | null>(null);
  const [sort, setSort] = React.useState<ITableSort[]>([
    { columnName: 'duration_seconds', sortType: 'DESC' },
  ]);

  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );

  const filteredRows = React.useMemo(() => {
    return getFilteredProcessListRows(rows, filter, sort);
  }, [filter, rows, sort]);

  const hasCapturedRows = !!capture?.rows.length;
  const captureButtonColor = capture?.active
    ? theme.capture.activeColor
    : hasCapturedRows
      ? theme.capture.modifiedColor
      : theme.bar.color;

  const loadProcesses = useLatestFunc(async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;

    try {
      const data = await getProcessList(id_connection);

      const nextRows = (data || []).map(normalizeProcessRow);

      setCapture((currentCapture) => {
        if (!currentCapture?.active) return currentCapture;

        const rowHashes = new Set(currentCapture.rowHashes);
        const capturedRows = nextRows.flatMap((row) => {
          const rowHash = getProcessCaptureRowHash(row);

          if (rowHashes.has(rowHash)) return [];

          rowHashes.add(rowHash);

          return [{ captured_at: new Date().toISOString(), row }];
        });

        return {
          ...currentCapture,
          rows: [...currentCapture.rows, ...capturedRows],
          rowHashes: [...rowHashes],
        };
      });
      setRows(nextRows);
      setLastFetchDate(new Date());
    } catch (error: any) {
      showToast({
        type: 'error',
        title: t('processList.loadFailed'),
        description: error?.message || t('common.unknownError'),
      });
    } finally {
      loadingRef.current = false;
    }
  });

  const handleSort = React.useCallback(
    (column: IColumn<ProcessListRow>, sortType?: ISortDirection | null) => {
      setSort((currentSort) => getNextSort(currentSort, column.attribute, sortType));
    },
    [],
  );

  const handleCancelProcess = React.useCallback(
    async (row: ProcessListRow) => {
      const processKey = String(row.pid);

      if (!processKey || processKey === '—') return;

      setCancelingProcessPids((current) => {
        const next = new Set(current);
        next.add(processKey);
        return next;
      });

      try {
        const canceled = await cancelProcess(id_connection, row.pid);

        showToast({
          type: canceled ? 'success' : 'warn',
          title: canceled
            ? t('processList.cancelProcessSuccess')
            : t('processList.cancelProcessNotCanceled'),
        });

        await loadProcesses();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: t('processList.cancelProcessFailed'),
          description: error?.message || t('common.unknownError'),
        });
      } finally {
        setCancelingProcessPids((current) => {
          const next = new Set(current);
          next.delete(processKey);
          return next;
        });
      }
    },
    [cancelProcess, id_connection, loadProcesses, showToast, t],
  );

  const columns = React.useMemo<IColumn<ProcessListRow>[]>(
    () => [
      ...getProcessListColumns(t),
      {
        label: t('processList.actions'),
        attribute: 'actions',
        width: 158,
        minWidth: 158,
        resizable: false,
        render: (row) => {
          const processKey = String(row.pid);

          return (
            <span
              className={styles.actions}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                text
                className={styles.actionButton}
                title={t('processList.cancelProcess')}
                color={theme.bar.color}
                icon={() => <CancelIcon size={14} />}
                loading={cancelingProcessPids.has(processKey)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleCancelProcess(row);
                }}
              >
                {t('processList.cancelProcess')}
              </Button>
            </span>
          );
        },
      },
    ],
    [cancelingProcessPids, handleCancelProcess, t, theme.bar.color],
  );

  const toggleAutoRefresh = React.useCallback(() => {
    setAutoRefreshActive((current) => !current);
  }, []);

  const toggleValuePreview = React.useCallback(() => {
    setShowValuePreview((current) => !current);
  }, []);

  const toggleCapture = React.useCallback(() => {
    const date = new Date().toISOString();
    
    setAutoRefreshActive(true);

    setCapture((currentCapture) => {
      if (currentCapture?.active) {
        return { ...currentCapture, active: false, stopped_at: date };
      }

      if (currentCapture) {
        return {
          ...currentCapture,
          active: true,
          stopped_at: undefined,
          rowHashes: [
            ...new Set([...currentCapture.rowHashes, ...rows.map(getProcessCaptureRowHash)]),
          ],
        };
      }

      return {
        active: true,
        started_at: date,
        rows: [],
        rowHashes: rows.map(getProcessCaptureRowHash),
      };
    });
  }, [rows]);

  const clearCapture = React.useCallback(() => {
    setCapture(undefined);
  }, []);

  const handlePreviewResize = React.useCallback((size: { width?: number }) => {
    if (size.width) setPreviewWidth(size.width);
  }, []);

  const openAutoRefreshMenu = React.useCallback((event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();

    setAutoRefreshMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const openCaptureMenu = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCaptureMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const autoRefreshMenuOptions = React.useMemo<IContextMenuOption[]>(
    () =>
      AUTO_REFRESH_OPTIONS.filter((option) => typeof option.value === 'number').map((option) => ({
        text: `${option.label}${option.value === autoRefreshMs ? ' ✓' : ''}`,
        onClick: () => {
          setAutoRefreshMs(option.value);
          setAutoRefreshActive(true);
        },
      })),
    [autoRefreshMs],
  );

  const exportCaptureJsonl = React.useCallback(() => {
    const capturedRows = capture?.rows || [];

    if (!capturedRows.length) {
      showToast({
        type: 'warn',
        title: t('toast.noCapturedRows'),
        description: t('processList.noCapturedRowsHelp'),
      });
      return;
    }

    downloadProcessCaptureFile(
      buildProcessCaptureJsonl(capturedRows),
      'jsonl',
      'application/x-ndjson;charset=utf-8',
    );
    showToast({
      type: 'success',
      title: t('toast.captureExported'),
      description: t('capture.exportedRowsJsonl', {
        count: capturedRows.length.toLocaleString(language),
      }),
    });
  }, [capture?.rows, language, showToast, t]);

  const exportCaptureCsv = React.useCallback(() => {
    const capturedRows = capture?.rows || [];

    if (!capturedRows.length) {
      showToast({
        type: 'warn',
        title: t('toast.noCapturedRows'),
        description: t('processList.noCapturedRowsHelp'),
      });
      return;
    }

    downloadProcessCaptureFile(
      `\ufeff${buildProcessCaptureCsv(capturedRows)}`,
      'csv',
      'text/csv;charset=utf-8',
    );
    showToast({
      type: 'success',
      title: t('toast.captureExported'),
      description: t('capture.exportedRowsCsv', {
        count: capturedRows.length.toLocaleString(language),
      }),
    });
  }, [capture?.rows, language, showToast, t]);

  const captureMenuOptions = React.useMemo<IContextMenuOption[]>(
    () =>
      [
        {
          text: capture?.active ? t('processList.stopCapture') : t('processList.startCapture'),
          onClick: toggleCapture,
        },
        hasCapturedRows && {
          text: t('processList.exportCaptureJsonl'),
          onClick: exportCaptureJsonl,
        },
        hasCapturedRows && {
          text: t('processList.exportCaptureCsv'),
          onClick: exportCaptureCsv,
        },
        hasCapturedRows && {
          text: t('processList.clearCapture'),
          onClick: clearCapture,
        },
      ].filter(Boolean) as IContextMenuOption[],
    [
      capture?.active,
      clearCapture,
      exportCaptureCsv,
      exportCaptureJsonl,
      hasCapturedRows,
      t,
      toggleCapture,
    ],
  );

  React.useEffect(() => {
    if (!autoRefreshActive) return;

    const timeout = window.setTimeout(loadProcesses, 200);
    const interval = window.setInterval(loadProcesses, autoRefreshMs);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [autoRefreshActive, autoRefreshMs, loadProcesses]);

  return (
    <div
      className={styles.container}
      style={
        {
          '--data-border-color': theme.bar.borderColor,
        } as React.CSSProperties
      }
    >
      <div className={styles.filterBar} style={{ backgroundColor: theme.bar.backgroundColor }}>
        <ColumnFilterInput
          inputClassName={styles.filterInput}
          value={filter}
          columnNames={[]}
          placeholder={t('processList.filterPlaceholder')}
          onChange={setFilter}
          inputStyle={{ color: theme.bar.color }}
          dropdownBackgroundColor={theme.bar.fieldBackgroundColor}
          dropdownBorderColor={theme.bar.borderColor}
          dropdownColor={theme.bar.color}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.tableContainer}>
          <Table
            columns={columns}
            rows={filteredRows}
            sort={sort}
            rowKeyExtractor={(row) => `${row.pid}:${row.username}:${row.database}:${row.client}`}
            onSort={handleSort}
            onSelectCellData={setSelectedCell}
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
                  onActiveTab={(tab) => setActivePreviewTab(tab?.idTab)}
                  ascentColor={theme.tab.ascentColor}
                  backgroundColor={theme.tab.backgroundColor}
                  backgroundColorBar={theme.tab.bar.backgroundColor}
                  borderColor={theme.tab.borderColor}
                  color={theme.tab.color}
                  tabs={[{ idTab: 'value', title: t('tabs.value') }]}
                />

                <Button
                  title={t('tooltip.closeValuePreview')}
                  backgroundColor={theme.tab.backgroundColor}
                  color={theme.tab.color}
                  onClick={toggleValuePreview}
                  width="auto"
                  icon={() => <IconMdiClose width={16} />}
                />
              </div>

              <TabWindow>
                <TabContent activeTabId={activePreviewTab} idTab="value">
                  <ReferenceValuePreview
                    readonly
                    language={selectedCell?.column?.attribute == 'query' ? 'sql' : 'json'}
                    key={`${selectedCell?.rowIndex ?? 'none'}:${selectedCell?.colIndex ?? 'none'}`}
                    column={selectedCell?.column}
                    dialect={dialect.editorDialect}
                    value={selectedCell?.value}
                  />
                </TabContent>
              </TabWindow>
            </div>
          </ResizableContainer>
        )}
      </div>

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          text
          smallIcon
          onContextMenu={openAutoRefreshMenu}
          color={autoRefreshActive ? theme.bar.fieldColor : theme.bar.color}
          onClick={toggleAutoRefresh}
          title={autoRefreshActive ? t('processList.pauseAutoRefresh') : t('processList.playAutoRefresh')}
        >
          {autoRefreshActive ? <IconMdiPause width={16} height={16} /> : <RunIcon size={14} />}
        </Button>

        <Button
          text
          smallIcon
          title={t('tooltip.captureOptions')}
          onClick={openCaptureMenu}
          color={captureButtonColor}
        >
          <RecordIcon size={16} />
        </Button>

        <Button
          text
          smallIcon
          color={theme.bar.color}
          onClick={toggleValuePreview}
          title={showValuePreview ? t('tooltip.closeValuePreview') : t('tooltip.openPreview')}
        >
          <PanelFile size={16} />
        </Button>

        <ContextMenu
          placement="top"
          position={autoRefreshMenuPosition}
          options={autoRefreshMenuOptions}
          onClose={() => setAutoRefreshMenuPosition(undefined)}
        />

        <ContextMenu
          placement="top"
          position={captureMenuPosition}
          options={captureMenuOptions}
          onClose={() => setCaptureMenuPosition(undefined)}
        />

        <Spacer />

        {(capture?.active || !!capture?.rows.length) && (
          <Text
            title={capture.active ? t('capture.activeTitle') : t('capture.stoppedTitle')}
            userSelect={false}
            color={capture.active ? theme.capture.activeColor : theme.bar.color}
          >
            {t('capture.status', { count: capture.rows.length.toLocaleString(language) })}
          </Text>
        )}

        {!!lastFetchDate && (
          <Text userSelect={false} color={theme.bar.color} title={t('common.lastUpdatedAt')}>
            {t('common.updatedAt', { date: toDateTime(lastFetchDate) })}
          </Text>
        )}
      </Bar>
    </div>
  );
};

export default ProcessList;
