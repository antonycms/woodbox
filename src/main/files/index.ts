import { dialog } from 'electron';
import path from 'path';
import type { ProjectExportFormat, ProjectImportFormat } from '@shared/types/imports';
import { getProjectExportAdapter } from './exportProjects';
import { getProjectImportAdapter } from './importProjects';
import addListener from '../utils/addListener';

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

const ensureExtension = (filePath: string, extension: string) =>
  path.extname(filePath) ? filePath : `${filePath}.${extension}`;

const selectProjectImportFile = async (format: ProjectImportFormat) => {
  const adapter = getProjectImportAdapter(format);
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: adapter.name, extensions: adapter.extensions }],
  });

  return result.canceled ? null : result.filePaths[0];
};

const selectProjectExportFile = async (format: ProjectExportFormat) => {
  const adapter = getProjectExportAdapter(format);
  const result = await dialog.showSaveDialog({
    defaultPath: `woodbox-projects.${adapter.defaultExtension}`,
    filters: [{ name: adapter.name, extensions: adapter.extensions }],
  });

  return result.canceled || !result.filePath
    ? null
    : ensureExtension(result.filePath, adapter.defaultExtension);
};

const selectSslFile = async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Certificados e chaves', extensions: ['pem', 'crt', 'cert', 'cer', 'key'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });

  return result.canceled ? null : result.filePaths[0];
};

const selectSshKey = async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecionar chave privada SSH',
    properties: ['openFile', 'showHiddenFiles'],
  });

  return result.canceled ? null : result.filePaths[0];
};

addListener('@post:select_sqlite_file', selectSqliteFile);
addListener('@post:select_dbeaver_export_file', selectDbeaverExportFile);
addListener('@post:select_project_import_file', selectProjectImportFile);
addListener('@post:select_project_export_file', selectProjectExportFile);
addListener('@post:select_ssl_file', selectSslFile);
addListener('@post:select_ssh_key', selectSshKey);
