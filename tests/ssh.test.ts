// Run with: rtk proxy node --experimental-strip-types --test tests/ssh.test.ts
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { createConnection, createServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import ssh2, { type Connection } from 'ssh2';
import { openSshTunnel, resolveSshAgent } from '../src/main/database/ssh.ts';
import { mergeSshCredentials } from '../src/main/storage/modules/ssh_credentials.ts';
import type { ISshConnectionConfig } from '../src/preload/ssh.d.ts';

const { Server, utils } = ssh2;
const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const privateKey = key.export({ type: 'pkcs1', format: 'pem' }).toString();
const passphrase = '  protected key  ';
const encryptedKey = key.export({ type: 'pkcs1', format: 'pem', cipher: 'aes-256-cbc', passphrase }).toString();
const publicKey = (() => {
  const parsed = utils.parseKey(privateKey);
  if (parsed instanceof Error || Array.isArray(parsed)) throw new Error('Invalid test key');
  return parsed;
})();

async function fixture(t: TestContext, denyForwarding = false) {
  const sockets = new Set<Socket>();
  const echo = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.once('close', () => sockets.delete(socket));
    socket.pipe(socket);
  });
  echo.listen(0, '127.0.0.1');
  await once(echo, 'listening');
  const destination = { host: '127.0.0.1', port: (echo.address() as { port: number }).port };
  const clients = new Set<Connection>();
  let authAttempts = 0;
  const server = new Server({ hostKeys: [privateKey] }, (client) => {
    clients.add(client);
    client.on('error', () => {});
    client.once('close', () => clients.delete(client));
    client.on('authentication', (context) => {
      authAttempts++;
      if (context.username !== 'tester') return context.reject();
      if (context.method === 'password' && context.password === ' password ') return context.accept();
      if (context.method === 'publickey' && publicKey.getPublicSSH().equals(context.key.data) &&
        (!context.signature || publicKey.verify(context.blob!, context.signature, context.hashAlgo))) {
        return context.accept();
      }
      context.reject();
    });
    client.on('ready', () => {
      client.on('tcpip', (accept, reject, info) => {
        if (denyForwarding || info.destIP !== destination.host || info.destPort !== destination.port) {
          reject();
          return;
        }
        const remote = createConnection(destination.port, destination.host);
        sockets.add(remote);
        remote.on('error', () => remote.destroy());
        remote.once('close', () => sockets.delete(remote));
        remote.once('connect', () => {
          const channel = accept();
          channel.on('error', () => remote.destroy());
          channel.once('close', () => remote.destroy());
          remote.once('close', () => channel.destroy());
          channel.pipe(remote).pipe(channel);
        });
      });
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const client of clients) client.end();
    for (const socket of sockets) socket.destroy();
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => echo.close(() => resolve())),
    ]);
  });
  const config: ISshConnectionConfig = {
    enabled: true,
    host: '127.0.0.1',
    port: (server.address() as { port: number }).port,
    username: 'tester',
    authMethod: 'password',
    password: ' password ',
  };
  return { config, destination, clients, authAttempts: () => authAttempts };
}

async function roundTrip(port: number, content = 'SELECT 1') {
  const socket = createConnection(port, '127.0.0.1');
  try {
    await once(socket, 'connect');
    socket.write(content);
    const [data] = await once(socket, 'data');
    assert.equal(data.toString(), content);
  } finally {
    socket.destroy();
  }
}

test('password tunnel forwards concurrent connections and releases its local port', { timeout: 10000 }, async (t) => {
  const { config, destination } = await fixture(t);
  const tunnel = await openSshTunnel(config, destination, async () => true);
  t.after(() => tunnel.close());
  assert.equal(tunnel.host, '127.0.0.1');
  await Promise.all([roundTrip(tunnel.port, 'a'), roundTrip(tunnel.port, 'b'), roundTrip(tunnel.port, 'c')]);
  await tunnel.close();
  await tunnel.close();
  assert.equal(tunnel.isOpen(), false);
  const probe = createServer();
  probe.listen(tunnel.port, tunnel.host);
  await once(probe, 'listening');
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});

