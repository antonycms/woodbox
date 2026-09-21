import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { useForm } from '@renderer/hooks/useForm';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useThemeStore } from '@renderer/stores/Theme';

export const ModalNewProject = ({ idProject, show, onClose }: IModalNewProjectProps) => {
  const { projects, addProject, editProject } = useWorkspaceStore(
    useShallow((state) => ({
      projects: state.projects,
      addProject: state.addProject,
      editProject: state.editProject,
    })),
  );
  const { modal: colors } = useThemeStore((state) => state.activeTheme);

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
    <Modal title={idProject ? 'Editar Projeto' : 'Novo Projeto'} width="500px" show={show}>
      <form onSubmit={onSubmit}>
        <Input
          autoFocus
          required
          backgroundColor={colors.fieldBackgroundColor}
          color={colors.fieldColor}
          label="Descrição"
          labelColor={colors.fieldLabelColor}
          md={12}
          {...register('description')}
        />

        <Row>
          <Spacer />

          <Button
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            onClick={close}
            xs={6}
            sm={4}
            md={3}
          >
            Cancelar
          </Button>

          <Button
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
            type="submit"
            xs={6}
            sm={4}
            md={3}
          >
            Salvar
          </Button>
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
