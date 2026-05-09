import React from 'react';
import { generateHash } from '@renderer/utils/string';
import call from '@renderer/utils/call';
import StoreContext, {
  type IProject,
  type IConnection,
  type IScript,
  type IConnectionInfo,
  type IConnectionsGroupPerProject,
  type IOptionsRunSql,
  type IParamsGetTableData,
  type IConnectionCreate,
  type IProjectCreate,
} from './context';

export type * from './context';

const StoreContextProvider = ({ children }) => {
  const [projects, setProjects] = React.useState<IProject[]>([]);
  const [connectionTypes, setConnectionTypes] = React.useState<string[]>([]);
  const [connections, setConnections] = React.useState<IConnection[]>([]);
  const [connectionsInfo, setConnectionsInfo] = React.useState(new Map<string, IConnectionInfo>());
  const [scripts, setScripts] = React.useState<IScript[]>([]);

  const connectionsGroupPerProject = React.useMemo<IConnectionsGroupPerProject[]>(() => {
    const groupedConnections = connections.reduce((acm, connection) => {
      const group = acm[connection.id_project] || [];

      return { ...acm, [connection.id_project]: [...group, connection] };
    }, {} as { [key: string]: IConnection[] });

    const projectsWithConnections = projects.map((project) => ({
      ...project,
      connections: (groupedConnections[project.id] || []).sort((a, b) =>
        a.description.localeCompare(b.description),
      ),
    }));

    projectsWithConnections.sort((a, b) => a.description.localeCompare(b.description));

    return projectsWithConnections;
  }, [connections, projects]);

  const loadConnectionTypes = async () => {
    const storedConnections = await call('@get:dialects');

    setConnectionTypes(storedConnections || []);
  };

  const loadConnections = async () => {
    const storedConnections = await call('@get:config_connections_saved');

    setConnections(storedConnections || []);
  };

  const loadProjects = async () => {
    const storedProjects = await call('@get:projects');

    setProjects(storedProjects || []);
  };

  const loadScripts = async () => {
    const meta: IScript[] = await call('@get:scripts_meta');
    setScripts(meta || []);
  };

  const getScriptContent = async (id: string) => {
    return (await call('@get:script_content', id)) ?? '';
  };

  const addScript = async (data: Omit<IScript, 'id'>) => {
    const script: IScript = { ...data, id: generateHash() };

    await call('@add:scripts', script);

    setScripts((prev) => [...prev, script]);

    return script;
  };

  const editScript = async (id: string, data: Partial<IScript>) => {
    await call('@patch:scripts', id, data);

    const metaChanges = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== 'content'),
    ) as Partial<IScript>;

    if (Object.keys(metaChanges).length) {
      setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...metaChanges } : s)));
    }
  };

  const removeScript = async (id: string) => {
    await call('@remove:scripts', id);
    setScripts((prev) => prev.filter((s) => s.id !== id));
  };

  const addProject = async (data: IProjectCreate) => {
    const project = { ...data, id: generateHash() };

    await call('@add:projects', project);

    setProjects((prevState) => [...prevState, project]);
  };

  const editProject = async (id: string, data: IProjectCreate) => {
    const project = { ...data, id };

    await call('@edit:projects', id, project);

    setProjects((prevState) => {
      const newState = [...prevState];
      const index = newState.findIndex((project) => project.id === id);

      newState[index] = project;

      return newState;
    });
  };

  const removeProject = async (id: string) => {
    await call('@remove:projects', id);

    setProjects((prevState) => prevState.filter((project) => project.id !== id));
  };

  const addConnection = async (data: IConnectionCreate) => {
    const connection = { ...data, id: generateHash() };

    await call('@add:config_connections_saved', connection);

    setConnections((prevState) => [...prevState, connection]);
  };

  const editConnection = async (id: string, data: IConnectionCreate) => {
    const connection = { ...data, id };

    await call('@edit:config_connections_saved', id, connection);

    setConnections((prevState) => {
      const newState = [...prevState];
      const index = newState.findIndex((item) => item.id === id);

      const prevIdProject = newState[index]?.id_project;

      connection.id_project = connection.id_project || prevIdProject;
      newState[index] = connection;

      return newState;
    });
  };

  const removeConnection = async (id: string) => {
    await call('@remove:config_connections_saved', id);

    setConnections((prevState) => prevState.filter((connection) => connection.id !== id));
  };

  const testConnection = async (data: IConnectionCreate) => {
    return await call('@get:test_connection', data);
  };

  const loadConnectionInfo = async (id: string) => {
    const connectionInfo = await call('@get:connection_info', id);

    setConnectionsInfo((prevState) => {
      const newState = new Map(prevState);

      if (!connectionInfo) {
        newState.delete(id);
      } else {
        newState.set(id, connectionInfo);
      }

      return newState;
    });
  };

  const closeConnection = async (id: string) => {
    await call('@get:close_connection', id);

    setConnectionsInfo((prevState) => {
      const newState = new Map(prevState);

      newState.delete(id);

      return newState;
    });
  };

  const getTableColumns = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_columns', idConnection, { table, schema });
  };

  const getColumnTypes = async (idConnection: string) => {
    return await call('@get:column_types', idConnection);
  };

  const getTableReferences = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_references', idConnection, { table, schema });
  };

  const getTableUsedAsReference = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_used_as_reference', idConnection, { table, schema });
  };

  const getTableRestrictions = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_restrictions', idConnection, { table, schema });
  };

  const getTableDefinition = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_definition', idConnection, { table, schema });
  };

  const getFunctionDefinition = async (
    idConnection: string,
    { schema, functionName }: { schema: string; functionName: string },
  ) => {
    return await call('@get:function_definition', idConnection, { schema, functionName });
  };

  const getTableIndexes = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_indexes', idConnection, { table, schema });
  };

  const getTableTriggers = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_triggers', idConnection, { table, schema });
  };

  const getTableData = async (idConnection: string, params: IParamsGetTableData) => {
    const { table, schema, page = 1, limit = 200, where, orderBy } = params;

    return await call('@get:table_data', idConnection, {
      table,
      schema,
      page,
      limit,
      where,
      orderBy,
    });
  };

  const runSql = async (idConnection: string, sql: string, options?: IOptionsRunSql) => {
    return await call('@post:run_sql', idConnection, sql, options);
  };

  React.useEffect(() => {
    loadConnectionTypes();
    loadConnections();
    loadProjects();
    loadScripts();
  }, []);

  return (
    <StoreContext.Provider
      value={{
        // projects
        projects,
        addProject,
        removeProject,
        editProject,

        // connection
        connections,
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

        getTableColumns,
        getColumnTypes,
        getTableReferences,
        getTableUsedAsReference,
        getTableRestrictions,
        getTableDefinition,
        getTableIndexes,
        getTableTriggers,
        getFunctionDefinition,
        runSql,

        // scripts
        scripts,
        addScript,
        editScript,
        removeScript,
        getScriptContent,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = () => {
  return React.useContext(StoreContext);
};

export default StoreContextProvider;
