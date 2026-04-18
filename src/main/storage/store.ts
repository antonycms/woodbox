import Store from 'electron-store';
import { initialValue as projects, getModule as getModuleProjects } from './modules/projects';
import {
  initialValue as saved_connections,
  getModule as getModuleSavedConnections,
} from './modules/saved_connections';
import { initialValue as scripts_meta, getModule as getModuleScripts } from './modules/scripts';

type WindowState = { width: number; height: number; x: number; y: number; isMaximized: boolean };

const store = new Store({
  schema: {
    projects,
    saved_connections,
    scripts_meta,
    window_state: {
      type: ['object', 'null'],
      default: null,
    },
  },
});

export const getWindowState = (): WindowState | null =>
  (store.get('window_state') as WindowState | null) ?? null;

export const saveWindowState = (state: WindowState): void => {
  store.set('window_state', state);
};

export const {
  add: addProject,
  get: getProjects,
  remove: removeProject,
  edit: editProject,
} = getModuleProjects(store);

export const getDialects = (): Dialect[] => {
  const dialects: Dialect[] = ['postgres'];

  return [...new Set<Dialect>(dialects)];
};

export const {
  add: addConnectionSaved,
  get: getConnectionsSaved,
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
