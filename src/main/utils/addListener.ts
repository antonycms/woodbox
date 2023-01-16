import { ipcMain } from 'electron';

export default async function addListener(event: string, callbackFunction: CallbackFunction) {
  ipcMain.handle(event, (_, ...params) => callbackFunction(...params));
}

type CallbackFunction = (...params) => any | Promise<any>;
