import type { IConnectionConfig } from '@shared/types/connections';
import type { IExportProjectsParams, IExportProjectsResult } from '@shared/types/imports';
import type { IProject, IScript } from '@shared/types/workspace';
import type Store from 'electron-store';
import { getProjectExportAdapter } from '../../files/exportProjects';
import { decodeConnectionSecrets } from './saved_connections';
import { getScriptContentKey, type IScriptMeta } from './scripts';

type AppStore = Store<Record<string, unknown>>;

const getStoredProjects = (store: AppStore) =>
  (store.get('projects') as IProject[] | undefined) ?? [];

const getStoredConnections = (store: AppStore) =>
  (store.get('saved_connections') as IConnectionConfig[] | undefined) ?? [];

const getStoredScripts = (store: AppStore): IScript[] =>
  ((store.get('scripts_meta') as IScriptMeta[] | undefined) ?? []).map((script) => ({
    ...script,
    content: (store.get(getScriptContentKey(script.id)) as string | undefined) ?? '',
  }));

export const getModule = (store: AppStore) => {
  const execute = async ({
    format,
    path,
    selection,
  }: IExportProjectsParams): Promise<IExportProjectsResult> => {
    const adapter = getProjectExportAdapter(format);
    const projects = getStoredProjects(store);
    const connections = getStoredConnections(store).map((connection) =>
      decodeConnectionSecrets(store, connection),
    );
    const scripts = getStoredScripts(store);

    if (!selection) return adapter.export({ projects, connections, scripts }, path);

    const selectedProjectIds = new Set(selection.projects.map((project) => project.id));
    const selectedConnectionIds = new Set(
      selection.projects.flatMap((project) => project.connections),
    );
    const selectedProjects = projects.filter((project) => selectedProjectIds.has(project.id));
    const selectedConnections = connections.filter(
      (connection) =>
        selectedProjectIds.has(connection.id_project) && selectedConnectionIds.has(connection.id),
    );
    const exportedConnectionIds = new Set(selectedConnections.map((connection) => connection.id));
    const selectedScripts = scripts.filter((script) =>
      exportedConnectionIds.has(script.id_connection),
    );

    return adapter.export(
      { projects: selectedProjects, connections: selectedConnections, scripts: selectedScripts },
      path,
    );
  };

  return { execute };
};
