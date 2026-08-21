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
import type { ConnectionEnvironment } from '@renderer/contexts/Store';
import call from '@renderer/utils/call';
import {
  getRendererDialect,
  getRendererDialectOptions,
  type Dialect,
} from '@renderer/database/dialects';
import styles from './styles.module.css';

const connectionEnvironmentOptions: { label: string; value: ConnectionEnvironment }[] = [
  { label: 'Desenvolvimento', value: 'development' },
  { label: 'Produção', value: 'production' },
];

type SslFileField = 'sslCaCert' | 'sslCert' | 'sslKey';

const getConnectionData = (data: IDataNewConnection, idProject?: string) => {
  const dialect = getRendererDialect(data.dialect);
  const useSsl = !!(dialect.supportsSsl && data.ssl);

  return {
    ...data,
    host: dialect.connectionMode === 'file' ? '' : data.host,
    port: dialect.connectionMode === 'file' ? 0 : Number(data.port),
    ssl: useSsl,
    sslRejectUnauthorized: useSsl ? !!data.sslRejectUnauthorized : false,
    sslCaCert: useSsl ? data.sslCaCert : '',
    sslCert: useSsl ? data.sslCert : '',
    sslKey: useSsl ? data.sslKey : '',
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
      });

    const selectedDialect = getRendererDialect(state.dialect);
    const isFileConnection = selectedDialect.connectionMode === 'file';
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

    const selectSqliteFile = React.useCallback(async () => {
      if (!isFileConnection) return;

      const filePath = await call<string | null>('@dialog:select_sqlite_file');

      if (!filePath) return;

      setState((prevState) => ({ ...prevState, database: filePath }));
    }, [isFileConnection]);

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = React.useCallback(
      handleSubmit(async (data) => {
        const connection = getConnectionData(data, idProject);

        if (idConnection) {
          await editConnection(idConnection, connection);
        } //
        else {
          await addConnection(connection);
        }

        close();
      }),
      [idProject, idConnection],
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

    const handleSslChange = React.useCallback((ssl: boolean) => {
      setState((prevState) => ({
        ...prevState,
        ssl,
        sslRejectUnauthorized: ssl ? prevState.sslRejectUnauthorized : false,
        sslCaCert: ssl ? prevState.sslCaCert : '',
        sslCert: ssl ? prevState.sslCert : '',
        sslKey: ssl ? prevState.sslKey : '',
      }));
    }, []);

    const handleSslRejectUnauthorizedChange = React.useCallback((sslRejectUnauthorized: boolean) => {
      setState((prevState) => ({ ...prevState, sslRejectUnauthorized }));
    }, []);

    const selectSslFile = React.useCallback(async (field: SslFileField) => {
      const filePath = await call<string | null>('@dialog:select_ssl_file');

      if (!filePath) return;

      setState((prevState) => ({ ...prevState, [field]: filePath }));
    }, []);

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
              sm={6}
              md={4}
              {...registerDialect}
              onChange={handleDialectChange}
            />
            {!isFileConnection && (
              <>
                <Input
                  required
                  label={t('field.host')}
                  sm={8}
                  md={6}
                  color={colors.fieldColor}
                  backgroundColor={colors.fieldBackgroundColor}
                  {...register('host')}
                />
                <Input
                  required
                  label={t('field.port')}
                  sm={4}
                  md={2}
                  type="number"
                  color={colors.fieldColor}
                  backgroundColor={colors.fieldBackgroundColor}
                  {...register('port')}
                />
              </>
            )}

            {isFileConnection ? (
              <Input
                required
                label={t('field.file')}
                md={8}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                {...register('database')}
                readOnly
                onClick={isFileConnection ? selectSqliteFile : undefined}
              />
            ) : (
              <>
                <Input
                  required
                  label={t('field.database')}
                  md={12}
                  color={colors.fieldColor}
                  backgroundColor={colors.fieldBackgroundColor}
                  {...register('database')}
                  onClick={isFileConnection ? selectSqliteFile : undefined}
                />
                <Input
                  label={t('field.user')}
                  xs={12}
                  md={6}
                  backgroundColor={colors.fieldBackgroundColor}
                  color={colors.fieldColor}
                  {...register('username')}
                />
                <Input
                  label={t('field.password')}
                  type="password"
                  xs={12}
                  md={6}
                  placeholder={
                    idConnection && connectionSavedData?.hasPassword
                      ? t('field.passwordSavedPlaceholder')
                      : undefined
                  }
                  backgroundColor={colors.fieldBackgroundColor}
                  color={colors.fieldColor}
                  {...register('password')}
                />
                {!!selectedDialect.supportsSsl && (
                  <>
                    <div className={styles.checkboxes}>
                      <label className={styles.checkbox} style={{ color: colors.color }}>
                        <input
                          type="checkbox"
                          name="ssl"
                          checked={!!state.ssl}
                          onChange={(event) => handleSslChange(event.target.checked)}
                        />
                        {t('field.ssl')}
                      </label>

                      <label className={styles.checkbox} style={{ color: colors.color }}>
                        <input
                          type="checkbox"
                          name="sslRejectUnauthorized"
                          checked={!!state.sslRejectUnauthorized}
                          disabled={!state.ssl}
                          onChange={(event) =>
                            handleSslRejectUnauthorizedChange(event.target.checked)
                          }
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
                          backgroundColor={colors.fieldBackgroundColor}
                          color={colors.fieldColor}
                          {...register('sslCaCert')}
                          readOnly
                          onClick={() => selectSslFile('sslCaCert')}
                        />
                        <Input
                          label={t('field.sslCert')}
                          xs={12}
                          md={4}
                          backgroundColor={colors.fieldBackgroundColor}
                          color={colors.fieldColor}
                          {...register('sslCert')}
                          readOnly
                          onClick={() => selectSslFile('sslCert')}
                        />
                        <Input
                          label={t('field.sslKey')}
                          xs={12}
                          md={4}
                          backgroundColor={colors.fieldBackgroundColor}
                          color={colors.fieldColor}
                          {...register('sslKey')}
                          readOnly
                          onClick={() => selectSslFile('sslKey')}
                        />
                      </>
                    )}
                  </>
                )}
              </>
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

interface IDataNewConnection {
  id?: string;
  id_project?: string;

  description: string;
  dialect: Dialect;
  environment?: ConnectionEnvironment;
  host: string;
  port: string | number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  sslRejectUnauthorized?: boolean;
  sslCaCert?: string;
  sslCert?: string;
  sslKey?: string;
}
