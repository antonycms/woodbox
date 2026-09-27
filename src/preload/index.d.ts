import type { WoodboxApi } from '@shared/types/api';
import type { Environment } from 'monaco-editor';
export type { IExportProgress, IApplyTableChangesParams, IApplyTableChangesResult, ITableDataConflict } from './database';

declare global {
  interface Window {
    api: WoodboxApi;
    shiftPressed?: boolean;
    ctrlPressed?: boolean;
    metaPressed?: boolean;
    MonacoEnvironment?: Environment;
  }
}
