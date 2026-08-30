import React from 'react';
import { Input } from '@renderer/components/Input';
import { useI18n } from '@renderer/contexts/I18n';
import call from '@renderer/utils/call';
import type {
  IDataNewConnection,
  RegisterField,
  SetConnectionFormState,
  SslFileField,
} from '../../types';
import styles from '../../styles.module.css';

interface IConnectionModeNetworkFieldsProps {
  register: RegisterField;
  state: IDataNewConnection;
  setState: SetConnectionFormState;
  color: string;
  backgroundColor: string;
  textColor: string;
  hasSavedPassword: boolean;
  supportsSsl: boolean;
}

export const ConnectionModeNetworkFields = React.memo(
  ({
    register,
    state,
    setState,
    color,
    backgroundColor,
    textColor,
    hasSavedPassword,
    supportsSsl,
  }: IConnectionModeNetworkFieldsProps) => {
    const { t } = useI18n();

    const handleSslChange = React.useCallback(
      (ssl: boolean) => {
        setState((prevState) => ({
          ...prevState,
          ssl,
          sslRejectUnauthorized: ssl ? prevState.sslRejectUnauthorized : false,
          sslCaCert: ssl ? prevState.sslCaCert : '',
          sslCert: ssl ? prevState.sslCert : '',
          sslKey: ssl ? prevState.sslKey : '',
        }));
      },
      [setState],
    );

    const handleSslRejectUnauthorizedChange = React.useCallback(
      (sslRejectUnauthorized: boolean) => {
        setState((prevState) => ({ ...prevState, sslRejectUnauthorized }));
      },
      [setState],
    );

    const selectSslFile = React.useCallback(
      async (field: SslFileField) => {
        const filePath = await call<string | null>('@dialog:select_ssl_file');

        if (!filePath) return;

        setState((prevState) => ({ ...prevState, [field]: filePath }));
      },
      [setState],
    );

    return (
      <>
        <Input
          required
          label={t('field.host')}
          xs={8}
          md={5}
          color={color}
          backgroundColor={backgroundColor}
          {...register('host')}
        />
        <Input
          required
          label={t('field.port')}
          xs={4}
          md={2}
          type="number"
          color={color}
          backgroundColor={backgroundColor}
          {...register('port')}
        />
        <Input
          required
          label={t('field.database')}
          md={12}
          color={color}
          backgroundColor={backgroundColor}
          {...register('database')}
        />
        <Input
          label={t('field.user')}
          xs={12}
          md={6}
          backgroundColor={backgroundColor}
          color={color}
          {...register('username')}
        />
        <Input
          label={t('field.password')}
          type="password"
          xs={12}
          md={6}
          placeholder={hasSavedPassword ? t('field.passwordSavedPlaceholder') : undefined}
          backgroundColor={backgroundColor}
          color={color}
          {...register('password')}
        />

        {!!supportsSsl && (
          <>
            <div className={styles.checkboxes}>
              <label className={styles.checkbox} style={{ color: textColor }}>
                <input
                  type="checkbox"
                  name="ssl"
                  checked={!!state.ssl}
                  onChange={(event) => handleSslChange(event.target.checked)}
                />
                {t('field.ssl')}
              </label>

              <label className={styles.checkbox} style={{ color: textColor }}>
                <input
                  type="checkbox"
                  name="sslRejectUnauthorized"
                  checked={!!state.sslRejectUnauthorized}
                  disabled={!state.ssl}
                  onChange={(event) => handleSslRejectUnauthorizedChange(event.target.checked)}
                />
                {t('field.sslRejectUnauthorized')}
              </label>
            </div>

            {!!state.ssl && (
              <>
                <Input
                  label={t('field.sslCaCert')}
                  xs={12}
                  md={4}
                  backgroundColor={backgroundColor}
                  color={color}
                  {...register('sslCaCert')}
                  readOnly
                  onClick={() => selectSslFile('sslCaCert')}
                />
                <Input
                  label={t('field.sslCert')}
                  xs={12}
                  md={4}
                  backgroundColor={backgroundColor}
                  color={color}
                  {...register('sslCert')}
                  readOnly
                  onClick={() => selectSslFile('sslCert')}
                />
                <Input
                  label={t('field.sslKey')}
                  xs={12}
                  md={4}
                  backgroundColor={backgroundColor}
                  color={color}
                  {...register('sslKey')}
                  readOnly
                  onClick={() => selectSslFile('sslKey')}
                />
              </>
            )}
          </>
        )}
      </>
    );
  },
);

ConnectionModeNetworkFields.displayName = 'ConnectionModeNetworkFields';
