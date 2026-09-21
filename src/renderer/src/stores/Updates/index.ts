import { create } from 'zustand';
import type { WoodboxApi } from '@shared/types/api';

export const useUpdatesStore = create<WoodboxApi['updates']>()(() => ({
  download: (...args) => window.api.updates.download(...args),
  quitAndInstall: (...args) => window.api.updates.quitAndInstall(...args),
  onAvailable: (...args) => window.api.updates.onAvailable(...args),
  onProgress: (...args) => window.api.updates.onProgress(...args),
  onDownloaded: (...args) => window.api.updates.onDownloaded(...args),
  onError: (...args) => window.api.updates.onError(...args),
}));
