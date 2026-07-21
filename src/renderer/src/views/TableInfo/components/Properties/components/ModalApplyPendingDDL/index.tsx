import React from 'react';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { copyToClipboard } from '@renderer/utils/methods';
import { getRendererDialect, type RendererDialect } from '@renderer/database/dialects';
import styles from './styles.module.css';

const ModalApplyPendingDDL = ({
  show,
  sql,
  applying,
  onClose,
  onApply,
  dialect = getRendererDialect(),
}: IModalApplyPendingDDLProps) => {
  const { t } = useI18n();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  const { showToast } = useToast();
  const [editableSql, setEditableSql] = React.useState(sql);

  React.useEffect(() => {
    setEditableSql(sql);
  }, [sql]);

  const handleCopy = React.useCallback(() => {
    copyToClipboard(editableSql);
    showToast({ type: 'success', title: t('common.contentCopied') });
  }, [editableSql, showToast, t]);

  return (
    <Modal
      title={t('modal.pendingChanges')}
      width="900px"
      height="520px"
      show={show}
      closeOutside={!applying}
      onClose={applying ? undefined : onClose}
    >
      <div className={styles.editorContainer}>
        <Editor
          hidePreview
          dialect={dialect.editorDialect}
          language="sql"
          value={editableSql}
          onChange={setEditableSql}
        />
      </div>

      <Row>
        <Button
          text
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          onClick={handleCopy}
          disabled={applying || !editableSql.trim()}
          xs={6}
          sm={4}
          md={3}
        >
          {t('common.copy')}
        </Button>

        <Spacer />

        <Button
          text
          color={colors.cancelButtonColor}
          backgroundColor={colors.cancelButtonBackgroundColor}
          onClick={onClose}
          disabled={applying}
          xs={6}
          sm={4}
          md={3}
        >
          {t('settings.customization.cancel')}
        </Button>

        <Button
          color={colors.saveButtonColor}
          backgroundColor={colors.saveButtonBackgroundColor}
          onClick={() => onApply?.(editableSql)}
          loading={applying}
          disabled={!editableSql.trim()}
          xs={6}
          sm={4}
          md={3}
        >
          {t('common.apply')}
        </Button>
      </Row>
    </Modal>
  );
};

export default ModalApplyPendingDDL;

interface IModalApplyPendingDDLProps {
  show?: boolean;
  sql: string;
  applying?: boolean;
  onClose?(): void;
  dialect?: RendererDialect;
  onApply?(sql: string): void;
}
