import type { ProjectExportAdapter } from '../../../types';
import { exportWoodboxProjects } from './exporter';

export const woodboxProjectExportAdapter: ProjectExportAdapter = {
  format: 'woodbox',
  name: 'Projeto do Woodbox',
  extensions: ['json'],
  defaultExtension: 'json',
  export: exportWoodboxProjects,
};
