import { parseDbeaverExport } from './parser';
import type { ProjectImportAdapter } from '../../../types';

export const dbeaverProjectImportAdapter: ProjectImportAdapter = {
  format: 'dbeaver',
  name: 'Export do DBeaver',
  extensions: ['zip', 'dbp'],
  parse: parseDbeaverExport,
};
