import { ipcRenderer } from 'electron';
import type { IpcArgs, IpcChannel, IpcData, IpcEvents, IpcResponse } from '@shared/types/ipc';

// These factories stay inside the isolated preload; channels are never supplied by the renderer.
export const request = <C extends IpcChannel>(channel: C) =>
  async (...params: IpcArgs<C>): Promise<IpcData<C>> => {
    const result: IpcResponse<IpcData<C>> = await ipcRenderer.invoke(channel, ...params);
    // Error instances lose custom fields across contextBridge. Reject with serializable data
    // so SQL error positions survive and the renderer can highlight the failing statement.
    if (result.error) throw result.error;
    return result.data;
  };

export const subscribe = <C extends keyof IpcEvents>(channel: C) =>
  (callback: (data: IpcEvents[C]) => void): (() => void) => {
    if (typeof callback !== 'function') throw new TypeError('Listener inválido.');
    const listener = (_event: Electron.IpcRendererEvent, data: IpcEvents[C]) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };
