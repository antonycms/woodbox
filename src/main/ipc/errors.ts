import type { IpcError } from '@shared/types/ipc';
import { getErrorMessage } from '@shared/utils/error';

export const serializeIpcError = (error: unknown): IpcError => {
  const result: IpcError = { message: getErrorMessage(error, 'Ocorreu um erro desconhecido.') };
  if (error && typeof error === 'object') {
    if ('position' in error && (typeof error.position === 'string' || typeof error.position === 'number')) {
      result.position = String(error.position);
    }
    if ('code' in error && typeof error.code === 'string') result.code = error.code;
  }
  return result;
};
