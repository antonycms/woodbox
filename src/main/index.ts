import './storage';
import './files';
import './ai';
import './codex';
import './reactNativeBridge';
import * as path from 'path';
import { app, shell, BrowserWindow, globalShortcut, Menu } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';

import { closeAllConnections } from '@main/database';
import { getWindowState, saveWindowState } from '@main/storage/store';

// fix Wayland color bug
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-features', 'WaylandWpColorManagerV1');
}

function createWindow() {
  const savedState = getWindowState();

  const mainWindow = new BrowserWindow({
    width: savedState?.width ?? 1600,
    height: savedState?.height ?? 900,
    x: savedState?.x,
    y: savedState?.y,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    if (!savedState || savedState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    const isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    saveWindowState({ ...bounds, isMaximized });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F12') return;

    event.preventDefault();
    mainWindow.webContents.toggleDevTools();
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  /**
   * Set app user model id for windows
   */
  electronApp.setAppUserModelId('com.electron');

  /**
   * Default open or close DevTools by F12 in development
   * and ignore CommandOrControl + R in production.
   * see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
   */
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));

  // Remove default menu (prevents Ctrl+W and other default shortcuts from closing the app)
  Menu.setApplicationMenu(null);

  // Disable shortcut to close application
  globalShortcut.register('Control+Q', () => {});

  createWindow();
});

/**
 * Close DBs active connections before quit app.
 */
app.on('before-quit', async () => {
  await closeAllConnections();
});

/**
 * Quit when all windows are closed, except on macOS.
 * There, it's common for applications and their menu bar to
 * stay active until the user quits explicitly with Cmd + Q.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * On macOS it's common to re-create a window in the app when the
 * dock icon is clicked and there are no other windows open.
 */
app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
