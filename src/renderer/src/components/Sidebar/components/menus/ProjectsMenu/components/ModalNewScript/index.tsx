import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useForm } from '@renderer/hooks/useForm';
import { useI18n } from '@renderer/contexts/I18n';
import { IScript, useStoreContext } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useAppTabContext } from '@renderer/contexts/AppTab';

export const ModalNewScript = React.memo(
  ({ idScript, idConnection, show, onClose, onNewScriptCreated }: IModalNewScriptProps) => {
    const { t } = useI18n();
    const { updateTab } = useAppTabContext();
    const { addScript, editScript, scripts } = useStoreContext();

    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const { register, handleSubmit, setState, reset } = useForm<IDataNewScript>({ name: '' });

    const close = React.useCallback(() => {
      reset();
      onClose?.();
    }, [reset, onClose]);

    const onSubmit = React.useCallback(
      handleSubmit(async (data) => {
        const name = data.name?.trim();

        if (!name) return;

        if (idScript) {
          await editScript(idScript, { name, updated_at: new Date().toISOString() });
          updateTab(`script_${idScript}`, { title: data.name });
        } else {
          const script = await addScript({
            name,
            id_connection: idConnection,
            content: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          onNewScriptCreated?.(script);
        }

        close();
      }),
      [idScript, idConnection],
    );

    const loadScriptEditingData = async () => {
      if (!idScript) return;

      const scriptSavedData = scripts.find((script) => script.id === idScript);

      setState((prevState) => ({ ...prevState, ...scriptSavedData }));
    };

    React.useEffect(() => {
      loadScriptEditingData();
    }, [idScript]);

    return (
      <Modal
        title={idScript ? t('context.renameScript') : t('context.newSqlScript')}
        width="500px"
        show={show}
      >
        <form id="formNewScript" onSubmit={onSubmit}>
          <Row>
            <Input
              autoFocus
              required
              label={t('field.scriptName')}
              xl={12}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('name')}
            />
          </Row>

          <Divider size={4} />

          <Row>
            <Spacer />

            <Button
              xs={6}
              sm={4}
              md={3}
              onClick={close}
              color={colors.cancelButtonColor}
              backgroundColor={colors.cancelButtonBackgroundColor}
            >
              {t('settings.customization.cancel')}
            </Button>

            <Button
              xs={6}
              sm={4}
              md={3}
              type="submit"
              color={colors.saveButtonColor}
              backgroundColor={colors.saveButtonBackgroundColor}
            >
              {t('common.save')}
            </Button>
          </Row>
        </form>
      </Modal>
    );
  },
);

ModalNewScript.displayName = 'ModalNewScript';

export interface IModalNewScriptProps {
  /**
   * used in edit mode
   */
  idScript?: string;

  idConnection: string;

  show?: boolean;
  onClose?: () => void;
  onNewScriptCreated?(script: IScript): void;
}

interface IDataNewScript {
  name: string;
}
