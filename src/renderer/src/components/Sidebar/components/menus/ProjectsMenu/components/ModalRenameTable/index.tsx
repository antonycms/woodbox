import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useStoreContext } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { useForm } from '@renderer/hooks/useForm';
import TableInfo from '@renderer/views/TableInfo';
import { getRendererDialect } from '@renderer/database/dialects';

export const ModalRenameTable = React.memo(
  ({ show, idConnection, schema, table, onClose }: IModalRenameTableProps) => {
    const { runSql, loadConnectionInfo, connections } = useStoreContext();
    const { addTab, getTab } = useAppTabContext();
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
    const { register, handleSubmit, setState, reset } = useForm<IDataRenameTable>({ name: '' });

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = handleSubmit(async (data) => {
      const name = data.name?.trim();

      if (!idConnection || !table || !name) return;

      if (name === table) {
        close();
        return;
      }

      try {
        setLoading(true);

        await runSql(
          idConnection,
          `ALTER TABLE ${dialect.getQualifiedName(schema, table)} RENAME TO ${dialect.quoteIdent(
            name,
          )};`,
        );

        await loadConnectionInfo(idConnection);

        const oldTabId = `${idConnection}_${schema}_${table}`;
        const newTabId = `${idConnection}_${schema}_${name}`;

        if (getTab(oldTabId)) {
          addTab({
            replaceId: oldTabId,
            id: newTabId,
            title: `${schema ? `${schema}.` : ''}${name}`,
            data: {
              type: 'table-info',
              id_connection: idConnection,
              schema,
              table: name,
            },
            component: () => (
              <TableInfo id_connection={idConnection} schema={schema} table={name} />
            ),
          });
        }

        showToast({
          type: 'success',
          title: 'Tabela renomeada com sucesso!',
        });

        close();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao renomear tabela.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    });

    React.useEffect(() => {
      if (!show) return;

      setState({ name: table || '' });
    }, [show, table, setState]);

    return (
      <Modal title="Renomear Tabela" width="500px" show={show}>
        <form onSubmit={onSubmit}>
          <Input
            autoFocus
            required
            label="Novo nome da tabela"
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            labelColor={colors.fieldLabelColor}
            disabled={loading}
            md={12}
            {...register('name')}
          />

          <Divider size={4} />

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
              type="submit"
              xs={6}
              sm={4}
              md={3}
            >
              Salvar
            </Button>
          </Row>
        </form>
      </Modal>
    );
  },
);

ModalRenameTable.displayName = 'ModalRenameTable';

export interface IModalRenameTableProps {
  show?: boolean;
  idConnection?: string;
  schema?: string;
  table?: string;
  onClose?: () => void;
}

interface IDataRenameTable {
  name: string;
}
