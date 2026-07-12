import React from 'react';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useThemeContext } from '@renderer/contexts/Theme';

const ModalConfirmDiscardChanges = ({
  show,
  onCancel,
  onConfirm,
}: IModalConfirmDiscardChangesProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  return (
    <Modal
      title="Descartar alterações pendentes"
      width="520px"
      show={show}
      closeOutside
      onClose={onCancel}
    >
      <Text color={colors.color}>
        Esta aba possui alterações pendentes. Ao aplicar o filtro, essas alterações serão perdidas.
      </Text>

      <div style={{ height: 16 }} />

      <Text color={colors.color}>Deseja prosseguir mesmo assim?</Text>

      <div style={{ height: 16 }} />

      <Row>
        <Spacer />

        <Button
          xs={6}
          sm={4}
          md={3}
          onClick={onCancel}
          color={colors.cancelButtonColor}
          backgroundColor={colors.cancelButtonBackgroundColor}
        >
          Cancelar
        </Button>

        <Button
          xs={6}
          sm={4}
          md={3}
          onClick={onConfirm}
          color={colors.saveButtonColor}
          backgroundColor={colors.saveButtonBackgroundColor}
        >
          Prosseguir
        </Button>
      </Row>
    </Modal>
  );
};

interface IModalConfirmDiscardChangesProps {
  show?: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export default ModalConfirmDiscardChanges;
