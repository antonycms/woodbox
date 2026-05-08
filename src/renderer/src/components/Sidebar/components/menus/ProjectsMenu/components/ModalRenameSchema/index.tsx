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
import FunctionInfo from '@renderer/views/FunctionInfo';
import TableInfo from '@renderer/views/TableInfo';

export const ModalRenameSchema = React.memo(
  ({ show, idConnection, schema, onClose }: IModalRenameSchemaProps) => {
    const { runSql, loadConnectionInfo } = useStoreContext();
    const { tabs, addTab, activeTabId, setActiveTabId } = useAppTabContext();
    const { showToast } = useToast();
    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const [loading, setLoading] = React.useState(false);
    const { register, handleSubmit, setState, reset } = useForm<IDataRenameSchema>({ name: '' });

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = handleSubmit(async (data) => {
      const name = data.name?.trim();

      if (!idConnection || !schema || !name) return;

      if (name === schema) {
        close();
        return;
      }

      try {
        setLoading(true);

        await runSql(
          idConnection,
          `ALTER SCHEMA ${quoteIdent(schema)} RENAME TO ${quoteIdent(name)};`,
        );
        await loadConnectionInfo(idConnection);

        let nextActiveTabId = activeTabId;
        const tabsToUpdate = tabs.filter((tab) => {
          const { data: tabData } = tab;

          return (
            tabData?.id_connection === idConnection &&
            (tabData.type === 'table-info' || tabData.type === 'function-info') &&
            tabData.schema === schema
          );
        });

        tabsToUpdate.forEach((tab) => {
          const { data: tabData } = tab;

          if (tabData?.type === 'table-info') {
            const newTabId = `${idConnection}_${name}_${tabData.table}`;

            if (tab.id === activeTabId) {
              nextActiveTabId = newTabId;
            }

            addTab({
              replaceId: tab.id,
              id: newTabId,
              title: `${name}.${tabData.table}`,
              subtitle: tab.subtitle,
              unsaved: tab.unsaved,
              data: {
                ...tabData,
                schema: name,
              },
              component: () => (
                <TableInfo
                  id_connection={idConnection}
                  schema={name}
                  table={tabData.table}
                  initialWhere={tabData.initialWhere}
                  filterLocked={tabData.filterLocked}
                  initialTab={tabData.initialTab}
                />
              ),
            });

            return;
          }

          if (tabData?.type === 'function-info') {
            const newTabId = `fn_${idConnection}_${name}_${tabData.function_name}`;

            if (tab.id === activeTabId) {
              nextActiveTabId = newTabId;
            }

            addTab({
              replaceId: tab.id,
              id: newTabId,
              title: `${name}.${tabData.function_name}`,
              subtitle: tab.subtitle,
              unsaved: tab.unsaved,
              data: {
                ...tabData,
                schema: name,
              },
              component: () => (
                <FunctionInfo
                  id_connection={idConnection}
                  schema={name}
                  function_name={tabData.function_name}
                />
              ),
            });
          }
        });

        if (nextActiveTabId) {
          setActiveTabId(nextActiveTabId);
        }

        showToast({
          type: 'success',
          title: 'Schema renomeado com sucesso!',
        });

        close();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao renomear schema.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    });

    React.useEffect(() => {
      if (!show) return;

      setState({ name: schema || '' });
    }, [show, schema, setState]);

    return (
      <Modal title="Renomear Esquema" width="500px" show={show}>
        <form onSubmit={onSubmit}>
          <Input
            autoFocus
            required
            label="Novo nome do schema"
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

ModalRenameSchema.displayName = 'ModalRenameSchema';

export interface IModalRenameSchemaProps {
  show?: boolean;
  idConnection?: string;
  schema?: string;
  onClose?: () => void;
}

interface IDataRenameSchema {
  name: string;
}

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
