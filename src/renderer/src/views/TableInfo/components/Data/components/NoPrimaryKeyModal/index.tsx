import React from 'react';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';

interface NoPrimaryKeyModalProps {
  show: boolean;
  applyingChanges: boolean;
  color?: string;
  cancelButtonColor?: string;
  cancelButtonBackgroundColor?: string;
  saveButtonColor?: string;
  saveButtonBackgroundColor?: string;
  onClose: () => void;
  onApplyWithoutPrimaryKey: () => void;
}

export const NoPrimaryKeyModal = ({
  show,
  applyingChanges,
  color,
  cancelButtonColor,
  cancelButtonBackgroundColor,
  saveButtonColor,
  saveButtonBackgroundColor,
  onClose,
  onApplyWithoutPrimaryKey,
}: NoPrimaryKeyModalProps) => {
  const t = useI18nStore((state) => state.t);

  return (
    <Modal
      title={t('message.noPrimaryKeyWarningTitle')}
      width="560px"
      show={show}
      closeOutside={!applyingChanges}
      onClose={applyingChanges ? undefined : onClose}
    >
      <Text color={color}>{t('message.noPrimaryKeyWarning')}</Text>

      <div style={{ height: 16 }} />

      <Text color={color}>{t('message.useAllColumnsQuestion')}</Text>

      <div style={{ height: 16 }} />

      <Row>
        <Spacer />

        <Button
          text
          color={cancelButtonColor}
          backgroundColor={cancelButtonBackgroundColor}
          onClick={onClose}
          disabled={applyingChanges}
          xs={6}
          sm={4}
          md={3}
        >
          {t('settings.customization.cancel')}
        </Button>

        <Button
          color={saveButtonColor}
          backgroundColor={saveButtonBackgroundColor}
          onClick={onApplyWithoutPrimaryKey}
          loading={applyingChanges}
          xs={6}
          sm={5}
          md={4}
        >
          {t('common.useAllColumns')}
        </Button>
      </Row>
    </Modal>
  );
};
