import { ipcMain } from 'electron';
import type { IpcChannel, IpcData, IpcResponse } from '@shared/types/ipc';
import { assertTrustedSender } from '../ipc/security';
import { parseIpcArgs, type ParsedIpcArgs } from '../ipc/validation';
import { serializeIpcError } from '../ipc/errors';

export default function addListener<C extends IpcChannel>(
  channel: C,
  callbackFunction: (...params: ParsedIpcArgs<C>) => IpcData<C> | Promise<IpcData<C>>,
) {
  ipcMain.handle(channel, async (event, ...params): Promise<IpcResponse<IpcData<C>>> => {
    try {
      assertTrustedSender(event);
      const data = await callbackFunction(...parseIpcArgs(channel, params));
      return { data, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: serializeIpcError(error) };
    }
  });
}
