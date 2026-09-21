import type { IConnectionPublic } from '@shared/types/connections';
import type { IConnectionsGroupPerProject, IWorkspaceStore } from './types';

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
