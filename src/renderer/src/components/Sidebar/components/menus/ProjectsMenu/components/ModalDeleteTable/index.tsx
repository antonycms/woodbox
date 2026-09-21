import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useAppTabStore } from '@renderer/stores/AppTab';
import { useI18nStore } from '@renderer/stores/I18n';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { getRendererDialect } from '@renderer/database/dialects';

export const ModalDeleteTable = React.memo(
  ({ show, idConnection, schema, table, onClose }: IModalDeleteTableProps) => {
    const t = useI18nStore((state) => state.t);
    const runSql = useDatabaseStore((state) => state.runSql);
    const { loadConnectionInfo, connections } = useWorkspaceStore(
      useShallow((state) => ({
        loadConnectionInfo: state.loadConnectionInfo,
        connections: state.connections,
      })),
    );
    const { tabs, removeTab } = useAppTabStore(
      useShallow((state) => ({ tabs: state.tabs, removeTab: state.removeTab })),
    );
    const showToast = useToastStore((state) => state.showToast);
    const { modal: colors } = useThemeStore((state) => state.activeTheme);

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

        const tabsToRemove = tabs
          .filter((tab) => {
            const { data } = tab;

            return (
              data?.type === 'table-info' &&
              data.id_connection === idConnection &&
              data.schema == schema &&
              data.table === table
            );
          })
          .map((tab) => tab.id);

        if (tabsToRemove.length) {
          removeTab(tabsToRemove, { keepHistory: false, force: true });
        }

        await loadConnectionInfo(idConnection);

        showToast({
          type: 'success',
          title: t('toast.tableDeleted'),
        });

        onClose?.();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: t('toast.tableDeleteError'),
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal width="520px" show={show} title={t('modal.deleteTable')}>
        <Text userSelect={false} color={colors.color}>{t('message.deleteTableQuestion', { table: tableName })}</Text>

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
            {t('settings.customization.cancel')}
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
            {t('common.confirm')}
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
