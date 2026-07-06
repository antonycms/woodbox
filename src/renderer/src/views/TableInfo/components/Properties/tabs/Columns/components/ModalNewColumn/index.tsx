import React from 'react';
import { Button } from '@renderer/components/Button';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import {
  type IColumnInfo,
  type IColumnRestrictionsInfo,
  type ITable,
  useStoreContext,
} from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type {
  IPendingColumnCreate,
  IPendingReferenceCreate,
} from '@renderer/contexts/TableInfoContext';
import { useForm } from '@renderer/hooks/useForm';
import { generateHash } from '@renderer/utils/string';
import { Autocomplete } from '@renderer/components/Autocomplete';
import styles from './styles.module.css';

interface ITableOption extends ITable {
  label: string;
  value: string;
}

interface IReferenceColumnOption {
  label: string;
  value: string;
  constraintType: string;
  column?: IColumnInfo;
}

const getGeneratedForeignKeyName = (table: string, column: string, referenceTable: string) => {
  return `${table}_${column}_${referenceTable}_fk`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const mysqlAutoIncrementTypes = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint']);

const isAutoIncrementType = (dataType: string) => {
  const normalizedDataType = dataType.trim().toLowerCase().split('(')[0];

  return mysqlAutoIncrementTypes.has(normalizedDataType);
};

const defaultForm: IFormData = {
  column_name: '',
  data_type: '',
  column_default: '',
  description: '',
  required: false,
  is_primary_key: false,
  is_unique: false,
  is_auto_increment: false,
  is_foreign_key: false,
  reference_table: '',
  reference_column_name: '',
};

const ModalNewColumn = ({
  show,
  idConnection,
  table,
  types,
  tables,
  hasPrimaryKey,
  supportsAutoIncrement,
  onClose,
  onAdd,
}: IModalNewColumnProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  const { getTableColumns, getTableRestrictions } = useStoreContext();
  const { showToast } = useToast();
  const { state, register, handleSubmit, reset, setState } = useForm<IFormData>(defaultForm);
  const [referenceRestrictions, setReferenceRestrictions] = React.useState<
    IColumnRestrictionsInfo[]
  >([]);
  const [referenceColumns, setReferenceColumns] = React.useState<IColumnInfo[]>([]);
  const [loadingRestrictions, setLoadingRestrictions] = React.useState(false);

  const typeItems = React.useMemo(() => {
    return types?.length ? types : ['varchar', 'text', 'integer', 'serial', 'boolean'];
  }, [types]);

  const tableOptions = React.useMemo<ITableOption[]>(() => {
    return (tables || []).map((item) => {
      const label = item.table_schema ? `${item.table_schema}.${item.table_name}` : item.table_name;

      return {
        ...item,
        label,
        value: label,
      };
    });
  }, [tables]);

  const selectedReferenceTable = React.useMemo(() => {
    return tableOptions.find((item) => item.value === state.reference_table);
  }, [tableOptions, state.reference_table]);

  const referenceColumnOptions = React.useMemo<IReferenceColumnOption[]>(() => {
    const referenceColumnsByName = new Map(
      referenceColumns.map((column) => [column.column_name, column]),
    );

    return referenceRestrictions
      .filter((restriction) => ['primary_key', 'unique_key'].includes(restriction.constraint_type))
      .flatMap((restriction) =>
        (restriction.column_names || []).map((columnName) => ({
          label:
            restriction.constraint_type === 'primary_key'
              ? `${columnName} (PK)`
              : `${columnName} (Unique)`,
          value: columnName,
          constraintType: restriction.constraint_type,
          column: referenceColumnsByName.get(columnName),
        })),
      );
  }, [referenceColumns, referenceRestrictions]);

  const close = React.useCallback(() => {
    reset();
    setReferenceRestrictions([]);
    setReferenceColumns([]);
    onClose?.();
  }, [reset, onClose]);

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      const columnName = data.column_name.trim();
      const dataType = data.data_type.trim();

      if (!columnName || !dataType) return;
      if (data.is_foreign_key && (!selectedReferenceTable || !data.reference_column_name)) return;

      if (data.is_unique && data.column_default.trim()) {
        showToast({
          type: 'warn',
          title: 'Coluna única não pode ter valor padrão fixo.',
          description:
            'Em tabelas com dados, o valor padrão seria repetido em várias linhas e a constraint UNIQUE falharia.',
        });
        return;
      }

      if (data.is_auto_increment && !isAutoIncrementType(dataType)) {
        showToast({
          type: 'warn',
          title: 'Auto increment inválido para esse tipo.',
          description: 'Use tinyint, smallint, mediumint, int, integer ou bigint.',
        });
        return;
      }

      if (data.is_auto_increment && !data.is_primary_key && !data.is_unique) {
        showToast({
          type: 'warn',
          title: 'Auto increment precisa de índice.',
          description: 'Marque Chave Primária ou Única.',
        });
        return;
      }

      const column: IPendingColumnCreate = {
        __pendingId: generateHash(),
        __pendingAction: 'create',
        column_name: columnName,
        data_type: dataType,
        is_nullable: data.is_auto_increment ? false : !data.required,
        column_default: data.is_auto_increment ? undefined : data.column_default.trim() || undefined,
        is_auto_increment: data.is_auto_increment,
        description: data.description.trim() || undefined,
      };

      const reference: IPendingReferenceCreate | undefined = data.is_foreign_key
        ? {
            __pendingId: generateHash(),
            __pendingAction: 'create',
            constraint_name: getGeneratedForeignKeyName(
              table,
              columnName,
              selectedReferenceTable!.table_name,
            ),
            table_schema: '',
            table_name: table,
            column_name: columnName,
            reference_table_schema: selectedReferenceTable!.table_schema || '',
            reference_table_name: selectedReferenceTable!.table_name,
            reference_column_name: data.reference_column_name,
          }
        : undefined;

      const shouldClose = onAdd?.(column, {
        constraintType: data.is_primary_key
          ? 'primary_key'
          : data.is_unique
          ? 'unique_key'
          : undefined,
        reference,
      });
      if (shouldClose !== false) close();
    }),
    [handleSubmit, onAdd, close, showToast, selectedReferenceTable, table],
  );

  React.useEffect(() => {
    if (!show || !state.is_foreign_key || !selectedReferenceTable) {
      setReferenceRestrictions([]);
      setReferenceColumns([]);
      return;
    }

    let ignore = false;

    const load = async () => {
      try {
        setLoadingRestrictions(true);
        const [restrictions, columns] = await Promise.all([
          getTableRestrictions(idConnection, {
            schema: selectedReferenceTable.table_schema || '',
            table: selectedReferenceTable.table_name,
          }),
          getTableColumns(idConnection, {
            schema: selectedReferenceTable.table_schema || '',
            table: selectedReferenceTable.table_name,
          }),
        ]);

        if (!ignore) {
          setReferenceRestrictions(restrictions || []);
          setReferenceColumns(columns || []);
        }
      } finally {
        if (!ignore) setLoadingRestrictions(false);
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [
    getTableColumns,
    getTableRestrictions,
    idConnection,
    selectedReferenceTable,
    show,
    state.is_foreign_key,
  ]);

  React.useEffect(() => {
    if (!referenceColumnOptions.length) return;

    const primaryKeyOption = referenceColumnOptions.find(
      (option) => option.constraintType === 'primary_key',
    );
    const defaultOption =
      primaryKeyOption || (referenceColumnOptions.length === 1 ? referenceColumnOptions[0] : null);

    if (!defaultOption || state.reference_column_name) return;

    setState((prevState) => ({ ...prevState, reference_column_name: defaultOption.value }));
  }, [referenceColumnOptions, setState, state.reference_column_name]);

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
            disabled={state.is_auto_increment}
            title={
              state.is_auto_increment ? 'Auto increment não permite valor padrão.' : undefined
            }
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
              title={hasPrimaryKey ? 'Já existe uma Chave Primária nessa tabela!' : undefined}
              onChange={(event) => {
                const checked = event.target.checked;
                setState((prevState) => ({
                  ...prevState,
                  is_primary_key: checked,
                  is_unique: checked ? false : prevState.is_unique,
                  is_auto_increment:
                    !checked && !prevState.is_unique ? false : prevState.is_auto_increment,
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
                  is_auto_increment:
                    !checked && !prevState.is_primary_key ? false : prevState.is_auto_increment,
                }));
              }}
            />
            Única
          </label>

          {supportsAutoIncrement && (
            <label className={styles.checkbox} style={{ color: colors.color }}>
              <input
                type="checkbox"
                name="is_auto_increment"
                checked={state.is_auto_increment}
                onChange={(event) => {
                  const checked = event.target.checked;

                  setState((prevState) => ({
                    ...prevState,
                    is_auto_increment: checked,
                    required: checked ? true : prevState.required,
                    column_default: checked ? '' : prevState.column_default,
                    is_primary_key: checked && !hasPrimaryKey ? true : prevState.is_primary_key,
                    is_unique: checked && hasPrimaryKey ? true : prevState.is_unique,
                    is_foreign_key: checked ? false : prevState.is_foreign_key,
                  }));
                }}
              />
              Auto increment
            </label>
          )}

          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="is_foreign_key"
              checked={state.is_foreign_key}
              disabled={state.is_auto_increment}
              onChange={register('is_foreign_key').onChange}
            />
            Chave Estrangeira
          </label>
        </div>

        {state.is_foreign_key && (
          <Row>
            <Autocomplete
              md={12}
              required
              label="Tabela referenciada"
              data={tableOptions}
              extractLabel={(item) => item.label}
              extractValue={(item) => item.value}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('reference_table')}
              onChange={({ name, value }) => {
                setReferenceRestrictions([]);
                setReferenceColumns([]);
                setState((prevState) => ({
                  ...prevState,
                  [name!]: value || '',
                  reference_column_name: '',
                }));
              }}
            />

            <Autocomplete
              md={12}
              required
              label="Coluna referenciada"
              data={referenceColumnOptions}
              loading={loadingRestrictions}
              extractLabel={(item) => item.label}
              extractValue={(item) => item.value}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              emptyMessage="A tabela não possui PK ou coluna Unique"
              {...register('reference_column_name')}
            />
          </Row>
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
  idConnection: string;
  table: string;
  types: string[];
  tables: ITable[];
  hasPrimaryKey?: boolean;
  supportsAutoIncrement?: boolean;
  onClose?(): void;
  onAdd?(
    column: IPendingColumnCreate,
    options?: {
      constraintType?: 'primary_key' | 'unique_key';
      reference?: IPendingReferenceCreate;
    },
  ): boolean | void;
}

interface IFormData {
  column_name: string;
  data_type: string;
  column_default: string;
  description: string;
  required: boolean;
  is_primary_key: boolean;
  is_unique: boolean;
  is_auto_increment: boolean;
  is_foreign_key: boolean;
  reference_table: string;
  reference_column_name: string;
}
