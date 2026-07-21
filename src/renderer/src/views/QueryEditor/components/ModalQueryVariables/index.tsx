import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useForm } from '@renderer/hooks/useForm';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';

const EMPTY_INITIAL_VALUES: Record<string, string> = {};

interface IModalQueryVariablesProps {
  show?: boolean;
  variables: string[];
  initialValues?: Record<string, string>;
  onCancel(): void;
  onExecute(values: Record<string, string>): void;
}

export const ModalQueryVariables = React.memo(
  ({
    show,
    variables,
    initialValues = EMPTY_INITIAL_VALUES,
    onCancel,
    onExecute,
  }: IModalQueryVariablesProps) => {
    const { t } = useI18n();
    const {
      activeTheme: { modal: colors },
    } = useThemeContext();

    const { register, handleSubmit, setState, reset } = useForm<Record<string, string>>({});

    const onSubmit = React.useCallback(
      handleSubmit((data) => {
        onExecute(data);
      }),
      [handleSubmit, onExecute],
    );

    React.useEffect(() => {
      if (!show) {
        reset();
        return;
      }

      setState(
        variables.reduce<Record<string, string>>((state, variable) => {
          state[variable] = initialValues[variable] ?? '';
          return state;
        }, {}),
      );
    }, [show, variables, initialValues, reset, setState]);

    return (
      <Modal title={t('modal.queryVariables')} width="520px" show={show}>
        <form onSubmit={onSubmit}>
          <Row>
            {variables.map((variable, index) => (
              <Input
                key={variable}
                autoFocus={index === 0}
                label={variable}
                xl={12}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                {...register(variable)}
              />
            ))}
          </Row>

          <Divider size={4} />

          <Row>
            <Spacer />

            <Button
              xs={6}
              sm={4}
              md={3}
              onClick={onCancel}
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
              {t('common.execute')}
            </Button>
          </Row>
        </form>
      </Modal>
    );
  },
);

ModalQueryVariables.displayName = 'ModalQueryVariables';
