import { useWorkspaceStore } from './Workspace';
import { useSnippetsStore } from './Snippets';
import { useAIStore } from './AI';

export const initializeStores = async () => {
  await Promise.all([
    useWorkspaceStore.getState().initialize(),
    useSnippetsStore.getState().initialize(),
    useAIStore.getState().initialize(),
  ]);
};
