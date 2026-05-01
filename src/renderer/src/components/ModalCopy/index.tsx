import React from 'react';
import { IModalProps, Modal } from '@renderer/components/Modal';
import { useForm } from '@renderer/hooks/useForm';
import { Row } from '../Grid';
import { Input } from '../Input';
import { useThemeContext } from '@renderer/contexts/Theme';
import { Button } from '../Button';
import { Spacer } from '../Spacer';
import { AutocompleteMulti } from '../AutocompleteMulti';

interface IModalCopyProps extends Omit<IModalProps, 'children'> {
  content: any[];
}

export const ModalCopy = (props: IModalCopyProps) => {
  const { content, onClose, ...modalProps } = props;

  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const attributes = React.useMemo(() => {
    if (!Array.isArray(content) || !content.length) return [];
    return Object.keys(content[0]).filter((key) => !key.startsWith('__'));
  }, [content]);

  const { handleSubmit, register } = useForm({
    separator: '\\n',
    attributes: attributes,
  });

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      const separator = data.separator.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      const activeAttributes: string[] = data.attributes?.length ? data.attributes : attributes;

      const text = content
        .map((row) => activeAttributes.map((attr) => row[attr] ?? '').join(separator))
        .join('\n');

      navigator.clipboard.writeText(text);
      onClose?.();
    }),
    [content, attributes, onClose],
  );

  return (
    <Modal title="Copiar Conteúdo" {...modalProps}>
      <form onSubmit={onSubmit}>
        <Row>
          <Input
            label="Separador"
            backgroundColor={colors.backgroundColor}
            color={colors.color}
            {...register('separator')}
          />

          {!!attributes.length && (
            <AutocompleteMulti
              label="Atributos"
              backgroundColor={colors.backgroundColor}
              color={colors.color}
              data={attributes}
              {...register('attributes')}
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
