import fs from 'fs/promises';
import type { ProjectExportResult, ProjectTransferData } from '../../../types';
import {
  encryptWoodboxFile,
  WOODBOX_TRANSFER_FORMAT,
  WOODBOX_TRANSFER_VERSION,
  type WoodboxTransferFile,
} from '../../../utils/woodboxEncryption';

export const exportWoodboxProjects = async (
  data: ProjectTransferData,
  path: string,
): Promise<ProjectExportResult> => {
  const file: WoodboxTransferFile = {
    format: WOODBOX_TRANSFER_FORMAT,
    version: WOODBOX_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    projects: data.projects,
    connections: data.connections,
    scripts: data.scripts ?? [],
  };

  await fs.writeFile(path, encryptWoodboxFile(JSON.stringify(file)), 'utf8');

  return {
    projectsExported: data.projects.length,
    connectionsExported: data.connections.length,
    scriptsExported: data.scripts?.length ?? 0,
    unsupportedConnections: [],
  };
};
