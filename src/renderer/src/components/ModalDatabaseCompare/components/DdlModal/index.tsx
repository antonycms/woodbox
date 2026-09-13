import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import Editor from '@renderer/components/Editor';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { copyToClipboard } from '@renderer/utils/methods';
import type { IDdlModalProps } from '../../types';
import styles from './styles.module.css';

export const DdlModal = React.memo(({ item, title, onClose }: IDdlModalProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const ddl = item?.ddl || '';

  const copyDdl = React.useCallback(() => {
    if (!ddl) return;

    copyToClipboard(ddl);
    showToast({ type: 'success', title: t('common.contentCopied') });
  }, [ddl, showToast, t]);

  return (
    <Modal
      show={!!item}
      closeOutside
      width="840px"
      height="640px"
      title={item ? `${t('databaseCompare.ddlTitle')} — ${title || item.label || ''}` : ''}
      onClose={onClose}
    >
      <div className={styles.ddlModalContent}>
        <Text small color={colors.color} userSelect={false}>
          {t('databaseCompare.generatedDdl')}
        </Text>

        <div className={styles.editorWrap}>
          <Editor value={ddl} readonly hidePreview language="sql" />
        </div>

        {!!item?.rollbackDdl && (
          <>
            <Divider />
            <Text small color={colors.color} userSelect={false}>
              {t('databaseCompare.rollbackDdl')}
            </Text>
            <pre className={styles.rollback} style={{ color: colors.color }}>
              {item.rollbackDdl}
            </pre>
          </>
        )}

        <Row>
          <Button
            text
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            onClick={copyDdl}
            disabled={!ddl.trim()}
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
            xs={6}
            sm={4}
            md={3}
          >
            {t('common.close')}
          </Button>
        </Row>
      </div>
    </Modal>
  );
});

DdlModal.displayName = 'DdlModal';
