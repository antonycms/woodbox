import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import call from '@renderer/utils/call';
import styles from './styles.module.css';

type UpdateInfo = {
  version: string;
  currentVersion: string;
  releaseNotes?: string | null;
  releaseDate?: string;
};

type UpdateProgress = {
  version?: string;
  percent: number;
  transferred: number;
  total: number;
};

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
  const { t } = useI18n();
  const {
    activeTheme: { modal },
  } = useThemeContext();

  const [update, setUpdate] = React.useState<UpdateInfo | null>(null);
  const [status, setStatus] = React.useState<UpdateStatus>('available');
  const [progress, setProgress] = React.useState(0);

  const show = !!update;
  const formattedDate = React.useMemo(() => formatDate(update?.releaseDate), [update?.releaseDate]);

  const closeModal = React.useCallback(() => {
    setUpdate(null);
    setStatus('available');
    setProgress(0);
  }, []);

  const ignoreUpdate = React.useCallback(() => {
    if (update?.version) {
      window.localStorage.setItem(ignoredUpdateStorageKey, update.version);
    }

    closeModal();
  }, [closeModal, update?.version]);

  const handleUpdate = React.useCallback(async () => {
    try {
      if (status === 'downloaded') {
        await call('@post:quit_and_install_update');
        return;
      }

      setStatus('downloading');
      await call('@post:download_update');
    } catch (_error) {
      setStatus('error');
    }
  }, [status]);

  React.useEffect(() => {
    const removeAvailableListener = window.electron.ipcRenderer.on(
      '@event:update_available',
      (_event, nextUpdate: UpdateInfo) => {
        const ignoredVersion = window.localStorage.getItem(ignoredUpdateStorageKey);

        if (ignoredVersion === nextUpdate.version) return;

        setUpdate(nextUpdate);
        setStatus('available');
        setProgress(0);
      },
    );

    const removeProgressListener = window.electron.ipcRenderer.on(
      '@event:update_download_progress',
      (_event, nextProgress: UpdateProgress) => {
        setProgress(Math.min(100, Math.max(0, nextProgress.percent)));
      },
    );

    const removeDownloadedListener = window.electron.ipcRenderer.on(
      '@event:update_downloaded',
      (_event, nextUpdate: UpdateInfo) => {
        setUpdate(nextUpdate);
        setStatus('downloaded');
        setProgress(100);
      },
    );

    const removeErrorListener = window.electron.ipcRenderer.on('@event:update_error', () => {
      setStatus('error');
    });

    return () => {
      removeAvailableListener();
      removeProgressListener();
      removeDownloadedListener();
      removeErrorListener();
    };
  }, []);

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

        {status === 'downloading' && (
          <div className={styles.progressTrack} style={{ color: modal.color }}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
        )}

        {status === 'error' && (
          <Text userSelect={false} color={modal.cancelButtonBackgroundColor} small>
            {t('update.downloadFailed')}
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
            {status === 'downloaded' ? t('update.restartAndInstall') : t('update.install')}
          </Button>
        </Row>
      </div>
    </Modal>
  );
});

UpdateAvailableModal.displayName = 'UpdateAvailableModal';
