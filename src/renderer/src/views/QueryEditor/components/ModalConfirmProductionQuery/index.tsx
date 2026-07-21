import React from 'react';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { Dialect } from '@renderer/database/dialects';
import styles from './styles.module.css';

export const ModalConfirmProductionQuery = React.memo(
  ({ show, sql, dialect, onCancel, onConfirm }: IModalConfirmProductionQueryProps) => {
    const { t } = useI18n();
    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    return (
      <Modal
        title={t('modal.confirmProductionOperation')}
        width="900px"
        height="520px"
        show={show}
        closeOutside
        onClose={onCancel}
      >
        <div className={styles.message}>
          <Text color={colors.color}>{t('message.confirmProductionQuery')}</Text>
        </div>

        <div className={styles.editorContainer}>
          <Editor readonly hidePreview dialect={dialect} language="sql" value={sql} />
        </div>

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
            {t('common.execute')}
          </Button>
        </Row>
      </Modal>
    );
  },
);

ModalConfirmProductionQuery.displayName = 'ModalConfirmProductionQuery';

interface IModalConfirmProductionQueryProps {
  show?: boolean;
  sql: string;
  dialect?: Dialect;
  onCancel?(): void;
  onConfirm?(): void;
}
