import type { IConnectionPublic } from '@shared/types/connections';
import type { ConnectionPresentation, IConnectionsGroupPerProject, IWorkspaceStore } from './types';

let previousProjects: IWorkspaceStore['projects'];
let previousConnections: IWorkspaceStore['connections'];
let grouped: IConnectionsGroupPerProject[];

// Keep derived snapshots stable until their source lists change.
export const selectConnectionsGroupPerProject = ({ projects, connections }: IWorkspaceStore) => {
  if (projects === previousProjects && connections === previousConnections) return grouped;

  const groupedConnections = new Map<string, IConnectionPublic[]>();
  connections.forEach((connection) => {
    const group = groupedConnections.get(connection.id_project) || [];
    group.push(connection);
    groupedConnections.set(connection.id_project, group);
  });

  grouped = projects.map((project) => ({
    ...project,
    connections: (groupedConnections.get(project.id) || [])
      .sort((a, b) => a.description.localeCompare(b.description)),
  })).sort((a, b) => a.description.localeCompare(b.description));

  previousProjects = projects;
  previousConnections = connections;
  return grouped;
};

let previousPresentationConnections: IWorkspaceStore['connections'];
let previousPresentationCatalog: IWorkspaceStore['dialectCatalog'];
let previousPresentationInfo: IWorkspaceStore['connectionsInfo'];
let connectionPresentations: Map<string, ConnectionPresentation>;

// Capabilities describe loaded metadata when present; mode describes saved config.
export const selectConnectionPresentations = ({
  connections, dialectCatalog, connectionsInfo,
}: IWorkspaceStore) => {
  if (
    connectionPresentations &&
    connections === previousPresentationConnections &&
    dialectCatalog === previousPresentationCatalog &&
    connectionsInfo === previousPresentationInfo
  ) return connectionPresentations;

  const catalogByDialect = new Map(
    dialectCatalog.status === 'ready'
      ? dialectCatalog.items.map((item) => [item.id, item] as const)
      : [],
  );
  const next = new Map<string, ConnectionPresentation>();
  for (const connection of connections) {
    const descriptor = catalogByDialect.get(connection.dialect);
    const info = connectionsInfo.get(connection.id);
    next.set(connection.id, {
      dialect: info?.dialect || connection.dialect,
      structure: info || descriptor,
      mode: descriptor?.mode,
      capabilities: info || descriptor,
    });
  }

  previousPresentationConnections = connections;
  previousPresentationCatalog = dialectCatalog;
  previousPresentationInfo = connectionsInfo;
  connectionPresentations = next;
  return next;
};

let previousProcessPresentations: Map<string, ConnectionPresentation>;
let processListSupport: Map<string, boolean | undefined>;

export const selectProcessListSupportByConnection = (state: IWorkspaceStore) => {
  const presentations = selectConnectionPresentations(state);
  if (processListSupport && presentations === previousProcessPresentations) return processListSupport;

  const next = new Map<string, boolean | undefined>();
  for (const [id, { capabilities }] of presentations) {
    next.set(id, capabilities?.supports_process_list);
  }

  previousProcessPresentations = presentations;
  processListSupport = next;
  return next;
};
