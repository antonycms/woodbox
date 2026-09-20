import React from 'react';
import { Input } from '@renderer/components/Input';
import { useI18n } from '@renderer/contexts/I18n';
import { SshTunnelFields } from './components/SshTunnelFields';
import { SslFields } from './components/SslFields';
import type {
  IDataNewConnection,
  RegisterField,
  SetConnectionFormState,
} from '../../types';

interface IConnectionModeNetworkFieldsProps {
  register: RegisterField;
  state: IDataNewConnection;
  setState: SetConnectionFormState;
  color: string;
  backgroundColor: string;
  textColor: string;
  hasSavedPassword: boolean;
  supportsSsl: boolean;
  savedSsh: React.ComponentProps<typeof SshTunnelFields>['savedSsh'];
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
    savedSsh,
  }: IConnectionModeNetworkFieldsProps) => {
    const { t } = useI18n();

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
          <SslFields
            register={register}
            state={state}
            setState={setState}
            color={color}
            backgroundColor={backgroundColor}
            textColor={textColor}
          />
        )}

        <SshTunnelFields
          state={state}
          setState={setState}
          savedSsh={savedSsh}
          color={color}
          backgroundColor={backgroundColor}
          textColor={color}
        />
      </>
    );
  },
);

ConnectionModeNetworkFields.displayName = 'ConnectionModeNetworkFields';
