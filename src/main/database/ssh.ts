import { readFile } from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import ssh2, { type ClientChannel, type ConnectConfig } from 'ssh2';
import type { ISshConnectionConfig } from '@shared/types/ssh';

export interface SshTunnel {
  host: string;
  port: number;
  isOpen(): boolean;
  getError(): Error | undefined;
  close(): Promise<void>;
}

type VerifyHost = (host: string, port: number, key: Buffer) => Promise<boolean>;
const { Client } = ssh2;

const validPort = (port: number) => Number.isInteger(port) && port > 0 && port <= 65535;

export const resolveSshAgent = (
  agentPath?: string,
  platform = process.platform,
  authSock = process.env.SSH_AUTH_SOCK,
) => {
  const agent = agentPath?.trim() || authSock ||
    (platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined);
  if (!agent) {
    throw new Error('SSH Agent não encontrado. Inicie o agente ou informe o caminho do socket.');
  }
  return agent;
};

export const openSshTunnel = async (
  ssh: ISshConnectionConfig,
  destination: { host: string; port: number },
  verifyHost: VerifyHost,
): Promise<SshTunnel> => {
  const host = ssh.host?.trim();
  if (!host || !ssh.username?.trim() || !validPort(ssh.port)) {
    throw new Error('Informe host, porta válida e usuário do servidor SSH.');
  }
  if (!destination.host?.trim() || !validPort(destination.port)) {
    throw new Error('Informe host e porta válidos do banco de dados no servidor SSH.');
  }

  let authentication: Partial<ConnectConfig>;
  switch (ssh.authMethod) {
    case 'password':
      if (!ssh.password) throw new Error('Informe a senha SSH.');
      authentication = { password: ssh.password };
      break;
    case 'privateKey': {
      if (!ssh.privateKeyPath) throw new Error('Selecione a chave privada SSH.');
      const keyPath = ssh.privateKeyPath.startsWith('~/')
        ? join(homedir(), ssh.privateKeyPath.slice(2)) : ssh.privateKeyPath;
      try {
        authentication = { privateKey: await readFile(keyPath), passphrase: ssh.passphrase };
      } catch {
        throw new Error('Não foi possível ler a chave privada SSH. Verifique o arquivo e suas permissões.');
      }
      break;
    }
    case 'agent':
      authentication = { agent: resolveSshAgent(ssh.agentPath) };
      break;
    default:
      throw new Error('Método de autenticação SSH inválido.');
  }

  const client = new Client();
  const sockets = new Set<Socket>();
  const channels = new Set<ClientChannel>();
  let stopped = false;
  let failure: Error | undefined;
  let closing: Promise<void> | undefined;
  const server = createServer((socket) => {
    if (stopped) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.on('error', () => socket.destroy());
    socket.once('close', () => sockets.delete(socket));
    socket.pause();

    const onForward = (error: Error | undefined, channel: ClientChannel) => {
      if (stopped || socket.destroyed) {
        channel?.destroy();
        return;
      }
      if (error) {
        failure = new Error('O servidor SSH não conseguiu acessar o banco. Verifique host, porta e permissão de encaminhamento.');
        socket.destroy();
        return;
      }
      channels.add(channel);
      channel.on('error', () => socket.destroy());
      channel.once('close', () => {
        channels.delete(channel);
        socket.destroy();
      });
      socket.once('close', () => channel.destroy());
      socket.pipe(channel).pipe(socket);
      socket.resume();
    };
    try {
      client.forwardOut('127.0.0.1', socket.remotePort || 0, destination.host, destination.port, onForward);
    } catch {
      failure = new Error('O túnel SSH não está disponível. Conecte novamente.');
      socket.destroy();
      void close();
    }
  });

  const close = (): Promise<void> => {
    if (closing) return closing;
    stopped = true;
    for (const socket of sockets) socket.destroy();
    for (const channel of channels) channel.destroy();
    client.destroy();
    closing = new Promise<void>((resolve) => server.close(() => resolve()));
    return closing;
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => {
        if (stopped) return;
        failure = error;
        reject(error);
        void close();
      };
      client.on('error', (error: Error & { level?: string }) => fail(
        failure || new Error(error.level === 'client-authentication'
          ? 'Falha na autenticação SSH. Verifique usuário, senha, chave ou as chaves carregadas no agente.'
          : `Falha no túnel SSH: ${error.message}`),
      ));
      client.once('close', () => fail(new Error('O túnel SSH foi encerrado pelo servidor. Conecte novamente.')));
      client.once('ready', resolve);
      server.on('error', (error) => fail(new Error(`Falha na porta local do túnel SSH: ${error.message}`)));
      client.connect({
        host,
        port: ssh.port,
        username: ssh.username,
        ...authentication,
        agentForward: false,
        tryKeyboard: false,
        readyTimeout: 120000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 3,
        hostVerifier: (key: Buffer, callback: (valid: boolean) => void) => {
          void verifyHost(host, ssh.port, key).then((trusted) => {
            if (!trusted) failure = new Error('Identidade do servidor SSH não autorizada.');
            callback(trusted && !stopped);
          }).catch(() => {
            failure = new Error('Não foi possível verificar a identidade do servidor SSH.');
            callback(false);
          });
        },
      });
    });
    if (stopped) throw failure;

    await new Promise<void>((resolve, reject) => {
      const onClose = () => reject(failure || new Error('O túnel SSH foi encerrado.'));
      const onError = (error: Error) => reject(error);
      client.once('close', onClose);
      server.once('error', onError);
      server.listen(0, '127.0.0.1', () => {
        client.removeListener('close', onClose);
        server.removeListener('error', onError);
        resolve();
      });
    });
    if (stopped) throw failure;
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Porta local SSH indisponível.');

    return {
      host: '127.0.0.1',
      port: address.port,
      isOpen: () => !stopped,
      getError: () => failure,
      close,
    };
  } catch (error) {
    await close();
    throw failure || new Error(`Não foi possível iniciar o túnel SSH: ${(error as Error).message}`);
  }
};
