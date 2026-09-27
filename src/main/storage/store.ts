import Store from 'electron-store';
import { initialValue as projects, getModule as getModuleProjects } from './modules/projects';
import {
  initialValue as saved_connections,
  getModule as getModuleSavedConnections,
} from './modules/saved_connections';
import { initialValue as scripts_meta, getModule as getModuleScripts } from './modules/scripts';
import { initialValue as snippets, getModule as getModuleSnippets } from './modules/snippets';
import {
  initialValue as ai_providers,
  getModule as getModuleAIProviders,
} from './modules/ai_providers';
import {
  initialValue as ai_chats,
  getModule as getModuleAIChats,
} from './modules/ai_chats';
import {
  initialValue as ssh_hosts,
  getModule as getModuleSshHosts,
} from './modules/ssh_hosts';
import {
  initialValue as window_state,
  getModule as getModuleWindowState,
} from './modules/window_state';
import {
  initialValue as app_preferences,
  getModule as getModuleAppPreferences,
} from './modules/app_preferences';
import { getModule as getModuleImportConnections } from './modules/import_connections';

const store = new Store<Record<string, unknown>>({
  schema: {
    projects,
    saved_connections,
    scripts_meta,
    snippets,
    ai_providers,
    ai_chats,
    ssh_hosts,
    window_state,
    app_preferences,
  },
});

export const {
  getFingerprint: getSshHostFingerprint,
  saveFingerprint: saveSshHostFingerprint,
} = getModuleSshHosts(store);

export const {
  get: getWindowState,
  save: saveWindowState,
} = getModuleWindowState(store);

export const {
  get: getAppPreferences,
  update: updateAppPreferences,
} = getModuleAppPreferences(store);

export const {
  add: addProject,
  get: getProjects,
  remove: removeProject,
  edit: editProject,
} = getModuleProjects(store);

export const {
  add: addConnectionSaved,
  get: getConnectionsSaved,
  getInternal: getInternalConnectionSaved,
  remove: removeConnectionSaved,
  edit: editConnectionSaved,
} = getModuleSavedConnections(store);

export const {
  add: addScript,
  remove: removeScript,
  getMeta: getScriptsMeta,
  getContent: getScriptContent,
  patch: patchScript,
} = getModuleScripts(store);

export const {
  add: addSnippet,
  get: getSnippets,
  remove: removeSnippet,
  edit: editSnippet,
} = getModuleSnippets(store);

export const {
  add: addAIProvider,
  get: getAIProviders,
  getInternal: getInternalAIProvider,
  remove: removeAIProvider,
  edit: editAIProvider,
} = getModuleAIProviders(store);

export const {
  add: addAIChat,
  get: getAIChats,
  remove: removeAIChat,
  edit: editAIChat,
  appendMessages: appendAIChatMessages,
} = getModuleAIChats(store);

export const {
  preview: previewImportConnectionsFromSource,
  execute: importConnectionsFromSource,
} = getModuleImportConnections(store);
