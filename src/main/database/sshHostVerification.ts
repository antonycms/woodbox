import { createHash } from 'node:crypto';
import { dialog } from 'electron';
import { getSshHostFingerprint, saveSshHostFingerprint } from '../storage/store';

const pendingVerifications = new Map<string, Promise<boolean>>();

export const verifySshHost = (host: string, port: number, key: Buffer): Promise<boolean> => {
  const fingerprint = `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
  const saved = getSshHostFingerprint(host, port);

  if (saved === fingerprint) return Promise.resolve(true);

  const verificationKey = JSON.stringify([host, port, fingerprint]);
  const pending = pendingVerifications.get(verificationKey);
  if (pending) return pending;

  const verification = (async () => {
    if (saved) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Identidade SSH alterada',
        message: `A chave de ${host}:${port} mudou. A conexão foi bloqueada.`,
        detail: `Esperada: ${saved}\nRecebida: ${fingerprint}\n\nConfirme a alteração com o administrador antes de atualizar o registro ssh_hosts no arquivo de configurações do Woodbox.`,
        buttons: ['Fechar'],
      });
      return false;
    }

    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Confiar no servidor SSH?',
      message: `Primeiro acesso a ${host}:${port}`,
      detail: `Impressão digital: ${fingerprint}\n\nCompare esta impressão digital com a informada pelo administrador. Só continue se forem iguais.`,
      buttons: ['Cancelar', 'Confiar e conectar'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (response !== 1) return false;

    // Another connection may have trusted a different key while this dialog was open.
    const current = getSshHostFingerprint(host, port);
    if (current && current !== fingerprint) return false;
    saveSshHostFingerprint(host, port, fingerprint);
    return true;
  })();

  pendingVerifications.set(verificationKey, verification);
  void verification.finally(() => pendingVerifications.delete(verificationKey)).catch(() => {});
  return verification;
};
