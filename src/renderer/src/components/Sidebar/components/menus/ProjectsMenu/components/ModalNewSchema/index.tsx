import { getErrorMessage } from '@shared/utils/error';
import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { useI18nStore } from '@renderer/stores/I18n';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { useForm } from '@renderer/hooks/useForm';

export const ModalNewSchema = React.memo(
  ({ show, idConnection, onClose }: IModalNewSchemaProps) => {
    const runSql = useDatabaseStore((state) => state.runSql);
    const loadConnectionInfo = useWorkspaceStore((state) => state.loadConnectionInfo);
    const t = useI18nStore((state) => state.t);
    const showToast = useToastStore((state) => state.showToast);
    const { modal: colors } = useThemeStore((state) => state.activeTheme);

    const [loading, setLoading] = React.useState(false);
    const { register, handleSubmit, reset } = useForm<IDataNewSchema>({ name: '' });

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = handleSubmit(async (data) => {
      const name = data.name?.trim();

      if (!idConnection || !name) return;

      try {
        setLoading(true);

        await runSql(idConnection, `CREATE SCHEMA ${quoteIdent(name)};`);
        await loadConnectionInfo(idConnection);

        showToast({
          type: 'success',
          title: t('toast.schemaCreated'),
        });

        close();
      } catch (error: unknown) {
        showToast({
          type: 'error',
          title: t('toast.schemaCreateError'),
          description: getErrorMessage(error, t('common.unknownError')),
          delay: 8000,
        });
      } finally {
        setLoading(false);
      }
    });

    return (
      <Modal title={t('modal.newSchema')} width="500px" show={show}>
        <form onSubmit={onSubmit}>
          <Input
            autoFocus
            required
            label={t('field.schemaName')}
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
              {t('settings.customization.cancel')}
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
              {t('common.save')}
            </Button>
          </Row>
        </form>
      </Modal>
    );
  },
);

ModalNewSchema.displayName = 'ModalNewSchema';

export interface IModalNewSchemaProps {
  show?: boolean;
  idConnection?: string;
  onClose?: () => void;
}

interface IDataNewSchema {
  name: string;
}

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
