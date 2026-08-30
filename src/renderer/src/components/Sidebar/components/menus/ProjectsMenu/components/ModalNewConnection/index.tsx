import React, { useCallback } from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useForm } from '@renderer/hooks/useForm';
import { useStoreContext } from '@renderer/contexts/Store';
import { useI18n } from '@renderer/contexts/I18n';
import { useToast } from '@renderer/contexts/Toast';
import { useThemeContext } from '@renderer/contexts/Theme';
import { Autocomplete } from '@renderer/components/Autocomplete';
import type { ConnectionEnvironment, IConnectionCreate } from '@renderer/contexts/Store';
import {
  getRendererDialect,
  getRendererDialectOptions,
  type Dialect,
} from '@renderer/database/dialects';
import { ConnectionModeFileFields } from './components/ConnectionModeFileFields';
import { ConnectionModeNetworkFields } from './components/ConnectionModeNetworkFields';
import { ReactNativeBridgeFields } from './components/ReactNativeBridgeFields';
import type { IDataNewConnection } from './types';

const connectionEnvironmentOptions: { label: string; value: ConnectionEnvironment }[] = [
  { label: 'Desenvolvimento', value: 'development' },
  { label: 'Produção', value: 'production' },
];

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
    reactNativeBridge: isReactNativeBridge ? data.reactNativeBridge : undefined,
    id_project: idProject || data.id_project,
  };
};

export const ModalNewConnection = React.memo(
  ({ idProject, idConnection, show, onClose }: IModalNewConnectionProps) => {
    const { showToast } = useToast();
    const { t } = useI18n();

    const { connections, addConnection, editConnection, connectionTypes, testConnection } =
      useStoreContext();

    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const formRef = React.useRef<HTMLFormElement>(null);
    const [loadingTestConnection, setLoadingTestConnection] = React.useState(false);

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
    const connectionSavedData = React.useMemo(
      () =>
        idConnection ? connections.find((connection) => connection.id === idConnection) : undefined,
      [connections, idConnection],
    );

    const registerDialect = register('dialect');

    const handleDialectChange = React.useCallback(
      (event: any) => {
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

        if (idConnection) {
          await editConnection(idConnection, connection);
        } //
        else {
          await addConnection(connection);
        }

        close();
      }),
      [idProject, idConnection, showToast, t],
    );

    const checkConnection = useCallback(async () => {
      const checkDataForm = formRef.current.reportValidity();

      if (!checkDataForm) return;

      const formValue = getValue();
      const connection = getConnectionData(formValue, idProject);

      try {
        setLoadingTestConnection(true);

        await testConnection(connection);

        showToast({ type: 'success', title: t('toast.connectionSuccess') });
      } catch (error) {
        showToast({
          type: 'error',
          title: t('toast.connectionFailed'),
          description: error.message,
        });
      } finally {
        setLoadingTestConnection(false);
      }
    }, []);

    const loadConnectionEditingData = async () => {
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
      }));
    };

    React.useEffect(() => {
      loadConnectionEditingData();
    }, [connectionSavedData, idConnection]);

    return (
      <Modal
        title={idConnection ? t('modal.editConnection') : t('modal.newConnection')}
        width="500px"
        show={show}
      >
        <form id="formNewConnection" onSubmit={onSubmit} ref={formRef}>
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
              />
            )}
          </Row>

          <Divider size={4} />

          <Row>
            <Button
              xs={6}
              sm={4}
              md={3}
              onClick={checkConnection}
              loading={loadingTestConnection}
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
              color={colors.saveButtonColor}
              backgroundColor={colors.saveButtonBackgroundColor}
            >
              {t('common.save')}
            </Button>
          </Row>
        </form>
      </Modal>
    );
  },
);

ModalNewConnection.displayName = 'ModalNewConnection';

export interface IModalNewConnectionProps {
  idProject: string;

  /**
   * used in edit mode
   */
  idConnection?: string;

  show?: boolean;
  onClose?: () => void;
}
