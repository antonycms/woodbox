import React from 'react';
import Table, { type ITableSelectedCellData } from '@renderer/components/Table';
import { Button } from '@renderer/components/Button';
import ColumnFilterInput from '@renderer/components/ColumnFilterInput';
import { type IColumn, type ISortDirection, type ITableSort } from '@renderer/components/Table/dtos';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { CancelIcon } from '@renderer/styles/icons';
import { getNextSort } from '@renderer/utils/tableSort';
import { getFilteredProcessListRows, getProcessListColumns, type ProcessListRow } from './utils/rows';
import { useProcessList } from './hooks/useProcessList';
import { ProcessToolbar } from './components/ProcessToolbar';
import { ProcessValuePreview } from './components/ProcessValuePreview';
import styles from './styles.module.css';

export interface IProcessListProps {
  id_connection: string;
}

const ProcessList = ({ id_connection }: IProcessListProps) => {
  const { processList: theme } = useThemeStore((state) => state.activeTheme);
  const t = useI18nStore((state) => state.t);
  const [filter, setFilter] = React.useState('');
  const [showValuePreview, setShowValuePreview] = React.useState(false);
  const [selectedCell, setSelectedCell] = React.useState<ITableSelectedCellData<ProcessListRow>>();
  const [sort, setSort] = React.useState<ITableSort[]>([
    { columnName: 'duration_seconds', sortType: 'DESC' },
  ]);
  const {
    rows, lastFetchDate, cancelingProcessPids, handleCancelProcess,
    autoRefreshActive, autoRefreshMs, toggleAutoRefresh, changeAutoRefreshInterval,
    capture, toggleCapture, clearCapture,
  } = useProcessList(id_connection);

  const filteredRows = React.useMemo(() => {
    return getFilteredProcessListRows(rows, filter, sort);
  }, [filter, rows, sort]);

  const handleSort = React.useCallback(
    (column: IColumn<ProcessListRow>, sortType?: ISortDirection | null) => {
      setSort((currentSort) => getNextSort(currentSort, column.attribute, sortType));
    },
    [],
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

  const toggleValuePreview = React.useCallback(() => {
    setShowValuePreview((current) => !current);
  }, []);

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

        <ProcessValuePreview
          show={showValuePreview}
          id_connection={id_connection}
          selectedCell={selectedCell}
          onClose={toggleValuePreview}
        />
      </div>

      <ProcessToolbar
        autoRefreshActive={autoRefreshActive}
        autoRefreshMs={autoRefreshMs}
        toggleAutoRefresh={toggleAutoRefresh}
        changeAutoRefreshInterval={changeAutoRefreshInterval}
        capture={capture}
        toggleCapture={toggleCapture}
        clearCapture={clearCapture}
        showValuePreview={showValuePreview}
        toggleValuePreview={toggleValuePreview}
        lastFetchDate={lastFetchDate}
      />
    </div>
  );
};

export default ProcessList;
