import { useShallow } from 'zustand/react/shallow';
import { useUpdatesStore } from '@renderer/stores/Updates';
import type { UpdateAvailablePayload as UpdateInfo } from '@shared/types/updates';
import { getErrorMessage } from '@shared/utils/error';
import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import styles from './styles.module.css';

type UpdateStatus = 'available' | 'downloading' | 'downloaded' | 'error';

const ignoredUpdateStorageKey = '@update:ignored_version';

const formatDate = (date?: string) => {
  if (!date) return null;

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  } catch (_error) {
    return null;
  }
};

export const UpdateAvailableModal = React.memo(() => {
  const updates = useUpdatesStore(
    useShallow((state) => ({
      quitAndInstall: state.quitAndInstall,
      download: state.download,
      onAvailable: state.onAvailable,
      onProgress: state.onProgress,
      onDownloaded: state.onDownloaded,
      onError: state.onError,
    })),
  );
  const t = useI18nStore((state) => state.t);
  const { modal } = useThemeStore((state) => state.activeTheme);

  const [update, setUpdate] = React.useState<UpdateInfo | null>(null);
  const [status, setStatus] = React.useState<UpdateStatus>('available');
  const [progress, setProgress] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const show = !!update;
  const requiresManualInstall = !!update?.manualDownloadUrl;
  const formattedDate = React.useMemo(() => formatDate(update?.releaseDate), [update?.releaseDate]);

  const closeModal = React.useCallback(() => {
    setUpdate(null);
    setStatus('available');
    setProgress(0);
    setErrorMessage(null);
  }, []);

  const ignoreUpdate = React.useCallback(() => {
    if (update?.version) {
      window.localStorage.setItem(ignoredUpdateStorageKey, update.version);
    }

    closeModal();
  }, [closeModal, update?.version]);

  const handleUpdate = React.useCallback(async () => {
    try {
      if (update?.manualDownloadUrl) {
        window.open(update.manualDownloadUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (status === 'downloaded') {
        setErrorMessage(null);
        await updates.quitAndInstall();
        return;
      }

      setStatus('downloading');
      setErrorMessage(null);
      await updates.download();
    } catch (error) {
      setErrorMessage(getErrorMessage(error) || null);
      setStatus('error');
    }
  }, [status, update?.manualDownloadUrl, updates]);

  React.useEffect(() => {
    const removeAvailableListener = updates.onAvailable((nextUpdate: UpdateInfo) => {
      const ignoredVersion = window.localStorage.getItem(ignoredUpdateStorageKey);

      if (ignoredVersion === nextUpdate.version) return;

      setUpdate(nextUpdate);
      setStatus('available');
      setProgress(0);
      setErrorMessage(null);
    });

    const removeProgressListener = updates.onProgress((nextProgress) => {
      setProgress(Math.min(100, Math.max(0, nextProgress.percent)));
    });

    const removeDownloadedListener = updates.onDownloaded((nextUpdate: UpdateInfo) => {
      setUpdate(nextUpdate);
      setStatus('downloaded');
      setProgress(100);
    });

    const removeErrorListener = updates.onError((error) => {
      setErrorMessage(error.message || null);
      setStatus('error');
    });

    return () => {
      removeAvailableListener();
      removeProgressListener();
      removeDownloadedListener();
      removeErrorListener();
    };
  }, [updates]);

  if (!update) return null;

  return (
    <Modal
      closeOutside={status !== 'downloading'}
      show={show}
      width="500px"
      title={t('update.availableTitle')}
      onClose={closeModal}
    >
      <div className={styles.container} style={{ color: modal.color }}>
        <div
          className={styles.versionPanel}
          style={{ borderColor: modal.borderColor, backgroundColor: modal.panelBackgroundColor }}
        >
          <Text userSelect={false} color={modal.color} small>
            {t('update.currentVersion', { version: update.currentVersion })}
          </Text>

          <Text userSelect={false} color={modal.color} small>
            {t('update.newVersion', { version: update.version })}
          </Text>

          {!!formattedDate && (
            <Text userSelect={false} color={modal.color} small>
              {t('update.releasedAt', { date: formattedDate })}
            </Text>
          )}

          <Divider />

          <Text userSelect={false} color={modal.color} bold>
            {t('update.releaseNotes')}
          </Text>

          <pre className={styles.notes} style={{ color: modal.color }}>
            {update.releaseNotes || t('update.emptyReleaseNotes')}
          </pre>
        </div>

        {requiresManualInstall && (
          <Text userSelect={false} color={modal.color} small>
            {t('update.manualInstallNotice')}
          </Text>
        )}

        {status === 'downloading' && (
          <div className={styles.progressTrack} style={{ color: modal.color }}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
        )}

        {status === 'error' && (
          <Text userSelect={false} color={modal.cancelButtonBackgroundColor} small>
            {errorMessage
              ? t('update.updateFailedWithMessage', { message: errorMessage })
              : t('update.downloadFailed')}
          </Text>
        )}

        <Divider />

        <Row>
          <Button
            sm={4}
            backgroundColor={modal.fieldBackgroundColor}
            color={modal.mutedColor}
            disabled={status === 'downloading'}
            onClick={ignoreUpdate}
          >
            {t('update.ignore')}
          </Button>

          <Spacer />

          <Button
            sm={3}
            color={modal.cancelButtonColor}
            backgroundColor={modal.cancelButtonBackgroundColor}
            disabled={status === 'downloading'}
            onClick={closeModal}
          >
            {t('common.close')}
          </Button>

          <Button
            sm={3}
            color={modal.saveButtonColor}
            backgroundColor={modal.saveButtonBackgroundColor}
            loading={status === 'downloading'}
            onClick={handleUpdate}
          >
            {requiresManualInstall
              ? t('update.manualDownload')
              : status === 'downloaded'
                ? t('update.restartAndInstall')
                : t('update.install')}
          </Button>
        </Row>
      </div>
    </Modal>
  );
});

UpdateAvailableModal.displayName = 'UpdateAvailableModal';
