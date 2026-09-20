import type { IInputProps } from '@renderer/components/Input';
import type {
  ConnectionEnvironment,
  IReactNativeBridgeConnectionConfig,
  ISshConnectionConfig,
} from '@renderer/contexts/Store';
import type { Dialect } from '@renderer/database/dialects';
import type React from 'react';

export interface IDataNewConnection {
  id?: string;
  id_project?: string;

  description: string;
  dialect: Dialect;
  environment?: ConnectionEnvironment;
  host: string;
  port: string | number;
  database: string;
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

export type RegisteredField<Name extends keyof IDataNewConnection> = Pick<
  IInputProps,
  'onChange'
> & {
  name: Name;
  value: IDataNewConnection[Name];
};

export type RegisterField = <Name extends keyof IDataNewConnection>(
  name: Name,
) => RegisteredField<Name>;

export type SetConnectionFormState = React.Dispatch<React.SetStateAction<IDataNewConnection>>;
