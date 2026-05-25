import { BrowserWindow } from 'electron';

export const emitEvent = (event: string, value?: any) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(event, value);
  });
};
