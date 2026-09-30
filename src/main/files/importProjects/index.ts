import type { ProjectImportFormat } from '@shared/types/imports';
import { dbeaverProjectImportAdapter } from './formats/dbeaver';
import { woodboxProjectImportAdapter } from './formats/woodbox';
import type { ProjectImportAdapter } from '../types';

const importAdapters = {
  dbeaver: dbeaverProjectImportAdapter,
  woodbox: woodboxProjectImportAdapter,
} satisfies Record<ProjectImportFormat, ProjectImportAdapter>;

export const getProjectImportAdapter = (format: ProjectImportFormat) => {
  const adapter = importAdapters[format];

  if (!adapter) throw new Error('Origem de importação não suportada: ' + format);

  return adapter;
};

export const getProjectImportFormats = () => Object.keys(importAdapters) as ProjectImportFormat[];
