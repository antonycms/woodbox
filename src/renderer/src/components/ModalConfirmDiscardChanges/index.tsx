import React from 'react';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';

const ModalConfirmDiscardChanges = ({
  show,
  message,
  onCancel,
  onConfirm,
}: IModalConfirmDiscardChangesProps) => {
  const t = useI18nStore((state) => state.t);
  const { modal: colors } = useThemeStore((state) => state.activeTheme);

  return (
    <Modal
      title={t('modal.discardPendingChanges')}
      width="520px"
      show={show}
      closeOutside
      onClose={onCancel}
    >
      <Text color={colors.color}>{message || t('message.discardPendingChanges')}</Text>

      <div style={{ height: 16 }} />

      <Text color={colors.color}>{t('modal.confirmProceed')}</Text>

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
          {t('settings.customization.cancel')}
        </Button>

        <Button
          xs={6}
          sm={4}
          md={3}
          onClick={onConfirm}
          color={colors.saveButtonColor}
          backgroundColor={colors.saveButtonBackgroundColor}
        >
          {t('common.proceed')}
        </Button>
      </Row>
    </Modal>
  );
};

interface IModalConfirmDiscardChangesProps {
  show?: boolean;
  message?: string;
  onCancel(): void;
  onConfirm(): void;
}

export default ModalConfirmDiscardChanges;
