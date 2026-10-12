import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import {
  AddIcon,
  CancelIcon,
  CountIcon,
  ExportIcon,
  PanelFile,
  RecordIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import type { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import styles from '../../styles.module.css';

interface ResultToolbarProps {
  data: IQueryResult;
  readOnly?: boolean;
  editable: boolean;
  saving: boolean;
  cancelingQuery?: boolean;
  loadingRowsCount: boolean;
  rowsCount?: number;
  showValuePreview: boolean;
  executionTimeMs?: number;
  captureButtonColor?: string;
  barTheme: {
    backgroundColor?: string;
    borderColor?: string;
    color?: string;
  };
  captureTheme: {
    activeColor?: string;
  };
  onSave: () => void | Promise<void>;
  onAddRow: () => void;
  onToggleValuePreview: () => void;
  onRefresh: () => void;
  onOpenExportModal: () => void;
  onOpenCaptureMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onLoadRowsCount: () => void | Promise<void>;
  onCancelQuery: () => void;
}

const formatExecutionTime = (timeMs?: number) => {
  if (typeof timeMs !== 'number' || Number.isNaN(timeMs)) return '-';

  return timeMs < 1000 ? `${timeMs}ms` : `${(timeMs / 1000).toFixed(2)}s`;
};

export const ResultToolbar = ({
  data,
  readOnly,
  editable,
  saving,
  cancelingQuery,
  loadingRowsCount,
  rowsCount,
  showValuePreview,
  executionTimeMs,
  captureButtonColor,
  barTheme,
  captureTheme,
  onSave,
  onAddRow,
  onToggleValuePreview,
  onRefresh,
  onOpenExportModal,
  onOpenCaptureMenu,
  onLoadRowsCount,
  onCancelQuery,
}: ResultToolbarProps) => {
  const { t, language } = useI18nStore(
    useShallow((state) => ({ t: state.t, language: state.language })),
  );

  return (
    <Bar backgroundColor={barTheme.backgroundColor} borderColor={barTheme.borderColor}>
      {!readOnly && (
        <Button text smallIcon title={t('common.save')} color={barTheme.color} onClick={onSave} loading={saving}>
          <SaveIcon size={16} />
        </Button>
      )}

      {editable && (
        <Button
          text
          smallIcon
          title={t('common.addRow')}
          onClick={onAddRow}
          disabled={data.loading}
          color={barTheme.color}
        >
          <AddIcon size={14} />
        </Button>
      )}

      <Button
        text
        smallIcon
        title={showValuePreview ? t('tooltip.closeValuePreview') : t('tooltip.openPreview')}
        onClick={onToggleValuePreview}
        color={barTheme.color}
      >
        <PanelFile size={16} />
      </Button>

      {!readOnly && (
        <RefreshButton menuPlacement="top" color={barTheme.color} disabled={data.loading} onRefresh={onRefresh} />
      )}

      <Button
        text
        smallIcon
        title={t('modal.exportData')}
        onClick={onOpenExportModal}
        disabled={data.loading}
        color={barTheme.color}
      >
        <ExportIcon size={16} />
      </Button>

      <Button
        text
        smallIcon
        title={t('tooltip.captureOptions')}
        onClick={onOpenCaptureMenu}
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
        onClick={onLoadRowsCount}
        loading={loadingRowsCount}
        disabled={data.loading}
        color={barTheme.color}
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
          color={barTheme.color}
        >
          <CancelIcon size={16} />
        </Button>
      )}

      <Spacer />

      {(data.capture?.active || !!data.capture?.rows.length) && (
        <Text
          title={data.capture.active ? t('capture.activeTitle') : t('capture.stoppedTitle')}
          userSelect={false}
          color={data.capture.active ? captureTheme.activeColor : barTheme.color}
        >
          {t('capture.status', {
            count: data.capture.rows.length.toLocaleString(language),
          })}
        </Text>
      )}

      <Text
        title={data.loading ? t('tooltip.currentQueryExecutionTime') : t('tooltip.queryExecutionTime')}
        userSelect={false}
        color={barTheme.color}
      >
        {data.loading
          ? t('query.runningFor', { time: formatExecutionTime(executionTimeMs) })
          : formatExecutionTime(executionTimeMs)}
      </Text>

      <Text title={t('common.totalRowsDisplayed')} userSelect={false} color={barTheme.color}>
        {t('query.displayedRows', { count: (data.rows || []).length })}
      </Text>

      <Text title={t('common.lastUpdatedAt')} userSelect={false} color={barTheme.color}>
        {t('common.updatedAt', { date: toDateTime(data.date_run) })}
      </Text>
    </Bar>
  );
};
