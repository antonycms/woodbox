import { useWorkspaceStore } from './Workspace';
import { useSnippetsStore } from './Snippets';
import { useAIStore } from './AI';
import { useThemeStore } from './Theme';
import { useI18nStore } from './I18n';

export const initializeStores = async () => {
  await Promise.all([useThemeStore.getState().hydrate(), useI18nStore.getState().hydrate()]);

  await Promise.all([
    useWorkspaceStore.getState().initialize(),
    useSnippetsStore.getState().initialize(),
    useAIStore.getState().initialize(),
  ]);
};
