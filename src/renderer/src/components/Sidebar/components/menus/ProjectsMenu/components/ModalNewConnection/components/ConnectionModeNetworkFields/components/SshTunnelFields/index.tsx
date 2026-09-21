import { useShallow } from 'zustand/react/shallow';
import { useDialogsStore } from '@renderer/stores/Dialogs';
import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { useI18nStore } from '@renderer/stores/I18n';
import type { ISshConnectionConfig, ISshConnectionPublic } from '@shared/types/ssh';
import { useToastStore } from '@renderer/stores/Toast';
import type { IDataNewConnection, SetConnectionFormState } from '../../../../types';
import { ActivatableSection } from '@renderer/components/ActivatableSection';
import styles from './styles.module.css';

const defaultSsh: ISshConnectionConfig = {
  enabled: false,
  host: '',
  port: 22,
  username: '',
  authMethod: 'password',
};

interface Props {
  state: IDataNewConnection;
  setState: SetConnectionFormState;
  savedSsh?: ISshConnectionPublic;
  color: string;
  backgroundColor: string;
  textColor: string;
}

export const SshTunnelFields = React.memo((props: Props) => {
  const dialogs = useDialogsStore(
    useShallow((state) => ({
      selectSshKey: state.selectSshKey,
    })),
  );
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);

  const { state, setState, savedSsh, color, backgroundColor, textColor } = props;

  const ssh = state.ssh || defaultSsh;
  const fields = { color, backgroundColor };

  const sameIdentity = savedSsh && ssh.host === savedSsh.host && ssh.port === savedSsh.port &&
    ssh.username === savedSsh.username && ssh.authMethod === savedSsh.authMethod;

  const hasPassword = sameIdentity && savedSsh.hasPassword;

  const hasPassphrase = sameIdentity && ssh.privateKeyPath === savedSsh.privateKeyPath &&
    savedSsh.hasPassphrase;

  const methods: { value: ISshConnectionConfig['authMethod']; label: string }[] = [
    { value: 'password', label: t('ssh.methodPassword') },
    { value: 'privateKey', label: t('ssh.methodPrivateKey') },
    { value: 'agent', label: t('ssh.methodAgent') },
  ];

  const update = (changes: Partial<ISshConnectionConfig>) => {
    setState((previous) => ({ ...previous, ssh: { ...(previous.ssh || defaultSsh), ...changes } }));
  };

  const selectKey = async () => {
    try {
      const path = await dialogs.selectSshKey();
      if (path) update({ privateKeyPath: path, passphrase: undefined });
    } catch (error) {
      showToast({ type: 'error', title: t('ssh.keySelectionError'), description: (error as Error).message });
    }
  };

  return (
    <ActivatableSection
      xs={12}
      title={t('ssh.title')}
      checked={ssh.enabled}
      onChecked={checked => update({ enabled: checked })}
      color={textColor}
      backgroundColor={backgroundColor}
    >
      <p className={styles.help}>{t('ssh.destinationHelp')}</p>

      <Row>
        <Input
          required
          xs={8}
          label={t('ssh.host')}
          value={ssh.host}
          color={color}
          backgroundColor={backgroundColor}
          onChange={(event) => update({ host: event.target.value })}
        />

        <Input
          required
          xs={4}
          type="number"
          min={1}
          max={65535}
          color={color}
          backgroundColor={backgroundColor}
          label={t('ssh.port')} value={ssh.port || ''}
          onChange={(event) => update({ port: Number(event.target.value) })}
        />

        <Input
          required
          xs={12}
          md={6}
          label={t('ssh.username')}
          value={ssh.username}
          color={color}
          backgroundColor={backgroundColor}
          onChange={(event) => update({ username: event.target.value })}
        />

        <Autocomplete
          required
          clearable={false}
          xs={12}
          md={6}
          color={color}
          backgroundColor={backgroundColor}
          label={t('ssh.authMethod')} data={methods} value={ssh.authMethod}
          extractLabel={(item) => item.label} extractValue={(item) => item.value}
          onChange={(event) => update({
            authMethod: event.value as ISshConnectionConfig['authMethod'],
            password: undefined,
            passphrase: undefined,
          })}
        />

        {ssh.authMethod === 'password' && (
          <Input
            required={!hasPassword}
            xs={12}
            color={color}
            backgroundColor={backgroundColor}
            type="password"
            label={t('ssh.password')} value={ssh.password || ''}
            placeholder={hasPassword ? t('field.passwordSavedPlaceholder') : undefined}
            onChange={(event) => update({ password: event.target.value })}
          />
        )}

        {ssh.authMethod === 'privateKey' && (
          <>
            <Input
              required
              xs={9}
              color={color}
              backgroundColor={backgroundColor}
              label={t('ssh.privateKey')}
              value={ssh.privateKeyPath || ''}
              onChange={(event) => update({ privateKeyPath: event.target.value, passphrase: undefined })}
            />

            <Button {...fields} xs={3} type="button" onClick={selectKey}>{t('ssh.browse')}</Button>

            <Input
              xs={12}
              type="password"
              label={t('ssh.passphrase')}
              color={color}
              backgroundColor={backgroundColor}
              value={ssh.passphrase || ''}
              placeholder={hasPassphrase ? t('ssh.passphraseSaved') : t('ssh.passphraseOptional')}
              onChange={(event) => update({ passphrase: event.target.value })}
            />
          </>
        )}

        {ssh.authMethod === 'agent' && (
          <Input
            xs={12}
            label={t('ssh.agentPath')}
            value={ssh.agentPath || ''}
            color={color}
            backgroundColor={backgroundColor}
            placeholder={t('ssh.agentAutomatic')}
            onChange={(event) => update({ agentPath: event.target.value })}
          />
        )}
      </Row>

      {ssh.authMethod === 'agent' && <p className={styles.help}>{t('ssh.agentHelp')}</p>}
    </ActivatableSection>
  );
});

SshTunnelFields.displayName = 'SshTunnelFields';
