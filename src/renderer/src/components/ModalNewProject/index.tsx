import React from 'react';
import { useForm } from '@renderer/hooks/useForm';
import { Button } from '../Button';
import { Column, Row } from '../Grid';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { Spacer } from '../Spacer';
import { useStoreContext } from '@renderer/contexts/Store';

export const ModalNewProject = ({ idProject, show, onClose }: IModalNewProjectProps) => {
  const { projects, addProject, editProject } = useStoreContext();
  const { register, handleSubmit, reset, setState } = useForm({ description: '' });

  const close = () => {
    reset();
    onClose?.();
  };

  const onSubmit = handleSubmit(async (data) => {
    if (idProject) {
      await editProject(idProject, data);
    } //
    else {
      await addProject(data);
    }

    close();
  });

  const loadConnectionEditingData = async () => {
    if (!idProject) return;

    const connectionSavedData = projects.find((project) => project.id === idProject);

    setState((prevState) => ({ ...prevState, ...connectionSavedData }));
  };

  React.useEffect(() => {
    loadConnectionEditingData();
  }, [idProject]);

  return (
    <Modal title="Novo Projeto" width="500px" show={show}>
      <form onSubmit={onSubmit}>
        <Row>
          <Column md={12}>
            <Input required label="Descrição" {...register('description')} />
          </Column>
        </Row>

        <Row>
          <Spacer />

          <Column xs={6} sm={4} md={3}>
            <Button color="dark" backgroundColor="red" onClick={close}>
              Cancelar
            </Button>
          </Column>

          <Column xs={6} sm={4} md={3}>
            <Button color="dark" backgroundColor="green" type="submit">
              Salvar
            </Button>
          </Column>
        </Row>
      </form>
    </Modal>
  );
};

export interface IModalNewProjectProps {
  show?: boolean;
  onClose?: () => void;
  idProject?: string;
}
