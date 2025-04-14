import './storage';
import * as path from 'path';
import { app, shell, BrowserWindow } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';

import { closeAllConnections } from './database';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 675,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  /**
   * HMR for renderer base on electron-vite cli.
   * Load the remote URL for development or the local html file for production.
   */
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.maximize();
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

  const mainWindow = createWindow();

  if (is.dev) {
    mainWindow.webContents.openDevTools();
  }
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