test('private keys, including encrypted keys with whitespace in the passphrase', { timeout: 15000 }, async (t) => {
  const { config, destination } = await fixture(t);
  const directory = await mkdtemp(join(tmpdir(), 'woodbox-ssh-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const encrypted of [false, true]) {
    const path = join(directory, encrypted ? 'encrypted' : 'key');
    await writeFile(path, encrypted ? encryptedKey : privateKey, { mode: 0o600 });
    if (encrypted) {
      await assert.rejects(openSshTunnel({
        ...config, authMethod: 'privateKey', privateKeyPath: path, passphrase: 'incorrect',
      }, destination, async () => true), /túnel SSH/);
    }
    const tunnel = await openSshTunnel({
      ...config, authMethod: 'privateKey', privateKeyPath: path,
      password: undefined, passphrase: encrypted ? passphrase : undefined,
    }, destination, async () => true);
    try { await roundTrip(tunnel.port); } finally { await tunnel.close(); }
  }
});

test('SSH Agent authenticates using an isolated system agent', {
  timeout: 15000, skip: process.platform === 'win32',
}, async (t) => {
  const { config, destination } = await fixture(t);
  const directory = await mkdtemp(join(tmpdir(), 'woodbox-agent-'));
  const socketPath = join(directory, 'agent.sock');
  const keyPath = join(directory, 'key');
  const agent = spawn('ssh-agent', ['-D', '-a', socketPath], { stdio: 'ignore' });
  t.after(async () => {
    agent.kill();
    await once(agent, 'exit');
    await rm(directory, { recursive: true, force: true });
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await stat(socketPath).catch(() => false)) break;
    await delay(20);
  }
  await writeFile(keyPath, privateKey, { mode: 0o600 });
  execFileSync('ssh-add', [keyPath], { env: { ...process.env, SSH_AUTH_SOCK: socketPath }, stdio: 'ignore' });
  const tunnel = await openSshTunnel({
    ...config, authMethod: 'agent', agentPath: socketPath, password: undefined,
  }, destination, async () => true);
  try { await roundTrip(tunnel.port); } finally { await tunnel.close(); }
});

test('invalid credentials and untrusted host keys fail without authenticating to an untrusted server', { timeout: 10000 }, async (t) => {
  const fixtureData = await fixture(t);
  const { config, destination } = fixtureData;
  await assert.rejects(openSshTunnel(config, destination, async () => false), /Identidade/);
  assert.equal(fixtureData.authAttempts(), 0);
  await assert.rejects(openSshTunnel({ ...config, password: 'incorrect' }, destination, async () => true), /autenticação SSH/);
  await assert.rejects(openSshTunnel({ ...config, authMethod: 'agent', agentPath: '/nonexistent/agent' }, destination, async () => true), /SSH/);
});

test('denied forwarding closes the local socket with an actionable error', { timeout: 10000 }, async (t) => {
  const { config, destination } = await fixture(t, true);
  const tunnel = await openSshTunnel(config, destination, async () => true);
  t.after(() => tunnel.close());
  const socket = createConnection(tunnel.port, tunnel.host);
  await once(socket, 'close');
  assert.match(tunnel.getError()!.message, /não conseguiu acessar o banco/);
});

test('server disconnect invalidates the tunnel and closes existing sockets', { timeout: 10000 }, async (t) => {
  const { config, destination, clients } = await fixture(t);
  const tunnel = await openSshTunnel(config, destination, async () => true);
  t.after(() => tunnel.close());
  const socket = createConnection(tunnel.port, tunnel.host);
  await once(socket, 'connect');
  const closed = once(socket, 'close');
  for (const client of clients) client.end();
  await closed;
  assert.equal(tunnel.isOpen(), false);
  assert.match(tunnel.getError()!.message, /encerrado/);
});

test('agent discovery supports environment, manual override, Windows pipe and Pageant', () => {
  assert.equal(resolveSshAgent('/manual', 'linux', '/env'), '/manual');
  assert.equal(resolveSshAgent('', 'linux', '/env'), '/env');
  assert.equal(resolveSshAgent('', 'win32', ''), '\\\\.\\pipe\\openssh-ssh-agent');
  assert.equal(resolveSshAgent('pageant', 'win32', ''), 'pageant');
  assert.throws(() => resolveSshAgent('', 'linux', ''), /não encontrado/);
});

test('saved secrets are only reused for the same SSH identity and auth method', () => {
  const ssh: ISshConnectionConfig = {
    enabled: true, host: 'server', port: 22, username: 'user', authMethod: 'password', password: 'saved',
  };
  assert.equal(mergeSshCredentials({ ...ssh, password: '' }, ssh)?.password, 'saved');
  assert.equal(mergeSshCredentials({ ...ssh, host: 'other', password: '' }, ssh)?.password, undefined);
  assert.equal(mergeSshCredentials({ ...ssh, authMethod: 'agent' }, ssh)?.password, undefined);
  assert.equal(mergeSshCredentials(undefined, ssh), undefined);
  const encrypted = { ...ssh, authMethod: 'privateKey' as const, privateKeyPath: '/key', passphrase: 'saved' };
  assert.equal(mergeSshCredentials({ ...encrypted, passphrase: undefined }, encrypted)?.passphrase, 'saved');
  assert.equal(mergeSshCredentials({ ...encrypted, passphrase: '' }, encrypted)?.passphrase, '');
  assert.equal(mergeSshCredentials({ ...encrypted, privateKeyPath: '/other', passphrase: undefined }, encrypted)?.passphrase, undefined);
});

test('invalid ports, missing key files and invalid auth methods are rejected', async () => {
  const config: ISshConnectionConfig = { enabled: true, host: 'host', port: 0, username: 'user', authMethod: 'password' };
  const destination = { host: 'localhost', port: 5432 };
  await assert.rejects(openSshTunnel(config, destination, async () => true), /porta válida/);
  await assert.rejects(openSshTunnel({ ...config, port: 22, authMethod: 'privateKey', privateKeyPath: '/nonexistent/key' }, destination, async () => true), /ler a chave/);
});
