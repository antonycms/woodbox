export interface ISshConnectionConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey' | 'agent';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  agentPath?: string;
}

export interface ISshConnectionPublic extends Omit<ISshConnectionConfig, 'password' | 'passphrase'> {
  hasPassword: boolean;
  hasPassphrase: boolean;
}
