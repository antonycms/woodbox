import React from 'react';
import { Button } from '@renderer/components/Button';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type { IPendingColumnCreate } from '@renderer/contexts/TableInfoContext';
import { useForm } from '@renderer/hooks/useForm';
import { generateHash } from '@renderer/utils/string';
import { Autocomplete } from '@renderer/components/Autocomplete';
import styles from './styles.module.css';

const defaultForm: IFormData = {
  column_name: '',
  data_type: '',
  column_default: '',
  description: '',
  required: false,
  is_primary_key: false,
  is_unique: false,
};

const ModalNewColumn = ({ show, types, hasPrimaryKey, onClose, onAdd }: IModalNewColumnProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  const { showToast } = useToast();
  const { state, register, handleSubmit, reset, setState } = useForm<IFormData>(defaultForm);

  const typeItems = React.useMemo(() => {
    return types?.length ? types : ['varchar', 'text', 'integer', 'serial', 'boolean'];
  }, [types]);

  const close = React.useCallback(() => {
    reset();
    onClose?.();
  }, [reset, onClose]);

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      const columnName = data.column_name.trim();
      const dataType = data.data_type.trim();

      if (!columnName || !dataType) return;

      if (data.is_unique && data.column_default.trim()) {
        showToast({
          type: 'warn',
          title: 'Coluna única não pode ter valor padrão fixo.',
          description:
            'Em tabelas com dados, o valor padrão seria repetido em várias linhas e a constraint UNIQUE falharia.',
        });
        return;
      }

      const column: IPendingColumnCreate = {
        __pendingId: generateHash(),
        __pendingAction: 'create',
        column_name: columnName,
        data_type: dataType,
        is_nullable: !data.required,
        column_default: data.column_default.trim() || undefined,
        description: data.description.trim() || undefined,
        is_primary_key: data.is_primary_key,
        is_unique: data.is_unique,
      };

      const shouldClose = onAdd?.(column);
      if (shouldClose !== false) close();
    }),
    [handleSubmit, onAdd, close, showToast],
  );

  return (
    <Modal title="Nova coluna" width="440px" show={show} closeOutside onClose={close}>
      <form className={styles.form} onSubmit={onSubmit}>
        <Row>
          <Input
            md={12}
            required
            autoFocus
            label="Nome"
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('column_name')}
          />

          <Autocomplete
            md={12}
            required
            label="Tipo"
            data={typeItems}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('data_type')}
          />
        </Row>

        <Row>
          <Input
            md={12}
            label="Valor Padrão"
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('column_default')}
          />

          <Input
            md={12}
            label="Comentário"
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('description')}
          />
        </Row>

        <div className={styles.checkboxes}>
          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="required"
              checked={state.required}
              onChange={register('required').onChange}
            />
            Obrigatório
          </label>

          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="is_primary_key"
              checked={state.is_primary_key}
              disabled={hasPrimaryKey}
              title={hasPrimaryKey && 'Já existe uma Chave Primária nessa tabela!'}
              onChange={(event) => {
                const checked = event.target.checked;
                setState((prevState) => ({
                  ...prevState,
                  is_primary_key: checked,
                  is_unique: checked ? false : prevState.is_unique,
                }));
              }}
            />
            Chave Primária
          </label>

          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="is_unique"
              checked={state.is_unique}
              onChange={(event) => {
                const checked = event.target.checked;
                setState((prevState) => ({
                  ...prevState,
                  is_unique: checked,
                  is_primary_key: checked ? false : prevState.is_primary_key,
                }));
              }}
            />
            Única
          </label>
        </div>

        <Row>
          <Spacer />

          <Button
            text
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            onClick={close}
            xs={6}
            sm={4}
            md={3}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
            xs={6}
            sm={4}
            md={3}
          >
            Adicionar
          </Button>
        </Row>
      </form>
    </Modal>
  );
};

export default ModalNewColumn;

interface IModalNewColumnProps {
  show?: boolean;
  types: string[];
  hasPrimaryKey?: boolean;
  onClose?(): void;
  onAdd?(column: IPendingColumnCreate): boolean | void;
}

interface IFormData {
  column_name: string;
  data_type: string;
  column_default: string;
  description: string;
  required: boolean;
  is_primary_key: boolean;
  is_unique: boolean;
}
