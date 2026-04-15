import type Store from 'electron-store';

export interface IScript {
  id: string;
  name: string;
  id_connection: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type IScriptMeta = Omit<IScript, 'content'>;

const contentKey = (id: string) => `script_content_${id}`;

export const initialValue = {
  type: 'array',
  default: [] as IScriptMeta[],
} as const;

export const getModule = (store: Store<any>) => {
  const getMeta = (): IScriptMeta[] => {
    return (store.get('scripts_meta') as IScriptMeta[]) || [];
  };

  const getContent = (id: string): string => {
    return (store.get(contentKey(id)) as string) ?? '';
  };

  const add = (script: IScript) => {
    const { content, id, name, id_connection, created_at, updated_at } = script;

    const meta: IScriptMeta = { id, name, id_connection, created_at, updated_at };
    const items = (store.get('scripts_meta') as IScriptMeta[]) || [];

    store.set('scripts_meta', [...items, meta]);
    store.set(contentKey(id), content);
  };

  const remove = (id: string) => {
    const items = (store.get('scripts_meta') as IScriptMeta[]) || [];

    store.set(
      'scripts_meta',
      items.filter((s) => s.id !== id),
    );

    store.delete(contentKey(id) as any);
  };

  const patch = (id: string, data: Partial<IScript>) => {
    const { content, ...metaChanges } = data;

    if (content !== undefined) {
      store.set(contentKey(id), content);
    }

    if (Object.keys(metaChanges).length) {
      const items = (store.get('scripts_meta') as IScriptMeta[]) || [];
      const index = items.findIndex((s) => s.id === id);

      if (index === -1) throw new Error(`Script "${id}" not found in scripts_meta`);

      items[index] = { ...items[index], ...metaChanges };

      store.set('scripts_meta', items);
    }
  };

  return { getMeta, getContent, add, remove, patch };
};
