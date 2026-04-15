import Store from 'electron-store';
import { initialValue as projects, getModule as getModuleProjects } from './modules/projects';
import {
  initialValue as saved_connections,
  getModule as getModuleSavedConnections,
} from './modules/saved_connections';
import { initialValue as scripts_meta, getModule as getModuleScripts } from './modules/scripts';

const store = new Store({
  schema: {
    projects,
    saved_connections,
    scripts_meta,
  },
});

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
