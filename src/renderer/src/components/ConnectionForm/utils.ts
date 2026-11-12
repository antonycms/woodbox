import type { IConnectionTestInput } from '@shared/types/connections';
import type { IDatabaseDialectInfo } from '@shared/types/database';

export const getInitialConnectionFormData = (dialect: IDatabaseDialectInfo): IConnectionTestInput => ({
  dialect: dialect.id,
  environment: 'development',
  description: '',
  host: '',
  port: dialect.defaultPort || '',
  database: '',
  username: '',
  password: '',
  ssl: false,
  sslRejectUnauthorized: false,
  sslCaCert: '',
  sslCert: '',
  sslKey: '',
  reactNativeBridge: undefined,
});

export const applyConnectionDialectChange = (
  data: IConnectionTestInput,
  dialect: IDatabaseDialectInfo,
): IConnectionTestInput => ({
  ...data,
  dialect: dialect.id,
  host: dialect.mode === 'file' ? '' : data.host,
  port: dialect.mode === 'file' ? '' : dialect.defaultPort || data.port,
  ssl: dialect.supportsSsl ? data.ssl : false,
  sslRejectUnauthorized: dialect.supportsSsl ? data.sslRejectUnauthorized : false,
  sslCaCert: dialect.supportsSsl ? data.sslCaCert : '',
  sslCert: dialect.supportsSsl ? data.sslCert : '',
  sslKey: dialect.supportsSsl ? data.sslKey : '',
  ssh: dialect.mode === 'network' ? data.ssh : undefined,
});
