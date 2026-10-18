import { getErrorMessage } from '@shared/utils/error';
import { useShallow } from 'zustand/react/shallow';
import React, { useCallback } from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useForm, type FormChangeValue } from '@renderer/hooks/useForm';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { useThemeStore } from '@renderer/stores/Theme';
import { Autocomplete } from '@renderer/components/Autocomplete';
import type { ConnectionEnvironment, IConnectionCreate, Dialect } from '@shared/types/connections';
import { getRendererDialect, getRendererDialectOptions } from '@renderer/database/dialects';
import { ConnectionModeFileFields } from './components/ConnectionModeFileFields';
import { ConnectionModeNetworkFields } from './components/ConnectionModeNetworkFields';
import { ReactNativeBridgeFields } from './components/ReactNativeBridgeFields';
import type { IDataNewConnection } from './types';

const getConnectionData = (data: IDataNewConnection, idProject?: string): IConnectionCreate => {
  const dialect = getRendererDialect(data.dialect);
  const isReactNativeBridge = dialect.connectionMode === 'react-native-bridge';
  const isNetworkConnection = dialect.connectionMode === 'network';
  const useSsl = !!(dialect.supportsSsl && data.ssl);

  return {
    ...data,
    host: isNetworkConnection ? data.host : '',
    port: isNetworkConnection ? Number(data.port) : 0,
    database: isReactNativeBridge
      ? data.reactNativeBridge?.adapterLabel || data.reactNativeBridge?.adapterId || ''
      : data.database,
    username: isReactNativeBridge ? '' : data.username,
    password: isReactNativeBridge ? '' : data.password,
    ssl: useSsl,
    sslRejectUnauthorized: useSsl ? !!data.sslRejectUnauthorized : false,
    sslCaCert: useSsl ? data.sslCaCert : '',
    sslCert: useSsl ? data.sslCert : '',
    sslKey: useSsl ? data.sslKey : '',
    ssh: isNetworkConnection ? data.ssh : undefined,
    reactNativeBridge: isReactNativeBridge ? data.reactNativeBridge : undefined,
    id_project: idProject || data.id_project,
  };
};

