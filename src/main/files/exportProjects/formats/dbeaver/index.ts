import type { ProjectExportAdapter } from '../../../types';
import { exportDbeaverProjects } from './exporter';

export const dbeaverProjectExportAdapter: ProjectExportAdapter = {
  format: 'dbeaver',
  name: 'Projeto do DBeaver',
  extensions: ['dbp', 'zip'],
  defaultExtension: 'dbp',
  export: exportDbeaverProjects,
};
