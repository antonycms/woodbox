import React from 'react';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

interface IModalDataErrorProps {
  message?: string;
  onClose(): void;
}

const ModalDataError = ({ message, onClose }: IModalDataErrorProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  return (
    <Modal
      title="Erro ao carregar dados"
      width="640px"
      show={!!message}
      closeOutside
      onClose={onClose}
    >
      <div className={styles.errorCard}>
        <div className={styles.errorMessage}>
          <Text color="#ffe1e1">{message}</Text>
        </div>
      </div>

      <Row>
        <Spacer />
        <Button
          color={colors.cancelButtonColor}
          backgroundColor={colors.cancelButtonBackgroundColor}
          onClick={onClose}
          xs={6}
          sm={4}
          md={3}
        >
          Fechar
        </Button>
      </Row>
    </Modal>
  );
};

export default ModalDataError;
