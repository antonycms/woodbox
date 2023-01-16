import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    shiftPressed?: boolean;
    ctrlPressed?: boolean;
  }
}
