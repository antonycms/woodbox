import type { ProjectExportFormat } from '@shared/types/imports';
import { dbeaverProjectExportAdapter } from './formats/dbeaver';
import { woodboxProjectExportAdapter } from './formats/woodbox';
import type { ProjectExportAdapter } from '../types';

const exportAdapters = {
  dbeaver: dbeaverProjectExportAdapter,
  woodbox: woodboxProjectExportAdapter,
} satisfies Record<ProjectExportFormat, ProjectExportAdapter>;

export const getProjectExportAdapter = (format: ProjectExportFormat) => {
  const adapter = exportAdapters[format];

  if (!adapter) throw new Error('Formato de exportação não suportado: ' + format);

  return adapter;
};

export const getProjectExportFormats = () => Object.keys(exportAdapters) as ProjectExportFormat[];
