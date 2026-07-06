import { ipcMain } from 'electron';

export default async function addListener<Params extends unknown[], Data>(
  event: string,
  callbackFunction: CallbackFunction<Params, Data>,
) {
  ipcMain.handle(event, async (_, ...params) => {
    try {
      const data = await callbackFunction(...(params as Params));
      return { data, error: null };
    } catch (error) {
      console.error(error);
      const errorObj = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return { data: null, error: errorObj };
    }
  });
}

type CallbackFunction<Params extends unknown[], Data> = (...params: Params) => Data | Promise<Data>;
