import type { ElectronAPI } from '@electron-toolkit/preload';
import type { Environment } from 'monaco-editor';
export type { IExportProgress, IApplyTableChangesParams, IApplyTableChangesResult, ITableDataConflict } from './database';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    shiftPressed?: boolean;
    ctrlPressed?: boolean;
    metaPressed?: boolean;
    MonacoEnvironment?: Environment;
  }
}
