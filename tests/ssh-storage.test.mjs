// Run with: rtk proxy node --experimental-strip-types --test tests/ssh-storage.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const knownHosts = new Map();
let response = 0;
const dialogs = [];
globalThis.__sshTestDialog = {
  showMessageBox: async (options) => {
    dialogs.push(options);
    return { response };
  },
};
globalThis.__sshTestHosts = knownHosts;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'electron') return { url: 'test:electron', shortCircuit: true };
    if (specifier === '../storage/store') return { url: 'test:store', shortCircuit: true };
    if (specifier.startsWith('@main/')) {
      return { url: new URL(`../src/main/${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
    }
    if (specifier === './ssh_credentials') {
      return { url: new URL('./ssh_credentials.ts', context.parentURL).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'test:electron') {
      return { format: 'module', source: 'export const dialog = globalThis.__sshTestDialog;', shortCircuit: true };
    }
    if (url === 'test:store') {
      return {
        format: 'module', shortCircuit: true,
        source: `
          export const getSshHostFingerprint = (host, port) => globalThis.__sshTestHosts.get(host + ':' + port);
          export const saveSshHostFingerprint = (host, port, fingerprint) => globalThis.__sshTestHosts.set(host + ':' + port, fingerprint);
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { getModule } = await import('../src/main/storage/modules/saved_connections.ts');
const { verifySshHost } = await import('../src/main/database/sshHostVerification.ts');

test('storage encrypts SSH secrets, preserves whitespace, hides them publicly and supports editing', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'woodbox-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const values = new Map();
  const store = {
    path: join(directory, 'config.json'),
    get: (key) => structuredClone(values.get(key)),
    set: (key, value) => values.set(key, structuredClone(value)),
  };
  const connections = getModule(store);
  const base = {
    id: 'ssh-test', id_project: 'project', dialect: 'postgres', description: 'Test',
    host: 'db', port: 5432, database: 'db', username: 'db-user', password: 'db-secret',
    ssh: { enabled: true, host: 'ssh-server', port: 22, username: 'ssh-user', authMethod: 'password', password: ' ssh-secret ' },
  };
  connections.add(base);
  assert.match(values.get('saved_connections')[0].ssh.password, /^woodbox-enc-v1:/);
  assert.equal(connections.getInternal(base.id).ssh.password, ' ssh-secret ');
  const publicConnection = connections.get(base.id);
  assert.equal(publicConnection.password, undefined);
  assert.equal(publicConnection.ssh.password, undefined);
  assert.equal(publicConnection.ssh.passphrase, undefined);
  assert.equal(publicConnection.ssh.hasPassword, true);
  connections.edit(base.id, { ...publicConnection, password: '', description: 'Edited' });
  assert.equal(connections.getInternal(base.id).ssh.password, ' ssh-secret ');
  assert.equal(connections.getInternal(base.id).password, 'db-secret');

  connections.edit(base.id, { ...publicConnection, ssh: {
    ...publicConnection.ssh, authMethod: 'privateKey', privateKeyPath: '/key', passphrase: ' passphrase ',
  } });
  assert.equal(connections.getInternal(base.id).ssh.password, undefined);
  assert.equal(connections.getInternal(base.id).ssh.passphrase, ' passphrase ');
  assert.equal(connections.get(base.id).ssh.hasPassphrase, true);
  assert.match(values.get('saved_connections')[0].ssh.passphrase, /^woodbox-enc-v1:/);
  connections.edit(base.id, connections.get(base.id));
  assert.equal(connections.getInternal(base.id).ssh.passphrase, ' passphrase ');
  connections.edit(base.id, { ...connections.get(base.id), ssh: { ...connections.get(base.id).ssh, passphrase: '' } });
  assert.equal(connections.get(base.id).ssh.hasPassphrase, false);

  connections.edit(base.id, { ...connections.get(base.id), ssh: undefined });
  assert.equal(connections.get(base.id).ssh, undefined);
  assert.equal(connections.getInternal(base.id).password, 'db-secret');
});

test('first access requires approval, trusts only the approved key, blocks changed keys and deduplicates prompts', async () => {
  const key = Buffer.from('server-key');
  response = 0;
  assert.equal(await verifySshHost('server', 22, key), false);
  assert.equal(knownHosts.size, 0);
  response = 1;
  dialogs.length = 0;
  assert.deepEqual(await Promise.all([
    verifySshHost('server', 22, key), verifySshHost('server', 22, key),
  ]), [true, true]);
  assert.equal(dialogs.length, 1);
  assert.equal(dialogs[0].defaultId, 0);
  const pinned = knownHosts.get('server:22');
  assert.match(pinned, /^SHA256:/);
  assert.equal(await verifySshHost('server', 22, key), true);
  assert.equal(dialogs.length, 1);
  assert.equal(await verifySshHost('server', 22, Buffer.from('different-key')), false);
  assert.equal(knownHosts.get('server:22'), pinned);
  assert.equal(dialogs.at(-1).type, 'error');
});
