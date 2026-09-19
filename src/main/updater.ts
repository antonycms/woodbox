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
  manualDownloadUrl?: string;
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
