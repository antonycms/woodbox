import { create } from 'zustand';
import type { WoodboxApi } from '@shared/types/api';

export const useDialogsStore = create<WoodboxApi['dialogs']>()(() => ({
  selectSqliteFile: (...args) => window.api.dialogs.selectSqliteFile(...args),
  selectDbeaverExportFile: (...args) => window.api.dialogs.selectDbeaverExportFile(...args),
  selectSslFile: (...args) => window.api.dialogs.selectSslFile(...args),
  selectSshKey: (...args) => window.api.dialogs.selectSshKey(...args),
}));
