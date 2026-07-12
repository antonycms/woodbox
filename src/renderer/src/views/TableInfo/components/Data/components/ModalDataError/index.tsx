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
    activeTheme: { __colors, modal: colors },
  } = useThemeContext();
  const style = {
    '--errorBorderColor': __colors.redDeep,
    '--errorAccentColor': __colors.red,
    '--errorBackgroundColor': __colors.darkLight,
    '--errorMessageBackgroundColor': __colors.darkLight,
  } as React.CSSProperties;

  return (
    <Modal
      title="Erro ao carregar dados"
      width="640px"
      show={!!message}
      closeOutside
      onClose={onClose}
    >
      <div className={styles.errorCard} style={style}>
        <div className={styles.errorMessage}>
          <Text color={colors.color}>{message}</Text>
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
