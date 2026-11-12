import type { ISshConnectionConfig, ISshConnectionPublic } from './ssh';
import type { IReactNativeBridgeConnectionConfig } from './reactNativeBridge';

export type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'react-native-sqlite';

export type ConnectionEnvironment = 'development' | 'production';

export interface IConnectionConfig {
  id: string;
  id_project: string;
  description: string;
  dialect: Dialect;
  environment?: ConnectionEnvironment;
  database: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  ssl?: boolean;
  sslRejectUnauthorized?: boolean;
  sslCaCert?: string;
  sslCert?: string;
  sslKey?: string;
  ssh?: ISshConnectionConfig;
  reactNativeBridge?: IReactNativeBridgeConnectionConfig;
}

export interface IConnectionPublic extends Omit<IConnectionConfig, 'password' | 'ssh'> {
  hasPassword: boolean;
  ssh?: ISshConnectionPublic;
}

export type IConnectionTest = Omit<IConnectionConfig, 'id' | 'id_project'> & { id?: string; id_project?: string };

// Inputs can carry the textual port captured by the connection form.
export type IConnectionInput = Omit<IConnectionConfig, 'port'> & { port: string | number };
export type IConnectionCreateInput = Omit<IConnectionInput, 'id'>;
export type IConnectionTestInput = Omit<IConnectionInput, 'id' | 'id_project'> & { id?: string; id_project?: string };
