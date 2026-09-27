import { getErrorMessage } from '@shared/utils/error';
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

export const ModalDeleteSchema = React.memo(
  ({ show, idConnection, schema, onClose }: IModalDeleteSchemaProps) => {
    const t = useI18nStore((state) => state.t);
    const runSql = useDatabaseStore((state) => state.runSql);
    const loadConnectionInfo = useWorkspaceStore((state) => state.loadConnectionInfo);
    const { tabs, removeTab } = useAppTabStore(
      useShallow((state) => ({ tabs: state.tabs, removeTab: state.removeTab })),
    );
    const showToast = useToastStore((state) => state.showToast);
    const { modal: colors } = useThemeStore((state) => state.activeTheme);

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
                data &&
                (data.type === 'table-info' || data.type === 'function-info') &&
                data.id_connection === idConnection &&
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
          title: t('toast.schemaDeleted'),
        });

        close();
      } catch (error: unknown) {
        showToast({
          type: 'error',
          title: t('toast.schemaDeleteError'),
          description: getErrorMessage(error, t('common.unknownError')),
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal width="520px" show={show} title={t('modal.deleteSchema')}>
        <Text userSelect={false} color={colors.color}>{t('message.deleteSchemaQuestion', { schema })}</Text>

        <Divider />

        <label style={{ color: colors.color }}>
          <input
            type="checkbox"
            checked={cascade}
            disabled={loading}
            onChange={(event) => setCascade(event.target.checked)}
          />{' '}
          {t('message.deleteSchemaCascade')}
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

ModalDeleteSchema.displayName = 'ModalDeleteSchema';

export interface IModalDeleteSchemaProps {
  show?: boolean;
  idConnection?: string;
  schema?: string;
  onClose?: () => void;
}

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
