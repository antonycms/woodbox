import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useI18n } from '@renderer/contexts/I18n';
import { useStoreContext } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';

export const ModalDeleteProject = React.memo(
  ({ show, idProject, project, onClose }: IModalDeleteProjectProps) => {
    const { t } = useI18n();
    const { connectionsGroupPerProject, removeProject } = useStoreContext();
    const { tabs, removeTab } = useAppTabContext();
    const { showToast } = useToast();
    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const [loading, setLoading] = React.useState(false);

    const handleConfirm = async () => {
      if (!idProject) return;

      const connectionIds =
        connectionsGroupPerProject
          .find((item) => item.id === idProject)
          ?.connections.map((connection) => connection.id) || [];

      try {
        setLoading(true);

        await removeProject(idProject);

        const connectionIdSet = new Set(connectionIds);
        const tabsToRemove = tabs
          .filter((tab) => {
            if (
              tab.data &&
              'id_connection' in tab.data &&
              connectionIdSet.has(tab.data.id_connection)
            ) {
              return true;
            }

            return connectionIds.some((connectionId) =>
              tab.id.startsWith(`new_table_${connectionId}_`),
            );
          })
          .map((tab) => tab.id);

        if (tabsToRemove.length) {
          removeTab(tabsToRemove, { keepHistory: false });
        }

        showToast({
          type: 'success',
          title: t('toast.projectDeleted'),
        });

        onClose?.();
      } catch (error) {
        showToast({
          type: 'error',
          title: t('toast.projectDeleteError'),
          description: error instanceof Error ? error.message : undefined,
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal width="520px" show={show} title={t('modal.deleteProject')}>
        <Text userSelect={false} color={colors.color}>
          {t('message.deleteProjectQuestion', { project })}
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

ModalDeleteProject.displayName = 'ModalDeleteProject';

export interface IModalDeleteProjectProps {
  show?: boolean;
  idProject?: string;
  project?: string;
  onClose?: () => void;
}
