import { BrowserWindow, app } from 'electron';
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater';
import addListener from './utils/addListener';
import { emitEvent } from './utils/emitEvent';

type ReleaseNoteInfo = {
  readonly version: string;
  readonly note: string | null;
};

type UpdateAvailablePayload = {
  version: string;
  currentVersion: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseDate?: string;
};

type UpdateProgressPayload = {
  version?: string;
  percent: number;
  transferred: number;
  total: number;
};

let initialized = false;
let downloadStarted = false;
let latestUpdateVersion: string | undefined;

const normalizeReleaseNotes = (releaseNotes: UpdateInfo['releaseNotes']) => {
  if (!releaseNotes) return null;
  if (typeof releaseNotes === 'string') return releaseNotes;

  return releaseNotes
    .map(({ version, note }: ReleaseNoteInfo) => [`v${version}`, note].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
};

const toUpdateAvailablePayload = (info: UpdateInfo): UpdateAvailablePayload => {
  return {
    version: info.version,
    currentVersion: app.getVersion(),
    releaseName: info.releaseName,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
    releaseDate: info.releaseDate,
  };
};

const toProgressPayload = (progress: ProgressInfo): UpdateProgressPayload => {
  return {
    version: latestUpdateVersion,
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
  };
};

const downloadUpdate = async () => {
  if (!app.isPackaged || downloadStarted) return;

  downloadStarted = true;
  await autoUpdater.downloadUpdate();
};

const quitAndInstallUpdate = () => {
  if (!app.isPackaged) return;

  autoUpdater.quitAndInstall();
};

addListener('@post:download_update', downloadUpdate);
addListener('@post:quit_and_install_update', quitAndInstallUpdate);

export const initAutoUpdater = (mainWindow: BrowserWindow) => {
  if (initialized || !app.isPackaged) return;

  initialized = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    latestUpdateVersion = info.version;
    downloadStarted = false;
    emitEvent('@event:update_available', toUpdateAvailablePayload(info));
  });

  autoUpdater.on('download-progress', (progress) => {
    emitEvent('@event:update_download_progress', toProgressPayload(progress));
  });

  autoUpdater.on('update-downloaded', (info) => {
    latestUpdateVersion = info.version;
    emitEvent('@event:update_downloaded', toUpdateAvailablePayload(info));
  });

  autoUpdater.on('error', (error) => {
    downloadStarted = false;
    emitEvent('@event:update_error', { message: error.message });
  });

  mainWindow.webContents.once('did-finish-load', () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error(error);
    });
  });
};
