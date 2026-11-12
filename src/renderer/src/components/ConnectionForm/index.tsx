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
import type { ConnectionEnvironment, Dialect, IConnectionTestInput } from '@shared/types/connections';
import type { IDatabaseDialectInfo } from '@shared/types/database';
import { Text } from '@renderer/components/Text';
import { applyConnectionDialectChange, getInitialConnectionFormData } from './utils';
import { ConnectionModeFileFields } from './components/ConnectionModeFileFields';
import { ConnectionModeNetworkFields } from './components/ConnectionModeNetworkFields';
import { ReactNativeBridgeFields } from './components/ReactNativeBridgeFields';

const ReadyConnectionForm = React.memo(
  ({ idProject, idConnection, onClose, onSaved, renderActions, dialects }: IConnectionFormProps & { dialects: IDatabaseDialectInfo[] }) => {
    const showToast = useToastStore((state) => state.showToast);
    const t = useI18nStore((state) => state.t);

    const { connections, addConnection, editConnection, testConnection } =
      useWorkspaceStore(
        useShallow((state) => ({
          connections: state.connections,
          addConnection: state.addConnection,
          editConnection: state.editConnection,
          testConnection: state.testConnection,
        })),
      );

    const { modal: colors } = useThemeStore((state) => state.activeTheme);

    const [loadingTestConnection, setLoadingTestConnection] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const formRef = React.useRef<HTMLFormElement>(null);
    const busyRef = React.useRef(false);

    const dialectsById = React.useMemo(
      () => new Map(dialects.map((item) => [item.id, item])),
      [dialects],
    );
    const defaultDialect = dialects[0];
    const dialectOptions = dialects;

    const { state, register, handleSubmit, reset, setState, getValue } =
      useForm<IConnectionTestInput>(getInitialConnectionFormData(defaultDialect));

    const selectedDialect = dialectsById.get(state.dialect);
    const isReactNativeBridge = selectedDialect?.mode === 'react-native-bridge';
    const isFileConnection = selectedDialect?.mode === 'file';
    const isNetworkConnection = selectedDialect?.mode === 'network';
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
        const spec = dialectsById.get(dialect);
        if (!spec) return;

        registerDialect.onChange(event);

        setState((prevState) => applyConnectionDialectChange(prevState, spec));
      },
      [dialectsById, registerDialect],
    );

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = React.useCallback(
      handleSubmit(async (data) => {
        const descriptor = dialectsById.get(data.dialect);
        if (!descriptor) {
          showToast({ type: 'error', title: t('connectionForm.dialectUnavailable') });
          return;
        }
        const isReactNativeBridgeConnection = descriptor.mode === 'react-native-bridge';

        if (isReactNativeBridgeConnection && !data.reactNativeBridge?.adapterId) {
          showToast({
            type: 'error',
            title: t('reactNativeBridge.adapterRequired'),
          });
          return;
        }

        const connection = { ...data, id_project: idProject || data.id_project };

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
      [idProject, idConnection, showToast, t, addConnection, editConnection, onSaved, close, dialectsById],
    );

    const checkConnection = useCallback(async () => {
      if (busyRef.current) return;
      const checkDataForm = formRef.current?.reportValidity();

      if (!checkDataForm) return;

      const formValue = getValue();
      const descriptor = dialectsById.get(formValue.dialect);
      if (!descriptor) {
        showToast({ type: 'error', title: t('connectionForm.dialectUnavailable') });
        return;
      }
      const connection = { ...formValue, id_project: idProject || formValue.id_project };

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
    }, [getValue, idProject, testConnection, showToast, t, dialectsById]);

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
              supportsSsl={!!selectedDialect?.supportsSsl}
              savedSsh={connectionSavedData?.ssh}
            />
          )}
        </Row>

        <Divider size={4} />

        {renderActions ? (
          renderActions({ testConnection: checkConnection, testing: loadingTestConnection, saving, available: true })
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

ReadyConnectionForm.displayName = 'ReadyConnectionForm';

export const ConnectionForm = React.memo((props: IConnectionFormProps) => {
  const { dialectCatalog, loadDialectCatalog } = useWorkspaceStore(useShallow((state) => ({
    dialectCatalog: state.dialectCatalog,
    loadDialectCatalog: state.loadDialectCatalog,
  })));
  const t = useI18nStore((state) => state.t);
  const colors = useThemeStore((state) => state.activeTheme.modal);

  React.useEffect(() => {
    if (dialectCatalog.status === 'idle') void loadDialectCatalog().catch(() => {});
  }, [dialectCatalog.status, loadDialectCatalog]);

  if (dialectCatalog.status === 'ready' && dialectCatalog.items.length) {
    return <ReadyConnectionForm {...props} dialects={dialectCatalog.items} />;
  }

  const unavailableMessage = dialectCatalog.status === 'ready'
    ? t('connectionForm.catalogEmpty')
    : dialectCatalog.status === 'error'
      ? t('connectionForm.catalogError')
      : t('common.loading');

  return (
    <>
      <Text userSelect={false} color={colors.color}>{unavailableMessage}</Text>
      {dialectCatalog.status === 'error' && (
        <Button
          onClick={() => void loadDialectCatalog().catch(() => {})}
          color={colors.testButtonColor}
          backgroundColor={colors.testButtonBackgroundColor}
        >
          {t('connectionForm.retryCatalog')}
        </Button>
      )}
      {props.renderActions ? props.renderActions({
        testConnection: async () => {}, testing: false, saving: false, available: false,
      }) : props.onClose && (
        <Row>
          <Spacer />
          <Button
            onClick={props.onClose}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            {t('common.cancel')}
          </Button>
        </Row>
      )}
    </>
  );
});

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
    available: boolean;
  }) => React.ReactNode;
}
