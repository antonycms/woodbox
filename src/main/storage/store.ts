import Store from 'electron-store';
import { initialValue as projects, getModule as getModuleProjects } from './modules/projects';
import {
  initialValue as saved_connections,
  getModule as getModuleSavedConnections,
} from './modules/saved_connections';

const store = new Store({
  schema: {
    projects,
    saved_connections,
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
