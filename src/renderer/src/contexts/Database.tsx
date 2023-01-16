import React from 'react';
import { generateHash } from '@renderer/utils/methods';

const DatabaseContext = React.createContext<IDatabaseContext>({} as any);

const DatabaseContextProvider = ({ children }) => {
  const [connections, setConnections] = React.useState<IDatabaseConnection[]>([]);
  const [savedConnections, setSavedConnections] = React.useState<IConnectionConfig[]>([]);

  const saveConnection = (connectionConfig: IConnectionConfigCreate) => {
    const id = generateHash();

    setSavedConnections((prevState) => [...prevState, { ...connectionConfig, id }]);
  };

  const removeConnection = (connectionConfigID: string) => {
    setSavedConnections((prevState) =>
      prevState.filter((config) => config.id !== connectionConfigID),
    );
  };

  const openConnection = async (connectionConfig: IConnectionConfig) => {
    return true;
  };

  const closeConnection = async (connection: IDatabaseConnection) => {
    setConnections((prevState) =>
      prevState.filter((connection) => connection.id !== connection.id),
    );
    //
  };

  const refresh = async (connection: IDatabaseConnection) => {
    //
  };

  return (
    <DatabaseContext.Provider
      value={{
        savedConnections,
        connections,
        saveConnection,
        removeConnection,
        openConnection,
        closeConnection,
        refresh,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabaseContext = () => {
  return React.useContext(DatabaseContext);
};

export default DatabaseContextProvider;

export interface ITable {
  name: string;
  schema?: string;
}

export interface ISchema {
  name: string;
}

export interface IDatabaseConnection {
  id: string;
  id_saved_connection: string;
  dialect: string;
  schemas?: ISchema[];
  tables: ITable[];
}

export interface IConnectionConfigCreate {
  name: string;
  project: string;
  dialect: string;
  database: string;
  host: string;
  port: number;
  user?: string;
  password?: string;
}

export interface IConnectionConfig extends IConnectionConfigCreate {
  id: string;
}

export interface IDatabaseContext {
  connections: IDatabaseConnection[];
  savedConnections: IConnectionConfig[];
  saveConnection(connectionConfig: IConnectionConfig): Promise<void> | void;
  removeConnection(connectionConfigID: string): Promise<void> | void;
  openConnection(connectionConfig: IConnectionConfig): Promise<boolean>;
  closeConnection(connection: IDatabaseConnection): Promise<void>;
  refresh(connection: IDatabaseConnection): Promise<void>;
}
