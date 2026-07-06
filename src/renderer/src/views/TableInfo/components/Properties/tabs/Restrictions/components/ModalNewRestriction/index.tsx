import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { AutocompleteMulti } from '@renderer/components/AutocompleteMulti';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { IPendingRestrictionCreate } from '@renderer/contexts/TableInfoContext';
import { useForm } from '@renderer/hooks/useForm';
import { generateHash } from '@renderer/utils/string';
import { getRendererDialect, type RendererDialect } from '@renderer/database/dialects';
import styles from './styles.module.css';

type RestrictionType = 'primary_key' | 'unique_key' | 'check';

const restrictionTypes: { label: string; value: RestrictionType }[] = [
  { label: 'Chave Primária', value: 'primary_key' },
  { label: 'Única', value: 'unique_key' },
  { label: 'Check', value: 'check' },
];

const getGeneratedConstraintName = (
  table: string,
  type: RestrictionType,
  columns: string[],
  expression: string,
) => {
  const suffix = type === 'primary_key' ? 'pk' : type === 'unique_key' ? 'unique' : 'check';
  const base = columns.length ? columns.join('_') : expression.slice(0, 24) || 'expression';

  return `${table}_${base}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const defaultForm: IFormData = {
  constraint_type: 'primary_key',
  column_names: [],
  expression: '',
};

const ModalNewRestriction = ({
  show,
  table,
  columns,
  hasPrimaryKey,
  onClose,
  onAdd,
  dialect = getRendererDialect(),
}: IModalNewRestrictionProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  const { state, register, handleSubmit, reset, setState } = useForm<IFormData>(defaultForm);
  const usesColumns = state.constraint_type !== 'check';

  const close = React.useCallback(() => {
    reset();
    onClose?.();
  }, [reset, onClose]);

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      const columnNames = data.column_names.filter(Boolean);
      const expression = data.expression.trim();

      if (data.constraint_type !== 'check' && !columnNames.length) return;
      if (data.constraint_type === 'check' && !expression) return;

      const restriction: IPendingRestrictionCreate = {
        __pendingId: generateHash(),
        __pendingAction: 'create',
        constraint_name: getGeneratedConstraintName(
          table,
          data.constraint_type,
          columnNames,
          expression,
        ),
        constraint_type: data.constraint_type,
        column_names: data.constraint_type === 'check' ? [] : columnNames,
        expression: data.constraint_type === 'check' ? expression : undefined,
      };

      const shouldClose = onAdd?.(restriction);
      if (shouldClose !== false) close();
    }),
    [handleSubmit, onAdd, close, table],
  );

  return (
    <Modal title="Nova restrição" width="520px" show={show} closeOutside onClose={close}>
      <form className={styles.form} onSubmit={onSubmit}>
        <Row>
          <Autocomplete
            md={12}
            required
            label="Tipo"
            data={restrictionTypes}
            extractLabel={(item) => item.label}
            extractValue={(item) => item.value}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('constraint_type')}
            onChange={({ name, value }) => {
              setState((prevState) => ({
                ...prevState,
                [name!]: value as RestrictionType,
                column_names: [],
                expression: '',
              }));
            }}
          />

          {usesColumns && (
            <AutocompleteMulti
              md={12}
              required
              label="Colunas"
              data={columns}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('column_names')}
            />
          )}
        </Row>

        {state.constraint_type === 'check' && (
          <div style={{ height: 160, marginBottom: 12 }}>
            <Editor
              hidePreview
              dialect={dialect.editorDialect}
              language="sql"
              value={state.expression}
              onChange={(value) => setState((prevState) => ({ ...prevState, expression: value }))}
            />
          </div>
        )}

        {state.constraint_type === 'primary_key' && hasPrimaryKey && (
          <p style={{ color: colors.color, margin: '0 0 12px' }}>
            Já existe uma Chave Primária nessa tabela.
          </p>
        )}

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
            disabled={state.constraint_type === 'primary_key' && hasPrimaryKey}
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

export default ModalNewRestriction;

interface IModalNewRestrictionProps {
  show?: boolean;
  table: string;
  columns: string[];
  hasPrimaryKey?: boolean;
  dialect?: RendererDialect;
  onClose?(): void;
  onAdd?(restriction: IPendingRestrictionCreate): boolean | void;
}

interface IFormData {
  constraint_type: RestrictionType;
  column_names: string[];
  expression: string;
}
