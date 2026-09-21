export interface IProject {
  id: string;
  description: string;
}

export interface IScript {
  id: string;
  name: string;
  id_connection: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ISnippet {
  id: string;
  name: string;
  scope?: string;
  prefix: string | string[];
  body: string | string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

export type IProjectCreate = Pick<IProject, 'description'>;

// Listings omit content; it is fetched on demand when opening a script.
export type IScriptMetadata = Omit<IScript, 'content'> & { content?: string };
