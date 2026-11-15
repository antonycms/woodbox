import type { UpdateAvailablePayload, UpdateProgressPayload } from '@shared/types/updates';
import { BrowserWindow, app } from 'electron';
import type { AppUpdater, ProgressInfo, UpdateInfo } from 'electron-updater';
import addListener from './utils/addListener';
import { emitEvent } from './utils/emitEvent';
import { getIgnoredUpdateVersion, ignoreUpdateVersion } from './storage/store';

type ReleaseNoteInfo = {
  readonly version: string;
  readonly note: string | null;
};

let initialized = false;
let updaterPromise: Promise<AppUpdater> | undefined;
let downloadStarted = false;
let latestUpdateVersion: string | undefined;

const githubReleaseUrl = (version: string) => {
  return `https://github.com/antonycms/woodbox/releases/tag/v${version}`;
};

const htmlEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeHtmlEntities = (text: string) => {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }

    return htmlEntities[entity.toLowerCase()] ?? match;
  });
};

const htmlToPlainText = (html: string) => {
  const text = html
    .replace(/\r\n?/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>(<p[^>]*>)?/gi, '- ')
    .replace(/(<\/p>)?<\/li>/gi, '\n')
    .replace(/<\/(p|h[1-6]|div)>/gi, '\n\n')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  return decodeHtmlEntities(text)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const normalizeReleaseNote = (version: string, note: string | null) => {
  if (!note) return null;

  const lines = htmlToPlainText(note).split('\n');
  const versionHeader = `v${version}`;

  while (lines.length > 0) {
    const first = lines[0].toLowerCase();
    const isHeader = first === versionHeader || first === version || first === 'release notes:';
    if (!isHeader && first !== '') break;
    lines.shift();
  }

  return lines.join('\n').trim() || null;
};

const normalizeReleaseNotes = (version: string, releaseNotes: UpdateInfo['releaseNotes']) => {
  if (!releaseNotes) return null;
  if (typeof releaseNotes === 'string') return normalizeReleaseNote(version, releaseNotes);

  const notes = releaseNotes
    .map(({ version, note }: ReleaseNoteInfo) => ({ version, note: normalizeReleaseNote(version, note) }))
    .filter((item): item is { version: string; note: string } => !!item.note);

  if (notes.length === 0) return null;
  if (notes.length === 1) return notes[0].note;

  return notes.map(({ version, note }) => `v${version}\n${note}`).join('\n\n');
};

const toUpdateAvailablePayload = (info: UpdateInfo): UpdateAvailablePayload => {
  return {
    version: info.version,
    currentVersion: app.getVersion(),
    releaseName: info.releaseName,
    releaseNotes: normalizeReleaseNotes(info.version, info.releaseNotes),
    releaseDate: info.releaseDate,
    manualDownloadUrl: process.platform === 'darwin' ? githubReleaseUrl(info.version) : undefined,
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
  try {
    const autoUpdater = await loadAutoUpdater();
    await autoUpdater.downloadUpdate();
  } catch (error) {
    downloadStarted = false;
    throw error;
  }
};

const quitAndInstallUpdate = async () => {
  if (!app.isPackaged) return;

  const autoUpdater = await loadAutoUpdater();
  autoUpdater.quitAndInstall();
};

const ignoreUpdate = (version: string) => {
  ignoreUpdateVersion(version);
  emitEvent('@event:update_ignored', version);
};

addListener('@post:ignore_update', ignoreUpdate);
addListener('@post:download_update', downloadUpdate);
addListener('@post:quit_and_install_update', quitAndInstallUpdate);

const configureAutoUpdater = (autoUpdater: AppUpdater) => {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallEvent = 'manual';

  autoUpdater.on('update-available', (info) => {
    latestUpdateVersion = info.version;
    downloadStarted = false;

    if (getIgnoredUpdateVersion() !== info.version) {
      emitEvent('@event:update_available', toUpdateAvailablePayload(info));
    }
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

  return autoUpdater;
};

const loadAutoUpdater = () => {
  updaterPromise ??= import('electron-updater')
    .then(({ autoUpdater }) => configureAutoUpdater(autoUpdater))
    .catch((error: unknown) => {
      updaterPromise = undefined;
      throw error;
    });
  return updaterPromise;
};

export const initAutoUpdater = (mainWindow: BrowserWindow) => {
  if (initialized || !app.isPackaged) return;
  initialized = true;

  let shown = mainWindow.isVisible();
  let loaded = !!mainWindow.webContents.getURL() && !mainWindow.webContents.isLoadingMainFrame();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const removeListeners = () => {
    mainWindow.removeListener('show', onShow);
    if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.removeListener('did-finish-load', onLoad);
    }
    mainWindow.removeListener('closed', onClosed);
    app.removeListener('before-quit', stop);
  };
  const stop = () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    removeListeners();
  };
  const onClosed = () => {
    stop();
    initialized = false;
    const nextWindow = BrowserWindow.getAllWindows().find((window) =>
      window !== mainWindow && !window.isDestroyed(),
    );
    if (nextWindow) initAutoUpdater(nextWindow);
  };
  const check = () => {
    if (!shown || !loaded || stopped || timer !== undefined) return;
    // O import pesado só começa após exibir a janela, fora da pilha do show().
    timer = setTimeout(() => {
      if (stopped || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
        stop();
        return;
      }
      void loadAutoUpdater()
        .then((autoUpdater) => {
          if (!stopped && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
            return autoUpdater.checkForUpdates();
          }
          return undefined;
        })
        .catch(console.error)
        .finally(removeListeners);
    }, 250);
  };
  const onShow = () => { shown = true; check(); };
  const onLoad = () => { loaded = true; check(); };

  mainWindow.once('show', onShow);
  mainWindow.webContents.once('did-finish-load', onLoad);
  mainWindow.once('closed', onClosed);
  app.once('before-quit', stop);
  check();
};
