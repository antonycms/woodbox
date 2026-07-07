import { dialog } from 'electron';
import addListener from '@main/utils/addListener';

const selectSqliteFile = async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'SQLite', extensions: ['sqlite', 'sqlite3', 'db', 'db3'] }],
  });

  return result.canceled ? null : result.filePaths[0];
};

const selectDbeaverExportFile = async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Export do DBeaver', extensions: ['zip', 'dbp'] }],
  });

  return result.canceled ? null : result.filePaths[0];
};

addListener('@dialog:select_sqlite_file', selectSqliteFile);
addListener('@dialog:select_dbeaver_export_file', selectDbeaverExportFile);
