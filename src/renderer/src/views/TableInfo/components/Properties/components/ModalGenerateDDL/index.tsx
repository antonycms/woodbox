import React from 'react';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { copyToClipboard } from '@renderer/utils/methods';
import { useToastStore } from '@renderer/stores/Toast';
import { getRendererDialect, type RendererDialect } from '@renderer/database/dialects';
import styles from './styles.module.css';

const ModalGenerateDDL = ({
  show,
  sql,
  dialect = getRendererDialect(),
  onClose,
}: IModalGenerateDDLProps) => {
  const t = useI18nStore((state) => state.t);
  const { modal: colors } = useThemeStore((state) => state.activeTheme);
  const showToast = useToastStore((state) => state.showToast);

  const handleCopy = React.useCallback(() => {
    copyToClipboard(sql);
    onClose?.();
    showToast({ type: 'success', title: t('common.contentCopied') });
  }, [sql, onClose, showToast, t]);

  return (
    <Modal
      title={t('modal.generateDdl')}
      width="900px"
      height="440px"
      show={show}
      closeOutside
      onClose={onClose}
    >
      <div className={styles.editorContainer}>
        <Editor readonly hidePreview dialect={dialect.editorDialect} language="sql" value={sql} />
      </div>

      <Row>
        <Spacer />

        <Button
          text
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          onClick={handleCopy}
          xs={6}
          sm={4}
          md={3}
        >
          {t('common.copy')}
        </Button>
      </Row>
    </Modal>
  );
};

export default ModalGenerateDDL;

interface IModalGenerateDDLProps {
  show?: boolean;
  sql: string;
  dialect?: RendererDialect;
  onClose?(): void;
}
