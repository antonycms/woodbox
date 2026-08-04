import React from 'react';
import { generateHash } from '@renderer/utils/string';
import call from '@renderer/utils/call';
import StoreContext, {
  type IProject,
  type IConnection,
  type IScript,
  type ISnippet,
  type IConnectionInfo,
  type IConnectionsGroupPerProject,
  type IOptionsRunSql,
  type IParamsGetTableData,
  type IConnectionCreate,
  type IProjectCreate,
  type IStoreContext,
  type IDataTable,
  type IColumnInfo,
  type IColumnReferenceInfo,
  type IColumnRestrictionsInfo,
  type IIndexInfo,
  type ITriggerInfo,
  type IServerOutputMessage,
  type IImportConnectionsParams,
  type IImportConnectionsPreview,
  type IImportConnectionsResult,
  type IImportTableDataParams,
  type IImportTableDataResult,
} from './context';

export type * from './context';

type TableFilters = { table: string; schema: string };
type RunSqlResult = Awaited<ReturnType<IStoreContext['runSql']>>;

const StoreContextProvider = ({ children }: React.PropsWithChildren) => {
  const [projects, setProjects] = React.useState<IProject[]>([]);
  const [connectionTypes, setConnectionTypes] = React.useState<string[]>([]);
  const [connections, setConnections] = React.useState<IConnection[]>([]);
  const [connectionsInfo, setConnectionsInfo] = React.useState(new Map<string, IConnectionInfo>());
  const [scripts, setScripts] = React.useState<IScript[]>([]);
  const [snippets, setSnippets] = React.useState<ISnippet[]>([]);

  const connectionsGroupPerProject = React.useMemo<IConnectionsGroupPerProject[]>(() => {
    const groupedConnections = new Map<string, IConnection[]>();

    connections.forEach((connection) => {
      const group = groupedConnections.get(connection.id_project) || [];
      group.push(connection);
      groupedConnections.set(connection.id_project, group);
    });

    const projectsWithConnections = projects.map((project) => ({
      ...project,
      connections: (groupedConnections.get(project.id) || []).sort((a, b) =>
        a.description.localeCompare(b.description),
      ),
    }));

    projectsWithConnections.sort((a, b) => a.description.localeCompare(b.description));

    return projectsWithConnections;
  }, [connections, projects]);

  const loadConnectionTypes = React.useCallback(async () => {
    const storedConnections = await call<string[]>('@get:dialects');

    setConnectionTypes(storedConnections || []);
  }, []);

  const loadConnections = React.useCallback(async () => {
    const storedConnections = await call<IConnection[]>('@get:config_connections_saved');

    setConnections(storedConnections || []);
  }, []);

  const loadProjects = React.useCallback(async () => {
    const storedProjects = await call<IProject[]>('@get:projects');

    setProjects(storedProjects || []);
  }, []);

  const loadScripts = React.useCallback(async () => {
    const meta = await call<IScript[]>('@get:scripts_meta');
    setScripts(meta || []);
  }, []);

  const loadSnippets = React.useCallback(async () => {
    const storedSnippets = await call<ISnippet[]>('@get:snippets');
    setSnippets(storedSnippets || []);
  }, []);

  const getScriptContent = React.useCallback(async (id: string) => {
    return (await call<string>('@get:script_content', id)) ?? '';
  }, []);

  const addScript = React.useCallback(async (data: Omit<IScript, 'id'>) => {
    const script: IScript = { ...data, id: generateHash() };

    await call<void>('@add:scripts', script);

    setScripts((prev) => [...prev, script]);

    return script;
  }, []);

  const editScript = React.useCallback(async (id: string, data: Partial<IScript>) => {
    await call<void>('@patch:scripts', id, data);

    const metaChanges = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== 'content'),
    ) as Partial<IScript>;

    if (Object.keys(metaChanges).length) {
      setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...metaChanges } : s)));
    }
  }, []);

  const removeScript = React.useCallback(async (id: string) => {
    await call<void>('@remove:scripts', id);
    setScripts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addSnippet = React.useCallback(async (data: Omit<ISnippet, 'id'>) => {
    const snippet: ISnippet = { ...data, id: generateHash() };

    await call<void>('@add:snippets', snippet);
    setSnippets((prev) => [...prev, snippet]);

    return snippet;
  }, []);

  const editSnippet = React.useCallback(async (id: string, data: Omit<ISnippet, 'id'>) => {
    const snippet: ISnippet = { ...data, id };

    await call<void>('@edit:snippets', id, snippet);
    setSnippets((prev) => prev.map((item) => (item.id === id ? snippet : item)));
  }, []);

  const removeSnippet = React.useCallback(async (id: string) => {
    await call<void>('@remove:snippets', id);
    setSnippets((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addProject = React.useCallback(async (data: IProjectCreate) => {
    const project = { ...data, id: generateHash() };

    await call<void>('@add:projects', project);

    setProjects((prevState) => [...prevState, project]);
  }, []);

  const editProject = React.useCallback(async (id: string, data: IProjectCreate) => {
    const project = { ...data, id };

    await call<void>('@edit:projects', id, project);

    setProjects((prevState) => {
      const newState = [...prevState];
      const index = newState.findIndex((project) => project.id === id);

      newState[index] = project;

      return newState;
    });
  }, []);

  const removeConnectionsInfo = React.useCallback((connectionIds: string[]) => {
    if (!connectionIds.length) return;

    setConnectionsInfo((prevState) => {
      const newState = new Map(prevState);

      connectionIds.forEach((connectionId) => newState.delete(connectionId));

      return newState;
    });
  }, []);

  const removeProject = React.useCallback(async (id: string) => {
    const connectionIds = connections
      .filter((connection) => connection.id_project === id)
      .map((connection) => connection.id);

    await Promise.all([
      call<void>('@remove:projects', id),
      ...connectionIds.map((connectionId) =>
        call<void>('@remove:config_connections_saved', connectionId),
      ),
      ...connectionIds.map((connectionId) => call<void>('@get:close_connection', connectionId)),
    ]);

    setProjects((prevState) => prevState.filter((project) => project.id !== id));
    setConnections((prevState) => prevState.filter((connection) => connection.id_project !== id));
    removeConnectionsInfo(connectionIds);
  }, [connections, removeConnectionsInfo]);

  const addConnection = React.useCallback(async (data: IConnectionCreate) => {
    const connection = { ...data, id: generateHash() };

    await call<void>('@add:config_connections_saved', connection);

    setConnections((prevState) => [...prevState, connection]);
  }, []);

  const editConnection = React.useCallback(async (id: string, data: IConnectionCreate) => {
    const connection = { ...data, id };

    await call<void>('@edit:config_connections_saved', id, connection);

    setConnections((prevState) => {
      const newState = [...prevState];
      const index = newState.findIndex((item) => item.id === id);

      const prevIdProject = newState[index]?.id_project;

      connection.id_project = connection.id_project || prevIdProject;
      newState[index] = connection;

      return newState;
    });
  }, []);

  const removeConnection = React.useCallback(async (id: string) => {
    await Promise.all([
      call<void>('@remove:config_connections_saved', id),
      call<void>('@get:close_connection', id),
    ]);

    setConnections((prevState) => prevState.filter((connection) => connection.id !== id));
    removeConnectionsInfo([id]);
  }, [removeConnectionsInfo]);

  const previewImportConnectionsFromSource = React.useCallback(
    async (params: IImportConnectionsParams) => {
      return await call<IImportConnectionsPreview>(
        '@post:preview_import_connections_from_source',
        params,
      );
    },
    [],
  );

  const importConnectionsFromSource = React.useCallback(async (params: IImportConnectionsParams) => {
    const result = await call<IImportConnectionsResult>(
      '@post:import_connections_from_source',
      params,
    );

    await Promise.all([loadProjects(), loadConnections()]);

    return result;
  }, [loadConnections, loadProjects]);

  const testConnection = React.useCallback(async (data: IConnectionCreate) => {
    return await call<boolean>('@get:test_connection', data);
  }, []);

  const loadConnectionInfo = React.useCallback(async (id: string) => {
    const connectionInfo = await call<IConnectionInfo | null>('@get:connection_info', id);

    setConnectionsInfo((prevState) => {
      const newState = new Map(prevState);

      if (!connectionInfo) {
        newState.delete(id);
      } else {
        newState.set(id, connectionInfo);
      }

      return newState;
    });
  }, []);

  const closeConnection = React.useCallback(async (id: string) => {
    await call<void>('@get:close_connection', id);
    removeConnectionsInfo([id]);
  }, [removeConnectionsInfo]);

  const getTableColumns = React.useCallback(
    async (idConnection: string, { table, schema }: TableFilters) => {
      return await call<IColumnInfo[]>('@get:table_columns', idConnection, { table, schema });
    },
    [],
  );

  const getColumnTypes = React.useCallback(async (idConnection: string) => {
    return await call<{ name: string }[]>('@get:column_types', idConnection);
  }, []);

  const getTableReferences = React.useCallback(
    async (idConnection: string, { table, schema }: TableFilters) => {
      return await call<IColumnReferenceInfo[]>('@get:table_references', idConnection, {
        table,
        schema,
      });
    },
    [],
  );

  const getTableUsedAsReference = React.useCallback(
    async (idConnection: string, { table, schema }: TableFilters) => {
      return await call<IColumnReferenceInfo[]>('@get:table_used_as_reference', idConnection, {
        table,
        schema,
      });
    },
    [],
  );

  const getTableRestrictions = React.useCallback(
    async (idConnection: string, { table, schema }: TableFilters) => {
      return await call<IColumnRestrictionsInfo[]>('@get:table_restrictions', idConnection, {
        table,
        schema,
      });
    },
    [],
  );

  const getTableDefinition = React.useCallback(
    async (idConnection: string, { table, schema }: TableFilters) => {
      return await call<{ definition: string }[]>('@get:table_definition', idConnection, {
        table,
        schema,
      });
    },
    [],
  );

  const getFunctionDefinition = React.useCallback(
    async (
      idConnection: string,
      { schema, functionName }: { schema: string; functionName: string },
    ) => {
      return await call<{ definition: string }[]>('@get:function_definition', idConnection, {
        schema,
        functionName,
      });
    },
    [],
  );

  const getTableIndexes = React.useCallback(
    async (idConnection: string, { table, schema }: TableFilters) => {
      return await call<IIndexInfo[]>('@get:table_indexes', idConnection, { table, schema });
    },
    [],
  );

  const getTableTriggers = React.useCallback(
    async (idConnection: string, { table, schema }: TableFilters) => {
      return await call<ITriggerInfo[]>('@get:table_triggers', idConnection, { table, schema });
    },
    [],
  );

  const getTableData = React.useCallback(
    async (idConnection: string, params: IParamsGetTableData) => {
      const { table, schema, page = 1, limit = 200, where, orderBy } = params;

      return await call<IDataTable>('@get:table_data', idConnection, {
        table,
        schema,
        page,
        limit,
        where,
        orderBy,
      });
    },
    [],
  );

  const getTableRowsCount = React.useCallback(
    async (
      idConnection: string,
      params: Omit<IParamsGetTableData, 'page' | 'limit' | 'orderBy'>,
    ) => {
      return await call<number>('@get:table_rows_count', idConnection, params);
    },
    [],
  );

  const getQueryRowsCount = React.useCallback(async (idConnection: string, sql: string) => {
    return await call<number>('@get:query_rows_count', idConnection, sql);
  }, []);

  const getServerOutput = React.useCallback(async (idConnection: string) => {
    return await call<IServerOutputMessage[]>('@get:server_output', idConnection);
  }, []);

  const clearServerOutput = React.useCallback(async (idConnection: string) => {
    await call<void>('@delete:server_output', idConnection);
  }, []);

  const runSql = React.useCallback(
    async (idConnection: string, sql: string, options?: IOptionsRunSql) => {
      return await call<RunSqlResult>('@post:run_sql', idConnection, sql, options);
    },
    [],
  );

  const importTableData = React.useCallback(
    async (idConnection: string, params: IImportTableDataParams) => {
      return await call<IImportTableDataResult>('@post:import_table_data', idConnection, params);
    },
    [],
  );

  const cancelRunSql = React.useCallback(
    async (idConnection: string, queryExecutionId: string) => {
      return await call<boolean>('@post:cancel_run_sql', idConnection, queryExecutionId);
    },
    [],
  );

  const contextValue = React.useMemo<IStoreContext>(
    () => ({
      // projects
      projects,
      addProject,
      removeProject,
      editProject,

      // connection
      connections,
      previewImportConnectionsFromSource,
      importConnectionsFromSource,
      addConnection,
      removeConnection,
      editConnection,

      connectionTypes,

      connectionsGroupPerProject,
      connectionsInfo,

      testConnection,
      loadConnectionInfo,
      closeConnection,
      getTableData,
      getTableRowsCount,
      getQueryRowsCount,

      getTableColumns,
      getColumnTypes,
      getTableReferences,
      getTableUsedAsReference,
      getTableRestrictions,
      getTableDefinition,
      getTableIndexes,
      getTableTriggers,
      getFunctionDefinition,
      getServerOutput,
      clearServerOutput,
      runSql,
      importTableData,
      cancelRunSql,

      // scripts
      scripts,
      addScript,
      editScript,
      removeScript,
      getScriptContent,

      // snippets
      snippets,
      addSnippet,
      editSnippet,
      removeSnippet,
    }),
    [
      addConnection,
      addProject,
      addScript,
      addSnippet,
      cancelRunSql,
      clearServerOutput,
      closeConnection,
      connectionTypes,
      connections,
      connectionsGroupPerProject,
      connectionsInfo,
      editConnection,
      editProject,
      editScript,
      editSnippet,
      getColumnTypes,
      getFunctionDefinition,
      getQueryRowsCount,
      getScriptContent,
      getServerOutput,
      getTableColumns,
      getTableData,
      getTableDefinition,
      getTableIndexes,
      getTableReferences,
      getTableRestrictions,
      getTableRowsCount,
      getTableTriggers,
      getTableUsedAsReference,
      importConnectionsFromSource,
      importTableData,
      loadConnectionInfo,
      previewImportConnectionsFromSource,
      projects,
      removeConnection,
      removeProject,
      removeScript,
      removeSnippet,
      runSql,
      scripts,
      snippets,
      testConnection,
    ],
  );

  React.useEffect(() => {
    loadConnectionTypes();
    loadConnections();
    loadProjects();
    loadScripts();
    loadSnippets();
  }, [loadConnectionTypes, loadConnections, loadProjects, loadScripts, loadSnippets]);

  return <StoreContext.Provider value={contextValue}>{children}</StoreContext.Provider>;
};

export const useStoreContext = () => {
  return React.useContext(StoreContext);
};

export default StoreContextProvider;
