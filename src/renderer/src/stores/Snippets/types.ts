import type { WoodboxApi } from '@shared/types/api';
import type { ISnippet } from '@shared/types/workspace';

export interface ISnippetsStore {
  initialize(): Promise<void>;
  refresh(): Promise<void>;
  snippets: ISnippet[];
  addSnippet(data: Omit<ISnippet, 'id'>): Promise<ISnippet>;
  editSnippet(id: string, data: Omit<ISnippet, 'id'>): Promise<void>;
  removeSnippet: WoodboxApi['snippets']['remove'];
}

