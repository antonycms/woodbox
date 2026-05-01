import React from 'react';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { copyToClipboard } from '@renderer/utils/methods';
import styles from './styles.module.css';

const ModalApplyPendingDDL = ({
  show,
  sql,
  applying,
  onClose,
  onApply,
}: IModalApplyPendingDDLProps) => {
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
    showToast({ type: 'success', title: 'Conteudo copiado com sucesso!' });
  }, [editableSql, showToast]);

  return (
    <Modal
      title="Alterações pendentes"
      width="900px"
      height="520px"
      show={show}
      closeOutside={!applying}
      onClose={applying ? undefined : onClose}
    >
      <div className={styles.editorContainer}>
        <Editor
          hidePreview
          dialect="postgres"
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
          Copiar
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
          Cancelar
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
          Aplicar
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
  onApply?(sql: string): void;
}
