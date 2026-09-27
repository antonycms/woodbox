import { BrowserWindow } from 'electron';
import type { IpcEvents } from '@shared/types/ipc';
import { isTrustedRenderer } from '../ipc/security';

export const emitEvent = <C extends keyof IpcEvents>(event: C, value: IpcEvents[C]) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (isTrustedRenderer(window.webContents)) window.webContents.send(event, value);
  });
};
