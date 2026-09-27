import { create } from 'zustand';
import { generateHash } from '@shared/utils/string';
import type { IConnectionInfo } from '@shared/types/database';
import { runPromiseOnce } from '@renderer/utils/promise';
import type { IWorkspaceStore } from './types';

const withoutConnectionsInfo = (info: Map<string, IConnectionInfo>, ids: string[]) => {
  const next = new Map(info);

  for (const id of ids) next.delete(id)
  
  return next;
};

// Tokens are private: they coordinate requests without notifying subscribers.
const connectionInfoRequests = new Map<string, symbol>();
const pendingConnectionClosures = new Map<string, number>();

const invalidateConnectionInfoWhile = async (ids: string[], operation: () => Promise<unknown>) => {
  for (const id of ids) {
    connectionInfoRequests.delete(id);
    pendingConnectionClosures.set(id, (pendingConnectionClosures.get(id) || 0) + 1);
  }

  try {
    await operation();
  } finally {
    for (const id of ids) {
      const pending = pendingConnectionClosures.get(id) - 1;
      if (pending) pendingConnectionClosures.set(id, pending);
      else pendingConnectionClosures.delete(id);
    }
  }
};

// Track the close itself too: a sibling in Promise.all may reject before it finishes.
const closeConnectionInMain = (id: string) =>
  invalidateConnectionInfoWhile([id], () => window.api.connections.close(id));

export const useWorkspaceStore = create<IWorkspaceStore>()((set, get) => ({
  projects: [],
  scripts: [],
  connections: [],
  connectionTypes: [],
  connectionsInfo: new Map(),

  initialize: runPromiseOnce(async () => {
    await get().refresh();
  }),

  refresh: async () => {
    const [projects, scripts, connections, connectionTypes] = await Promise.all([
      window.api.projects.list(),
      window.api.scripts.list(),
      window.api.connections.list(),
      window.api.database.getDialects(),
    ]);

    set({ projects, scripts, connections, connectionTypes });
  },

  addProject: async (data) => {
    await get().initialize();
    const project = { ...data, id: generateHash() };
    await window.api.projects.add(project);
    set((state) => ({ projects: [...state.projects, project] }));
  },

  editProject: async (id, data) => {
    await get().initialize();
    const project = { ...data, id };
    await window.api.projects.edit(id, project);
    set((state) => ({
      projects: state.projects.map((item) => item.id === id ? project : item),
    }));
  },

  removeProject: async (id) => {
    await get().initialize();
    const connectionIds = get().connections
      .filter((connection) => connection.id_project === id)
      .map((connection) => connection.id);

    const connectionIdsSet = new Set(connectionIds);
    const scriptIds = get().scripts
      .filter((script) => connectionIdsSet.has(script.id_connection))
      .map((script) => script.id);
    const scriptIdsSet = new Set(scriptIds);

    await invalidateConnectionInfoWhile(connectionIds, () => Promise.all([
      window.api.projects.remove(id),
      ...scriptIds.map((scriptId) => window.api.scripts.remove(scriptId)),
      ...connectionIds.map((connectionId) => window.api.connections.remove(connectionId)),
      ...connectionIds.map(closeConnectionInMain),
    ]));

    set((state) => ({
      projects: state.projects.filter((project) => project.id !== id),
      scripts: state.scripts.filter((script) => !scriptIdsSet.has(script.id)),
      connections: state.connections.filter((connection) => connection.id_project !== id),
      connectionsInfo: withoutConnectionsInfo(state.connectionsInfo, connectionIds),
    }));
  },

  getScriptContent: (...args) => window.api.scripts.getContent(...args),

  addScript: async (data) => {
    await get().initialize();
    const script = { ...data, id: generateHash() };
    await window.api.scripts.add(script);
    set((state) => ({ scripts: [...state.scripts, script] }));
    return script;
  },

  editScript: async (id, data) => {
    await get().initialize();
    await window.api.scripts.edit(id, data);
    const { content: _content, ...metaChanges } = data;
    if (Object.keys(metaChanges).length) {
      set((state) => ({
        scripts: state.scripts.map((script) => script.id === id ? { ...script, ...metaChanges } : script),
      }));
    }
  },

  removeScript: async (id) => {
    await get().initialize();
    await window.api.scripts.remove(id);
    set((state) => ({ scripts: state.scripts.filter((script) => script.id !== id) }));
  },

  addConnection: async (data) => {
    await get().initialize();
    const connection = { ...data, id: generateHash() };
    await window.api.connections.add(connection);
    const publicConnection = await window.api.connections.get(connection.id);
    set((state) => ({ connections: [...state.connections, publicConnection] }));
  },

  editConnection: async (id, data) => {
    await get().initialize();
    await window.api.connections.edit(id, data);
    const publicConnection = await window.api.connections.get(id);
    set((state) => ({
      connections: state.connections.map((connection) => connection.id === id ? {
        ...publicConnection,
        id_project: publicConnection.id_project || connection.id_project,
      } : connection),
    }));
  },

  removeConnection: async (id) => {
    await get().initialize();
    await invalidateConnectionInfoWhile([id], () => Promise.all([
      window.api.connections.remove(id),
      closeConnectionInMain(id),
    ]));
    set((state) => ({
      connections: state.connections.filter((connection) => connection.id !== id),
      connectionsInfo: withoutConnectionsInfo(state.connectionsInfo, [id]),
    }));
  },

  previewImportConnectionsFromSource: (...args) => window.api.connections.previewImport(...args),

  importConnectionsFromSource: async (params) => {
    await get().initialize();
    const result = await window.api.connections.import(params);
    const [projects, connections] = await Promise.all([
      window.api.projects.list(), window.api.connections.list(),
    ]);
    set({ projects, connections });
    return result;
  },

  testConnection: (...args) => window.api.connections.test(...args),

  loadConnectionInfo: async (id) => {
    if (pendingConnectionClosures.has(id)) return;

    const request = Symbol();
    connectionInfoRequests.set(id, request);

    try {
      const connectionInfo = await window.api.connections.getInfo(id);
      if (connectionInfoRequests.get(id) !== request) return;

      set((state) => {
        const connectionsInfo = new Map(state.connectionsInfo);
        if (connectionInfo) connectionsInfo.set(id, connectionInfo);
        else connectionsInfo.delete(id);
        return { connectionsInfo };
      });
    } catch (error) {
      if (connectionInfoRequests.get(id) === request) throw error;
    } finally {
      if (connectionInfoRequests.get(id) === request) connectionInfoRequests.delete(id);
    }
  },

  reloadConnectionInfo: async (id) => {
    await closeConnectionInMain(id);
    set((state) => ({ connectionsInfo: withoutConnectionsInfo(state.connectionsInfo, [id]) }));
    await get().loadConnectionInfo(id);
  },

  closeConnection: async (id) => {
    await closeConnectionInMain(id);
    set((state) => ({ connectionsInfo: withoutConnectionsInfo(state.connectionsInfo, [id]) }));
  },
}));
