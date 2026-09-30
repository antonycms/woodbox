import fs from 'fs/promises';
import type { ProjectImportAdapter } from '../../../types';
import { parseWoodboxExport } from './parser';

export const woodboxProjectImportAdapter: ProjectImportAdapter = {
  format: 'woodbox',
  name: 'Projeto do Woodbox',
  extensions: ['json'],
  async parse(path) {
    const content = await fs.readFile(path, 'utf8');

    return parseWoodboxExport(content);
  },
};
