import React from 'react';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import styles from './styles.module.css';

interface IModalDataErrorProps {
  message?: string;
  onClose(): void;
}

const ModalDataError = ({ message, onClose }: IModalDataErrorProps) => {
  const t = useI18nStore((state) => state.t);
  const { feedback, modal: colors } = useThemeStore((state) => state.activeTheme);
  const style = {
    '--errorBorderColor': feedback.errorBorderColor,
    '--errorAccentColor': feedback.errorAccentColor,
    '--errorBackgroundColor': feedback.errorBackgroundColor,
    '--errorMessageBackgroundColor': feedback.errorMessageBackgroundColor,
  } as React.CSSProperties;

  return (
    <Modal
      title={t('modal.dataLoadError')}
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
          {t('common.close')}
        </Button>
      </Row>
    </Modal>
  );
};

export default ModalDataError;
