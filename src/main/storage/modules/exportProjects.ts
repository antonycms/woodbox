import type { IConnectionConfig } from '@shared/types/connections';
import type { IExportProjectsParams, IExportProjectsResult } from '@shared/types/imports';
import type { IProject } from '@shared/types/workspace';
import type Store from 'electron-store';
import { getProjectExportAdapter } from '../../files/exportProjects';
import { decodeConnectionSecrets } from './saved_connections';

type AppStore = Store<Record<string, unknown>>;

const getStoredProjects = (store: AppStore) =>
  (store.get('projects') as IProject[] | undefined) ?? [];

const getStoredConnections = (store: AppStore) =>
  (store.get('saved_connections') as IConnectionConfig[] | undefined) ?? [];

export const getModule = (store: AppStore) => {
  const execute = async ({
    format,
    path,
  }: IExportProjectsParams): Promise<IExportProjectsResult> => {
    const adapter = getProjectExportAdapter(format);
    const projects = getStoredProjects(store);
    const connections = getStoredConnections(store).map((connection) =>
      decodeConnectionSecrets(store, connection),
    );

    return adapter.export({ projects, connections }, path);
  };

  return { execute };
};
