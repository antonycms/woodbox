import React from 'react';
import { ActivatableSection } from '@renderer/components/ActivatableSection';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { useI18n } from '@renderer/contexts/I18n';
import call from '@renderer/utils/call';
import type { IDataNewConnection, RegisterField, SetConnectionFormState } from '../../../../types';
import styles from './styles.module.css';

const sslFileFields = ['sslCaCert', 'sslCert', 'sslKey'] as const;
type SslFileField = (typeof sslFileFields)[number];

interface ISslFieldsProps {
  register: RegisterField;
  state: IDataNewConnection;
  setState: SetConnectionFormState;
  color: string;
  backgroundColor: string;
  textColor: string;
}

export const SslFields = React.memo(
  ({ register, state, setState, color, backgroundColor, textColor }: ISslFieldsProps) => {
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
      <ActivatableSection
        xs={12}
        title={t('field.ssl')}
        checked={!!state.ssl}
        onChecked={handleSslChange}
        color={textColor}
        backgroundColor={backgroundColor}
      >
        <div className={styles.checkboxes}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              name="sslRejectUnauthorized"
              checked={!!state.sslRejectUnauthorized}
              onChange={(event) => handleSslRejectUnauthorizedChange(event.target.checked)}
            />
            {t('field.sslRejectUnauthorized')}
          </label>
        </div>

        <Row>
          {sslFileFields.map((field) => (
            <Input
              key={field}
              label={t(`field.${field}`)}
              xs={12}
              md={4}
              backgroundColor={backgroundColor}
              color={color}
              {...register(field)}
              readOnly
              onClick={() => selectSslFile(field)}
            />
          ))}
        </Row>
      </ActivatableSection>
    );
  },
);

SslFields.displayName = 'SslFields';
