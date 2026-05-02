import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { AutocompleteMulti } from '@renderer/components/AutocompleteMulti';
import { Button } from '@renderer/components/Button';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { IPendingIndexCreate } from '@renderer/contexts/TableInfoContext';
import { useForm } from '@renderer/hooks/useForm';
import { generateHash } from '@renderer/utils/string';
import styles from './styles.module.css';

const indexMethods = ['btree', 'hash', 'gist', 'gin', 'spgist', 'brin'];

const getGeneratedIndexName = (table: string, columns: string[]) => {
  const columnPart = columns.join('_') || 'columns';
  return `${table}_${columnPart}_idx`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const defaultForm: IFormData = {
  column_names: [],
  index_method: 'btree',
};

const ModalNewIndex = ({ show, table, columns, onClose, onAdd }: IModalNewIndexProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  const { register, handleSubmit, reset } = useForm<IFormData>(defaultForm);

  const close = React.useCallback(() => {
    reset();
    onClose?.();
  }, [reset, onClose]);

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      const columnNames = data.column_names.filter(Boolean);
      const indexMethod = data.index_method || 'btree';

      if (!columnNames.length) return;

      const index: IPendingIndexCreate = {
        __pendingId: generateHash(),
        __pendingAction: 'create',
        index_name: getGeneratedIndexName(table, columnNames),
        index_method: indexMethod,
        is_unique: false,
        is_primary: false,
        is_valid: true,
        column_names: columnNames,
      };

      const shouldClose = onAdd?.(index);
      if (shouldClose !== false) close();
    }),
    [handleSubmit, onAdd, close, table],
  );

  return (
    <Modal title="Novo índice" width="440px" show={show} closeOutside onClose={close}>
      <form className={styles.form} onSubmit={onSubmit}>
        <Row>
          <AutocompleteMulti
            md={12}
            required
            label="Colunas"
            data={columns}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('column_names')}
          />

          <Autocomplete
            md={12}
            required
            label="Método"
            data={indexMethods}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('index_method')}
          />
        </Row>

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

export default ModalNewIndex;

interface IModalNewIndexProps {
  show?: boolean;
  table: string;
  columns: string[];
  onClose?(): void;
  onAdd?(index: IPendingIndexCreate): boolean | void;
}

interface IFormData {
  column_names: string[];
  index_method: string;
}
