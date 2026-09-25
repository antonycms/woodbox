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

export type IConnectionCreate = Omit<IConnectionConfig, 'id'>;
export type IConnectionTest = Omit<IConnectionConfig, 'id' | 'id_project'> & { id?: string; id_project?: string };
