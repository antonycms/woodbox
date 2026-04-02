import React from 'react';
import { generateHash } from '@renderer/utils/string';
import call from '../utils/call';

const StoreContext = React.createContext<IStoreContext>({} as IStoreContext);

const StoreContextProvider = ({ children }) => {
  const [projects, setProjects] = React.useState<IProject[]>([]);
  const [connectionTypes, setConnectionTypes] = React.useState<string[]>([]);
  const [connections, setConnections] = React.useState<IConnection[]>([]);
  const [connectionsInfo, setConnectionsInfo] = React.useState(new Map<string, IConnectionInfo>());

  const connectionsGroupPerProject = React.useMemo<IConnectionsGroupPerProject[]>(() => {
    const groupedConnections = connections.reduce((acm, connection) => {
      const group = acm[connection.id_project] || [];

      return { ...acm, [connection.id_project]: [...group, connection] };
    }, {});

    const projectsWithConnections = projects.map((project) => ({
      ...project,
      connections: groupedConnections[project.id] || [],
    }));

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

  const getTableColumns = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_columns', idConnection, { table, schema });
  };

  const getTableReferences = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_references', idConnection, { table, schema });
  };

  const getTableRestrictions = async (idConnection: string, { table, schema }) => {
    return await call('@get:table_restrictions', idConnection, { table, schema });
  };

  const getTableData = async (idConnection: string, params: IParamsGetTableData) => {
    const { table, schema, page = 1, limit = 200 } = params;

    return await call('@get:table_data', idConnection, { table, schema, page, limit });
  };

  const runSql = async (idConnection: string, sql: string) => {
    return await call('@post:run_sql', idConnection, sql);
  };

  React.useEffect(() => {
    loadConnectionTypes();
    loadConnections();
    loadProjects();
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
        getTableData,

        getTableColumns,
        getTableReferences,
        getTableRestrictions,
        runSql,
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

export interface IProjectCreate {
  description: string;
}

export interface IProject extends IProjectCreate {
  id: string;
}

interface ITable {
  table_name: string;
  table_schema?: string;
}

interface IConnectionInfo {
  tables: ITable[];
  schemas?: string[];
}

export interface IConnectionCreate {
  id_project: string;
  description: string;
  dialect: string;
  database: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface IConnection extends IConnectionCreate {
  id: string;
}

export interface IColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
}

export interface IColumnReferenceInfo {
  constraint_name: string;
  table_schema: string;
  table_name: string;
  column_name: string;
  reference_table_schema: string;
  reference_table_name: string;
  reference_column_name: string;
}

export type ConstraintType = 'primary_key' | 'unique_key' | 'check';

export interface IColumnRestrictionsInfo {
  constraint_name: string;
  constraint_type: ConstraintType;
}

export interface IDataTable {
  count: number;
  data: any[];
}

interface IParamsGetTableData {
  table: string;
  schema?: string;
  page: number;
  limit: number;
}

export interface IStoreContext {
  connections: IConnection[];
  addConnection(data: IConnectionCreate): Promise<void>;
  removeConnection(id: string): Promise<void>;
  editConnection(id: string, data: IConnectionCreate): Promise<void>;

  projects: IProject[];
  addProject(data: IProjectCreate): Promise<void>;
  removeProject(id: string): Promise<void>;
  editProject(id: string, data: IProjectCreate): Promise<void>;

  connectionsGroupPerProject: IConnectionsGroupPerProject[];

  connectionTypes?: string[];
  connectionsInfo: Map<string, IConnectionInfo>;

  loadConnectionInfo(id: string): Promise<void>;
  testConnection(data: IConnectionCreate): Promise<boolean>;
  getTableData(idConnection: string, params: IParamsGetTableData): Promise<IDataTable>;

  getTableColumns(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IColumnInfo[]>;

  getTableReferences(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IColumnReferenceInfo[]>;

  getTableRestrictions(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IColumnRestrictionsInfo[]>;

  runSql(
    idConnection: string,
    sql: string,
  ): Promise<
    {
      type: string;
      rows?: any[];
      columns?: string[];
      affected_rows?: number;
    }[]
  >;
}

export interface IConnectionsGroupPerProject extends IProject {
  connections: IConnection[];
}
