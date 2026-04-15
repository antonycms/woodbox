import React from 'react';
import { useForm } from '@renderer/hooks/useForm';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useThemeContext } from '@renderer/contexts/Theme';

export const ModalNewScript = ({ show, onConfirm, onClose }: IModalNewScriptProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const { register, handleSubmit, reset } = useForm({ name: '' });

  const close = () => {
    reset();
    onClose?.();
  };

  const onSubmit = handleSubmit(async ({ name }) => {
    if (!name?.trim()) return;
    await onConfirm?.(name.trim());
    reset();
  });

  return (
    <Modal title="Novo Script SQL" width="400px" show={show} closeOutside onClose={close}>
      <form onSubmit={onSubmit}>
        <Input
          required
          autoFocus
          backgroundColor={colors.fieldBackgroundColor}
          color={colors.fieldColor}
          label="Nome do script"
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
            Criar
          </Button>
        </Row>
      </form>
    </Modal>
  );
};

export interface IModalNewScriptProps {
  show?: boolean;
  onConfirm?: (name: string) => Promise<void> | void;
  onClose?: () => void;
}
