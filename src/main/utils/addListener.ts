import { ipcMain } from 'electron';

export default async function addListener(event: string, callbackFunction: CallbackFunction) {
  ipcMain.handle(event, async (_, ...params) => {
    try {
      const data = await callbackFunction(...params);
      return { data, error: null };
    } catch (error) {
      console.error(error);
      const errorObj = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return { data: null, error: errorObj };
    }
  });
}

type CallbackFunction = (...params) => any | Promise<any>;
