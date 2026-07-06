import { dialog } from 'electron';
import addListener from '../utils/addListener';

const selectSqliteFile = async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'SQLite', extensions: ['sqlite', 'sqlite3', 'db', 'db3'] }],
  });

  return result.canceled ? null : result.filePaths[0];
};

addListener('@dialog:select_sqlite_file', selectSqliteFile);