export const ConnectionForm = React.memo(
  ({ idProject, idConnection, onClose, onSaved, renderActions }: IConnectionFormProps) => {
    const showToast = useToastStore((state) => state.showToast);
    const t = useI18nStore((state) => state.t);

    const { connections, addConnection, editConnection, connectionTypes, testConnection } =
      useWorkspaceStore(
        useShallow((state) => ({
          connections: state.connections,
          addConnection: state.addConnection,
          editConnection: state.editConnection,
          connectionTypes: state.connectionTypes,
          testConnection: state.testConnection,
        })),
      );

    const { modal: colors } = useThemeStore((state) => state.activeTheme);

    const [loadingTestConnection, setLoadingTestConnection] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const formRef = React.useRef<HTMLFormElement>(null);
    const busyRef = React.useRef(false);

    const defaultDialect = getRendererDialect(connectionTypes[0]);
    const dialectOptions = getRendererDialectOptions(connectionTypes);

    const { state, register, handleSubmit, reset, setState, getValue } =
      useForm<IDataNewConnection>({
        dialect: defaultDialect.id,
        environment: 'development',
        description: '',
        host: '',
        port: defaultDialect.defaultPort || '',
        database: '',
        username: '',
        password: '',
        ssl: false,
        sslRejectUnauthorized: false,
        sslCaCert: '',
        sslCert: '',
        sslKey: '',
        reactNativeBridge: undefined,
      });

    const selectedDialect = getRendererDialect(state.dialect);
    const isReactNativeBridge = selectedDialect.connectionMode === 'react-native-bridge';
    const isFileConnection = selectedDialect.connectionMode === 'file';
    const isNetworkConnection = selectedDialect.connectionMode === 'network';
    const connectionEnvironmentOptions = React.useMemo<
      { label: string; value: ConnectionEnvironment }[]
    >(
      () => [
        { label: t('field.development'), value: 'development' },
        { label: t('field.production'), value: 'production' },
      ],
      [t],
    );
    const connectionSavedData = React.useMemo(
      () =>
        idConnection ? connections.find((connection) => connection.id === idConnection) : undefined,
      [connections, idConnection],
    );

    const registerDialect = register('dialect');

    const handleDialectChange = React.useCallback(
      (event: FormChangeValue) => {
        const dialect = event.value as Dialect;
        const spec = getRendererDialect(dialect);

        registerDialect.onChange(event);

        setState((prevState) => ({
          ...prevState,
          dialect,
          host: spec.connectionMode === 'file' ? '' : prevState.host,
          port: spec.connectionMode === 'file' ? '' : spec.defaultPort || prevState.port,
          ssl: spec.supportsSsl ? prevState.ssl : false,
          sslRejectUnauthorized: spec.supportsSsl ? prevState.sslRejectUnauthorized : false,
          sslCaCert: spec.supportsSsl ? prevState.sslCaCert : '',
          sslCert: spec.supportsSsl ? prevState.sslCert : '',
          sslKey: spec.supportsSsl ? prevState.sslKey : '',
          ssh: spec.connectionMode === 'network' ? prevState.ssh : undefined,
        }));
      },
      [registerDialect],
    );

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = React.useCallback(
      handleSubmit(async (data) => {
        const isReactNativeBridgeConnection =
          getRendererDialect(data.dialect).connectionMode === 'react-native-bridge';

        if (isReactNativeBridgeConnection && !data.reactNativeBridge?.adapterId) {
          showToast({
            type: 'error',
            title: t('reactNativeBridge.adapterRequired'),
          });
          return;
        }

        const connection = getConnectionData(data, idProject);

        if (busyRef.current) return;
        busyRef.current = true;
        setSaving(true);

        try {
          if (idConnection) {
            await editConnection(idConnection, connection);
          } else {
            await addConnection(connection);
          }

          onSaved?.();
          close();
        } catch (error: unknown) {
          showToast({
            type: 'error',
            title: t('toast.connectionSaveError'),
            description: getErrorMessage(error, t('common.unknownError')),
          });
        } finally {
          busyRef.current = false;
          setSaving(false);
        }
      }),
      [idProject, idConnection, showToast, t, addConnection, editConnection, onSaved, close],
    );

    const checkConnection = useCallback(async () => {
      if (busyRef.current) return;
      const checkDataForm = formRef.current?.reportValidity();

      if (!checkDataForm) return;

      const formValue = getValue();
      const connection = getConnectionData(formValue, idProject);

      try {
        busyRef.current = true;
        setLoadingTestConnection(true);

        await testConnection(connection);

        showToast({ type: 'success', title: t('toast.connectionSuccess') });
      } catch (error: unknown) {
        showToast({
          type: 'error',
          title: t('toast.connectionFailed'),
          description: getErrorMessage(error, t('common.unknownError')),
        });
      } finally {
        busyRef.current = false;
        setLoadingTestConnection(false);
      }
    }, [getValue, idProject, testConnection, showToast, t]);

    React.useEffect(() => {
      if (!idConnection) return;

      setState((prevState) => ({
        ...prevState,
        ...connectionSavedData,
        environment: connectionSavedData?.environment || 'development',
        password: '',
        ssl: !!connectionSavedData?.ssl,
        sslRejectUnauthorized: !!connectionSavedData?.sslRejectUnauthorized,
        sslCaCert: connectionSavedData?.sslCaCert || '',
        sslCert: connectionSavedData?.sslCert || '',
        sslKey: connectionSavedData?.sslKey || '',
        ssh: connectionSavedData?.ssh
          ? {
              enabled: connectionSavedData.ssh.enabled,
              host: connectionSavedData.ssh.host,
              port: connectionSavedData.ssh.port,
              username: connectionSavedData.ssh.username,
              authMethod: connectionSavedData.ssh.authMethod,
              privateKeyPath: connectionSavedData.ssh.privateKeyPath,
              agentPath: connectionSavedData.ssh.agentPath,
            }
          : undefined,
      }));
    }, [connectionSavedData, idConnection, setState]);

    return (
      <form onSubmit={onSubmit} ref={formRef}>
        <Row>
          <Input
            autoFocus
            required
            label={t('field.description')}
            xs={12}
            sm={6}
            md={6}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('description')}
          />
          <Autocomplete
            required
            clearable={false}
            data={connectionEnvironmentOptions}
            label={t('field.type')}
            extractLabel={(item) =>
              item.value === 'production' ? t('field.production') : t('field.development')
            }
            extractValue={(item) => item.value}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            xs={12}
            sm={6}
            md={6}
            {...register('environment')}
          />

          <Autocomplete
            required
            clearable={false}
            data={dialectOptions}
            label={t('field.dialect')}
            extractLabel={(item) => item.label}
            extractValue={(item) => item.id}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            xs={12}
            md={5}
            {...registerDialect}
            onChange={handleDialectChange}
          />

          {isReactNativeBridge && (
            <ReactNativeBridgeFields
              state={state}
              setState={setState}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
            />
          )}

          {isFileConnection && (
            <ConnectionModeFileFields
              register={register}
              setState={setState}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
            />
          )}

          {isNetworkConnection && (
            <ConnectionModeNetworkFields
              register={register}
              state={state}
              setState={setState}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              textColor={colors.color}
              hasSavedPassword={!!(idConnection && connectionSavedData?.hasPassword)}
              supportsSsl={!!selectedDialect.supportsSsl}
              savedSsh={connectionSavedData?.ssh}
            />
          )}
        </Row>

        <Divider size={4} />

        {renderActions ? (
          renderActions({ testConnection: checkConnection, testing: loadingTestConnection, saving })
        ) : (
          <Row>
            <Button
              xs={6}
              sm={4}
              md={3}
              onClick={checkConnection}
              loading={loadingTestConnection}
              disabled={saving}
              color={colors.testButtonColor}
              backgroundColor={colors.testButtonBackgroundColor}
            >
              {t('common.test')}
            </Button>

            <Spacer />

            <Button
              xs={6}
              sm={4}
              md={3}
              onClick={close}
              disabled={saving || loadingTestConnection}
              color={colors.cancelButtonColor}
              backgroundColor={colors.cancelButtonBackgroundColor}
            >
              {t('settings.customization.cancel')}
            </Button>

            <Button
              xs={6}
              sm={4}
              md={3}
              type="submit"
              loading={saving}
              disabled={loadingTestConnection}
              color={colors.saveButtonColor}
              backgroundColor={colors.saveButtonBackgroundColor}
            >
              {t('common.save')}
            </Button>
          </Row>
        )}
      </form>
    );
  },
);

ConnectionForm.displayName = 'ConnectionForm';

export interface IConnectionFormProps {
  idProject: string;
  idConnection?: string;
  onClose?: () => void;
  onSaved?: () => void;
  renderActions?: (actions: {
    testConnection: () => Promise<void>;
    testing: boolean;
    saving: boolean;
  }) => React.ReactNode;
}
