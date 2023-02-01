import type { ElectronAPI } from '@electron-toolkit/preload';
import type { Environment } from 'monaco-editor';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    shiftPressed?: boolean;
    ctrlPressed?: boolean;
    MonacoEnvironment?: Environment;
  }
}
