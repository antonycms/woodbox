import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getErrorMessage } from '@shared/utils/error';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { useLatestFunc } from '@renderer/hooks/useLatestFunc';
import { normalizeProcessRow, type ProcessListRow } from '../utils/rows';
import { getProcessCaptureRowHash } from '../utils/capture';
import type { IProcessListCaptureState } from '../types';

export const useProcessList = (id_connection: string) => {
  const t = useI18nStore((state) => state.t);
  const { getProcessList, cancelProcess } = useDatabaseStore(
    useShallow((state) => ({
      getProcessList: state.getProcessList,
      cancelProcess: state.cancelProcess,
    })),
  );
  const showToast = useToastStore((state) => state.showToast);
  const [rows, setRows] = React.useState<ProcessListRow[]>([]);
  const [autoRefreshActive, setAutoRefreshActive] = React.useState(true);
  const [autoRefreshMs, setAutoRefreshMs] = React.useState(5000);
  const [capture, setCapture] = React.useState<IProcessListCaptureState>();
  const [cancelingProcessPids, setCancelingProcessPids] = React.useState<Set<string>>(new Set());
  const [lastFetchDate, setLastFetchDate] = React.useState<Date | null>(null);
  const loadingRef = React.useRef(false);

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
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: t('processList.loadFailed'),
        description: getErrorMessage(error, t('common.unknownError')),
      });
    } finally {
      loadingRef.current = false;
    }
  });

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
      } catch (error: unknown) {
        showToast({
          type: 'error',
          title: t('processList.cancelProcessFailed'),
          description: getErrorMessage(error, t('common.unknownError')),
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

  const toggleAutoRefresh = React.useCallback(() => {
    setAutoRefreshActive((current) => !current);
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

  const changeAutoRefreshInterval = React.useCallback((interval: number) => {
    setAutoRefreshMs(interval);
    setAutoRefreshActive(true);
  }, []);

  React.useEffect(() => {
    if (!autoRefreshActive) return;

    const timeout = window.setTimeout(loadProcesses, 200);
    const interval = window.setInterval(loadProcesses, autoRefreshMs);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [autoRefreshActive, autoRefreshMs, loadProcesses]);

  return {
    rows, lastFetchDate, cancelingProcessPids, handleCancelProcess,
    autoRefreshActive, autoRefreshMs, toggleAutoRefresh, changeAutoRefreshInterval,
    capture, toggleCapture, clearCapture,
  };
};
