import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
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
import type { IPendingReferenceCreate } from '@renderer/contexts/TableInfoContext';
import { useForm } from '@renderer/hooks/useForm';
import { generateHash } from '@renderer/utils/string';
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

const getGeneratedConstraintName = (table: string, column: string, referenceTable: string) => {
  return `${table}_${column}_${referenceTable}_fk`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const getColumnTypeSignature = (column?: IColumnInfo) => {
  if (!column) return '';

  return [
    column.udt_name || column.data_type,
    column.character_maximum_length,
    column.numeric_precision,
    column.numeric_scale,
    column.datetime_precision,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(':');
};

const getColumnTypeLabel = (column?: IColumnInfo) => column?.udt_name || column?.data_type || '';

const defaultForm: IFormData = {
  column_name: '',
  reference_table: '',
  reference_column_name: '',
};

const ModalNewReference = ({
  show,
  idConnection,
  table,
  columns,
  tables,
  onClose,
  onAdd,
}: IModalNewReferenceProps) => {
  const {
    activeTheme: { __colors, modal: colors },
  } = useThemeContext();
  const { getTableColumns, getTableRestrictions } = useStoreContext();
  const { state, register, handleSubmit, reset, setState } = useForm<IFormData>(defaultForm);
  const [referenceRestrictions, setReferenceRestrictions] = React.useState<
    IColumnRestrictionsInfo[]
  >([]);
  const [referenceColumns, setReferenceColumns] = React.useState<IColumnInfo[]>([]);
  const [loadingRestrictions, setLoadingRestrictions] = React.useState(false);

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

  const selectedLocalColumn = React.useMemo(() => {
    return columns.find((column) => column.column_name === state.column_name);
  }, [columns, state.column_name]);

  const selectedReferenceColumn = React.useMemo(() => {
    return referenceColumnOptions.find((option) => option.value === state.reference_column_name)
      ?.column;
  }, [referenceColumnOptions, state.reference_column_name]);

  const hasTypeMismatch = !!(
    selectedLocalColumn &&
    selectedReferenceColumn &&
    getColumnTypeSignature(selectedLocalColumn) !== getColumnTypeSignature(selectedReferenceColumn)
  );

  const close = React.useCallback(() => {
    reset();
    setReferenceRestrictions([]);
    setReferenceColumns([]);
    onClose?.();
  }, [reset, onClose]);

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      if (!selectedReferenceTable) return;
      if (!data.column_name || !data.reference_column_name) return;

      const reference: IPendingReferenceCreate = {
        __pendingId: generateHash(),
        __pendingAction: 'create',
        constraint_name: getGeneratedConstraintName(
          table,
          data.column_name,
          selectedReferenceTable.table_name,
        ),
        table_schema: '',
        table_name: table,
        column_name: data.column_name,
        reference_table_schema: selectedReferenceTable.table_schema || '',
        reference_table_name: selectedReferenceTable.table_name,
        reference_column_name: data.reference_column_name,
      };

      const shouldClose = onAdd?.(reference);
      if (shouldClose !== false) close();
    }),
    [handleSubmit, selectedReferenceTable, onAdd, close, table],
  );

  React.useEffect(() => {
    if (!show || !selectedReferenceTable) {
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
  }, [getTableColumns, getTableRestrictions, idConnection, selectedReferenceTable, show]);

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
    <Modal title="Nova chave estrangeira" width="520px" show={show} closeOutside onClose={close}>
      <form className={styles.form} onSubmit={onSubmit}>
        <Row>
          <Autocomplete
            md={12}
            required
            label="Coluna"
            data={columns}
            extractLabel={(item) => item.column_name}
            extractValue={(item) => item.column_name}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('column_name')}
          />

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

          {hasTypeMismatch && (
            <div
              className={styles.warning}
              style={
                {
                  color: colors.color,
                  '--warning-border-color': __colors.orangeDeep,
                  '--warning-background-color': __colors.orangeTransparent,
                } as React.CSSProperties
              }
            >
              Atenção: a coluna selecionada possui tipo {getColumnTypeLabel(selectedLocalColumn)} e
              a coluna referenciada possui tipo {getColumnTypeLabel(selectedReferenceColumn)}. O
              PostgreSQL pode rejeitar a criação da FK ao salvar.
            </div>
          )}
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

export default ModalNewReference;

interface IModalNewReferenceProps {
  show?: boolean;
  idConnection: string;
  table: string;
  columns: IColumnInfo[];
  tables: ITable[];
  onClose?(): void;
  onAdd?(reference: IPendingReferenceCreate): boolean | void;
}

interface IFormData {
  column_name: string;
  reference_table: string;
  reference_column_name: string;
}
