import React, { useCallback } from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useForm } from '@renderer/hooks/useForm';
import { useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import { useThemeContext } from '@renderer/contexts/Theme';
import { Autocomplete } from '@renderer/components/Autocomplete';

export const ModalNewConnection = React.memo(
  ({ idProject, idConnection, show, onClose }: IModalNewConnectionProps) => {
    const { showToast } = useToast();

    const { connections, addConnection, editConnection, connectionTypes, testConnection } =
      useStoreContext();

    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const formRef = React.useRef<HTMLFormElement>(null);
    const [loadingTestConnection, setLoadingTestConnection] = React.useState(false);

    const { register, handleSubmit, reset, setState, getValue } = useForm<IDataNewConnection>({
      dialect: 'postgres',
      description: '',
      host: '',
      port: '',
      database: '',
      username: '',
      password: '',
    });

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = React.useCallback(
      handleSubmit(async (data) => {
        const connection = {
          ...data,
          port: Number(data.port),
          id_project: idProject || data.id_project,
        };

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

      const connection = {
        ...formValue,
        port: Number(formValue.port),
        id_project: idProject || formValue.id_project,
      };

      try {
        setLoadingTestConnection(true);

        await testConnection(connection);

        showToast({ type: 'success', title: 'Conexão realizada com sucesso' });
      } catch (error) {
        showToast({ type: 'error', title: 'Falha na conexão', description: error.message });
      } finally {
        setLoadingTestConnection(false);
      }
    }, []);

    const loadConnectionEditingData = async () => {
      if (!idConnection) return;

      const connectionSavedData = connections.find((connection) => connection.id === idConnection);

      setState((prevState) => ({ ...prevState, ...connectionSavedData }));
    };

    React.useEffect(() => {
      loadConnectionEditingData();
    }, [idConnection]);

    return (
      <Modal title={idConnection ? 'Editar Conexão' : 'Nova Conexão'} width="500px" show={show}>
        <form id="formNewConnection" onSubmit={onSubmit} ref={formRef}>
          <Row>
            <Input
              autoFocus
              required
              label="Descrição"
              xs={12}
              sm={6}
              md={8}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('description')}
            />
            <Autocomplete
              required
              data={connectionTypes}
              label="Dialeto"
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              xs={12}
              sm={6}
              md={4}
              {...register('dialect')}
            />
            <Input
              required
              label="Host"
              sm={8}
              md={10}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('host')}
            />
            <Input
              required
              label="Porta"
              sm={4}
              md={2}
              type="number"
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('port')}
            />
            <Input
              required
              label="Base de dados"
              md={12}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('database')}
            />
            <Input
              label="Usuário"
              xs={12}
              md={6}
              backgroundColor={colors.fieldBackgroundColor}
              color={colors.fieldColor}
              {...register('username')}
            />
            <Input
              label="Senha"
              type="password"
              xs={12}
              md={6}
              backgroundColor={colors.fieldBackgroundColor}
              color={colors.fieldColor}
              {...register('password')}
            />
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
              Testar
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
              Cancelar
            </Button>

            <Button
              xs={6}
              sm={4}
              md={3}
              type="submit"
              color={colors.saveButtonColor}
              backgroundColor={colors.saveButtonBackgroundColor}
            >
              Salvar
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
  dialect: string;
  host: string;
  port: string | number;
  database: string;
  username?: string;
  password?: string;
}
