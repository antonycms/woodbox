import React from 'react';
import { useForm } from '@renderer/hooks/useForm';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useThemeContext } from '@renderer/contexts/Theme';

export const ModalRename = ({
  show,
  name,
  onConfirm,
  onClose,
  title = 'Renomear',
}: IModalRenameProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const { register, handleSubmit, setState } = useForm({ name: '' });

  React.useEffect(() => {
    setState({ name: name || '' });
  }, [name]);

  const close = () => {
    onClose?.();
  };

  const onSubmit = handleSubmit(async ({ name }) => {
    if (!name?.trim()) return;
    await onConfirm?.(name.trim());
  });

  return (
    <Modal width="400px" closeOutside show={show} title={title} onClose={close}>
      <form onSubmit={onSubmit}>
        <Input
          required
          autoFocus
          backgroundColor={colors.fieldBackgroundColor}
          color={colors.fieldColor}
          label="Nome"
          labelColor={colors.fieldLabelColor}
          md={12}
          {...register('name')}
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

export interface IModalRenameProps {
  show?: boolean;
  title?: string;
  name?: string;
  onConfirm?: (name: string) => Promise<void> | void;
  onClose?: () => void;
}
