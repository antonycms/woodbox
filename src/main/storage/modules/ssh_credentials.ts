import type { ISshConnectionConfig } from '../../../preload/ssh';

export const mergeSshCredentials = (
  ssh?: ISshConnectionConfig,
  previous?: ISshConnectionConfig,
): ISshConnectionConfig | undefined => {
  if (!ssh) return undefined;

  const sameIdentity = previous && ssh.host === previous.host && ssh.port === previous.port &&
    ssh.username === previous.username && ssh.authMethod === previous.authMethod;

  return {
    enabled: !!ssh.enabled,
    host: ssh.host,
    port: ssh.port,
    username: ssh.username,
    authMethod: ssh.authMethod,
    privateKeyPath: ssh.authMethod === 'privateKey' ? ssh.privateKeyPath : undefined,
    agentPath: ssh.authMethod === 'agent' ? ssh.agentPath : undefined,
    password: ssh.authMethod === 'password'
      ? ssh.password || (sameIdentity ? previous.password : undefined)
      : undefined,
    passphrase: ssh.authMethod === 'privateKey'
      ? ssh.passphrase ?? (sameIdentity && ssh.privateKeyPath === previous.privateKeyPath
        ? previous.passphrase : undefined)
      : undefined,
  };
};
