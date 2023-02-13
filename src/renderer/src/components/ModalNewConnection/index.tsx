import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useForm } from '@renderer/hooks/useForm';
import { Select } from '../Select';
import { useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import { Form } from '../Form';
import { useThemeContext } from '@renderer/contexts/Theme';

export const ModalNewConnection = React.memo(
  ({ idProject, idConnection, show, onClose }: IModalNewConnectionProps) => {
    const { showToast } = useToast();
    const { connections, addConnection, editConnection, connectionTypes, testConnection } =
      useStoreContext();
    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const [loadingTestConnection, setLoadingTestConnection] = React.useState(false);
    const { register, handleSubmit, reset, setState, state } = useForm<IDataNewConnection>({
      dialect: 'postgres',
      description: '',
      host: '',
      port: '',
      database: '',
      username: '',
      password: '',
    });

    const close = () => {
      reset();
      onClose?.();
    };

    const onSubmit = handleSubmit(async (data) => {
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
    });

    const checkConnection = async () => {
      const connection = {
        ...state,
        port: Number(state.port),
        id_project: idProject || state.id_project,
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
    };

    const loadConnectionEditingData = async () => {
      if (!idConnection) return;

      const connectionSavedData = connections.find((connection) => connection.id === idConnection);

      setState((prevState) => ({ ...prevState, ...connectionSavedData }));
    };

    React.useEffect(() => {
      loadConnectionEditingData();
    }, [idConnection]);

    return (
      <Modal title="Nova Conexão" width="500px" show={show}>
        <Form id="formNewConnection" onSubmit={onSubmit}>
          <Row>
            <Input
              required
              label="Descrição"
              xs={12}
              sm={6}
              md={8}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('description')}
            />
            <Select
              required
              label="Dialeto"
              xs={12}
              sm={6}
              md={4}
              items={connectionTypes}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
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
        </Form>

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
            form="formNewConnection"
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
          >
            Salvar
          </Button>
        </Row>
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
