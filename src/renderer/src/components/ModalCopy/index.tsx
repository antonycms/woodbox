import React from 'react';
import { IModalProps, Modal } from '@renderer/components/Modal';
import { useForm } from '@renderer/hooks/useForm';
import { Row } from '../Grid';
import { Input } from '../Input';
import { useThemeContext } from '@renderer/contexts/Theme';
import { Select } from '../Select';
import { Button } from '../Button';
import { Spacer } from '../Spacer';

interface IModalCopyProps extends Omit<IModalProps, 'children'> {
  content: string | object;
}

export const ModalCopy = (props: IModalCopyProps) => {
  const { content, onClose, ...modalProps } = props;

  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const attributes = React.useMemo(() => {
    return typeof !content || content !== 'object' ? [] : Object.keys(content);
  }, [content]);

  const { handleSubmit } = useForm({
    separator: '\\n',
    attributes: [],
  });

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      //
    }),
    [],
  );

  return (
    <Modal title="Copiar Conteúdo" {...modalProps}>
      <form onSubmit={onSubmit}>
        <Row>
          <Input label="Separador" backgroundColor={colors.backgroundColor} color={colors.color} />

          {!!attributes.length && (
            <Select
              label="Atributos"
              backgroundColor={colors.backgroundColor}
              color={colors.color}
              items={attributes}
            />
          )}
        </Row>

        <Row>
          <Spacer />

          <Button
            xs={6}
            sm={4}
            md={3}
            onClick={onClose}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            Cancelar
          </Button>

          <Button
            xs={6}
            sm={4}
            md={3}
            type="submit"
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
          >
            Salvar
          </Button>
        </Row>
      </form>
    </Modal>
  );
};
