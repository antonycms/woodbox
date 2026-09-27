import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { ContextMenu, type IContextMenuOption, type IContextMenuPosition } from '@renderer/components/ContextMenu';
import { AUTO_REFRESH_OPTIONS } from '@renderer/components/RefreshButton';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { PanelFile, RecordIcon, RunIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import IconMdiPause from '~icons/mdi/pause';
import { buildProcessCaptureCsv, buildProcessCaptureJsonl, downloadProcessCaptureFile } from '../../utils/capture';
import type { IProcessListCaptureState } from '../../types';

interface ProcessToolbarProps {
  autoRefreshActive: boolean;
  autoRefreshMs: number;
  toggleAutoRefresh(): void;
  changeAutoRefreshInterval(interval: number): void;
  capture?: IProcessListCaptureState;
  toggleCapture(): void;
  clearCapture(): void;
  showValuePreview: boolean;
  toggleValuePreview(): void;
  lastFetchDate: Date | null;
}

export const ProcessToolbar = ({
  autoRefreshActive, autoRefreshMs, toggleAutoRefresh, changeAutoRefreshInterval,
  capture, toggleCapture, clearCapture, showValuePreview, toggleValuePreview, lastFetchDate,
}: ProcessToolbarProps) => {
  const { processList: theme } = useThemeStore((state) => state.activeTheme);
  const { t, language } = useI18nStore(useShallow((state) => ({ t: state.t, language: state.language })));
  const showToast = useToastStore((state) => state.showToast);
  const [autoRefreshMenuPosition, setAutoRefreshMenuPosition] = React.useState<IContextMenuPosition>();
  const [captureMenuPosition, setCaptureMenuPosition] = React.useState<IContextMenuPosition>();

  const hasCapturedRows = !!capture?.rows.length;
  const captureButtonColor = capture?.active
    ? theme.capture.activeColor
    : hasCapturedRows
      ? theme.capture.modifiedColor
      : theme.bar.color;

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
          changeAutoRefreshInterval(option.value);
        },
      })),
    [autoRefreshMs, changeAutoRefreshInterval],
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

  return (
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
  );
};
