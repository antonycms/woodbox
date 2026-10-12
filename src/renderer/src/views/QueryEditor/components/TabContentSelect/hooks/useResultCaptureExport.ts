import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { type IContextMenuOption, type IContextMenuPosition } from '@renderer/components/ContextMenu';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import type { IQueryResult } from '@renderer/views/QueryEditor/dtos';

interface UseResultCaptureExportParams {
  data: IQueryResult;
  activeColor?: string;
  modifiedColor?: string;
  defaultColor?: string;
  onToggleCapture(): void;
  onClearCapture(): void;
}

const stringifyCaptureValue = (value: unknown) =>
  JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item));

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

export const useResultCaptureExport = ({
  data,
  activeColor,
  modifiedColor,
  defaultColor,
  onToggleCapture,
  onClearCapture,
}: UseResultCaptureExportParams) => {
  const { t, language } = useI18nStore(
    useShallow((state) => ({ t: state.t, language: state.language })),
  );
  const showToast = useToastStore((state) => state.showToast);
  const [captureMenuPosition, setCaptureMenuPosition] = React.useState<IContextMenuPosition>();

  const hasCapturedRows = !!data.capture?.rows.length;
  const captureButtonColor = data.capture?.active
    ? activeColor
    : hasCapturedRows
      ? modifiedColor
      : defaultColor;

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

  const closeCaptureMenu = React.useCallback(() => {
    setCaptureMenuPosition(undefined);
  }, []);

  const captureMenuOptions = React.useMemo<IContextMenuOption[]>(
    () =>
      [
        {
          text: data.capture?.active ? t('capture.stop') : t('capture.start'),
          onClick: onToggleCapture,
        },
        hasCapturedRows && {
          text: t('capture.exportJsonl'),
          onClick: handleExportCaptureJsonl,
        },
        hasCapturedRows && {
          text: t('capture.exportCsv'),
          onClick: handleExportCaptureCsv,
        },
        hasCapturedRows && {
          text: t('capture.discard'),
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
      t,
    ],
  );

  return {
    captureButtonColor,
    captureMenuPosition,
    captureMenuOptions,
    openCaptureMenu,
    closeCaptureMenu,
  };
};
