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

export const ModalDeleteSchema = React.memo(
  ({ show, idConnection, schema, onClose }: IModalDeleteSchemaProps) => {
    const { runSql, loadConnectionInfo } = useStoreContext();
    const { tabs, removeTab } = useAppTabContext();
    const { showToast } = useToast();
    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const [cascade, setCascade] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const close = React.useCallback(() => {
      setCascade(false);
      onClose?.();
    }, [onClose]);

    const handleConfirm = async () => {
      if (!idConnection || !schema) return;

      try {
        setLoading(true);

        await runSql(
          idConnection,
          `DROP SCHEMA ${quoteIdent(schema)}${cascade ? ' CASCADE' : ''};`,
        );

        if (cascade) {
          const tabsToRemove = tabs
            .filter((tab) => {
              const { data } = tab;

              return (
                data?.id_connection === idConnection &&
                (data.type === 'table-info' || data.type === 'function-info') &&
                data.schema === schema
              );
            })
            .map((tab) => tab.id);

          if (tabsToRemove.length) {
            removeTab(tabsToRemove);
          }
        }

        await loadConnectionInfo(idConnection);

        showToast({
          type: 'success',
          title: 'Schema excluído com sucesso!',
        });

        close();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao excluir schema.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal width="520px" show={show} title="Excluir Schema">
        <Text color={colors.color}>
          Tem certeza que deseja excluir o schema <strong>"{schema}"</strong>?
        </Text>

        <Divider />

        <label style={{ color: colors.color }}>
          <input
            type="checkbox"
            checked={cascade}
            disabled={loading}
            onChange={(event) => setCascade(event.target.checked)}
          />{' '}
          Excluir também objetos dentro do schema (CASCADE)
        </label>

        <Divider />

        <Row>
          <Spacer />

          <Button
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            disabled={loading}
            onClick={close}
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

ModalDeleteSchema.displayName = 'ModalDeleteSchema';

export interface IModalDeleteSchemaProps {
  show?: boolean;
  idConnection?: string;
  schema?: string;
  onClose?: () => void;
}

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
