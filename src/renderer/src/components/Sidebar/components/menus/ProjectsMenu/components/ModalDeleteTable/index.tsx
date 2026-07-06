import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useStoreContext } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { getRendererDialect } from '@renderer/database/dialects';

export const ModalDeleteTable = React.memo(
  ({ show, idConnection, schema, table, onClose }: IModalDeleteTableProps) => {
    const { runSql, loadConnectionInfo, connections } = useStoreContext();
    const { removeTab } = useAppTabContext();
    const { showToast } = useToast();
    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const [loading, setLoading] = React.useState(false);
    const dialect = React.useMemo(
      () =>
        getRendererDialect(
          connections.find((connection) => connection.id === idConnection)?.dialect,
        ),
      [connections, idConnection],
    );
    const tableName = [schema, table].filter(Boolean).join('.');

    const handleConfirm = async () => {
      if (!idConnection || !table) return;

      try {
        setLoading(true);

        await runSql(idConnection, `DROP TABLE ${dialect.getQualifiedName(schema, table)};`);

        removeTab(`${idConnection}_${schema}_${table}`);
        await loadConnectionInfo(idConnection);

        showToast({
          type: 'success',
          title: 'Tabela excluída com sucesso!',
        });

        onClose?.();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao excluir tabela.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal width="520px" show={show} title="Excluir Tabela">
        <Text color={colors.color}>
          Tem certeza que deseja excluir a tabela <strong>"{tableName}"</strong>?
        </Text>

        <Divider />

        <Row>
          <Spacer />

          <Button
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            disabled={loading}
            onClick={onClose}
            xs={6}
            sm={4}
            md={3}
          >
            Cancelar
          </Button>

          <Button
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
            loading={loading}
            onClick={handleConfirm}
            xs={6}
            sm={4}
            md={3}
          >
            Confirmar
          </Button>
        </Row>
      </Modal>
    );
  },
);

ModalDeleteTable.displayName = 'ModalDeleteTable';

export interface IModalDeleteTableProps {
  show?: boolean;
  idConnection?: string;
  schema?: string;
  table?: string;
  onClose?: () => void;
}
