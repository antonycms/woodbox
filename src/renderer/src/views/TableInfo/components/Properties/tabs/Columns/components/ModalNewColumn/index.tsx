import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Button } from '@renderer/components/Button';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import type { IColumnRestrictionsInfo, ITable } from '@shared/types/database';
import { generateHash } from '@shared/utils/string';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { useThemeStore } from '@renderer/stores/Theme';
import type {
  IPendingColumnCreate,
  IPendingIndexCreate,
  IPendingReferenceCreate,
} from '@renderer/stores/TableInfo/types';
import { useForm } from '@renderer/hooks/useForm';
import { Autocomplete } from '@renderer/components/AutocompleteFree';
import { useTableInfoStore, type TableInfoStoreApi } from '@renderer/stores/TableInfo';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { getColumnToggleChanges, prepareColumnDraft } from './utils';
import { selectConnectionPresentations } from '@renderer/stores/Workspace/selectors';
import type { NewColumnFormData, PreparedColumnDraft } from './types';
import styles from './styles.module.css';

interface ITableOption extends ITable {
  label: string;
  value: string;
}

interface IReferenceColumnOption {
  label: string;
  value: string;
  constraintType: string;
}

const getGeneratedForeignKeyName = (table: string, column: string, referenceTable: string) => {
  return `${table}_${column}_${referenceTable}_fk`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const getGeneratedIndexName = (table: string, columns: string[]) => {
  const columnPart = columns.join('_') || 'columns';
  return `${table}_${columnPart}_idx`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
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
  is_index: false,
  reference_table: '',
  reference_column_name: '',
};

const ModalNewColumn = ({
  show,
  tableStore,
  onClose,
  onAdd,
}: IModalNewColumnProps) => {
  const { modal: colors } = useThemeStore((state) => state.activeTheme);
  const getTableRestrictions = useDatabaseStore((state) => state.getTableRestrictions);
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  const { tableContext, columnTypes: types, restrictions, pendingRestrictions } = useTableInfoStore(tableStore,
    useShallow((store) => ({ tableContext: store.tableContext, columnTypes: store.columnTypes,
      restrictions: store.restrictions, pendingRestrictions: store.pendingRestrictions })));
  const connection = useWorkspaceStore((store) => selectConnectionPresentations(store).get(tableContext.idConnection));
  const structure = connection?.structure;
  const catalog = useWorkspaceStore((store) => store.dialectCatalog);
  const loadDialectCatalog = useWorkspaceStore((store) => store.loadDialectCatalog);
  const hasPrimaryKey = [...restrictions, ...pendingRestrictions].some((item) => item.constraint_type === 'primary_key');
  const { idConnection, table } = tableContext;
  const tables = useWorkspaceStore((store) => store.connectionsInfo.get(idConnection)?.tables);
  const { state, register, handleSubmit, reset, setState } = useForm<IFormData>(defaultForm);
  const [referenceRestrictions, setReferenceRestrictions] = React.useState<
    IColumnRestrictionsInfo[]
  >([]);
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
        })),
      );
  }, [referenceRestrictions]);

  const resetAndClose = React.useCallback(() => {
    reset();
    setReferenceRestrictions([]);
    onClose?.();
  }, [reset, onClose]);

  const onReady = React.useCallback((
    result: Extract<PreparedColumnDraft, { status: 'ready' }>,
    data: NewColumnFormData,
  ) => {
    const column: IPendingColumnCreate = { ...result.column, __pendingId: generateHash() };
    const columnName = column.column_name;
    const reference: IPendingReferenceCreate | undefined = data.is_foreign_key
      ? {
          __pendingId: generateHash(),
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

    const index: IPendingIndexCreate | undefined = data.is_index
      ? {
          __pendingId: generateHash(),
          index_name: getGeneratedIndexName(table, [columnName]),
          index_method: result.defaultIndexMethod,
          is_unique: false,
          is_primary: false,
          is_valid: true,
          column_names: [columnName],
          column_orders: ['ASC'],
        }
      : undefined;

    const shouldClose = onAdd?.(column, {
      constraintType: result.constraintType,
      reference,
      index,
    });
    return shouldClose !== false;
  }, [onAdd, table, selectedReferenceTable]);

  const fieldsLocked = !structure;
  const typeItems = types?.length ? types : structure?.fallbackColumnTypes || [];
  const changePrimaryKey = (checked: boolean) => {
    if (fieldsLocked || hasPrimaryKey) return;
    setState((previous) => ({
      ...previous,
      ...getColumnToggleChanges(previous, { type: 'toggle-primary-key', checked }, hasPrimaryKey),
    }));
  };
  const changeUnique = (checked: boolean) => {
    if (fieldsLocked) return;
    setState((previous) => ({
      ...previous,
      ...getColumnToggleChanges(previous, { type: 'toggle-unique', checked }, hasPrimaryKey),
    }));
  };
  const changeAutoIncrement = (checked: boolean) => {
    if (fieldsLocked) return;
    setState((previous) => ({
      ...previous,
      ...getColumnToggleChanges(previous, { type: 'toggle-auto-increment', checked }, hasPrimaryKey),
    }));
  };
  const bind = <K extends keyof IFormData>(name: K) => {
    const binding = register(name);
    return { ...binding, onChange: (event: Parameters<typeof binding.onChange>[0]) => {
      binding.onChange('target' in event ? event : { ...event, value: event.value ?? '' });
    } };
  };
  const close = resetAndClose;
  const onSubmit = handleSubmit((data) => {
    if (!show || !structure) return;
    const eligibility = tableStore.getState().columnTypeEligibility[data.data_type.trim()];
    const hasReference = !!selectedReferenceTable && !!data.reference_column_name;
    const result = prepareColumnDraft(data, structure.defaultIndexMethod, eligibility, hasReference);
    if (result.status === 'incomplete') return;
    if (result.status === 'blocked') {
      const messages = {
        'unique-default': ['column.uniqueFixedDefaultTitle', 'column.uniqueFixedDefaultDescription'],
        'auto-type': ['toast.invalidAutoIncrementType', 'column.autoIncrementTypesHelp'],
        'auto-needs-key': ['column.autoIncrementNeedsIndex', 'column.autoIncrementNeedsIndexDescription'],
      } as const;
      const [title, description] = messages[result.reason];
      showToast({ type: 'warn', title: t(title), description: t(description) });
      return;
    }
    if (onReady(result, data)) resetAndClose();
  });
  const retry = () => void loadDialectCatalog().catch(() => {});

  React.useEffect(() => {
    if (show && !structure && catalog.status === 'idle') void loadDialectCatalog().catch(() => {});
  }, [show, structure, catalog.status, loadDialectCatalog]);

  React.useEffect(() => {
    if (!show || !state.is_foreign_key || !selectedReferenceTable) {
      setReferenceRestrictions([]);
      return;
    }

    let ignore = false;

    const load = async () => {
      try {
        setLoadingRestrictions(true);
        const restrictions = await getTableRestrictions(idConnection, {
          schema: selectedReferenceTable.table_schema || '',
          table: selectedReferenceTable.table_name,
        });

        if (!ignore) {
          setReferenceRestrictions(restrictions || []);
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
    <Modal title={t('column.newColumn')} width="440px" show={show} closeOutside onClose={close}>
      <form className={styles.form} onSubmit={onSubmit}>
        <Row>
          <Input
            md={12}
            required
            autoFocus
            label={t('field.name')}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...bind('column_name')}
          />

          <Autocomplete
            md={12}
            required
            label={t('field.type')}
            data={typeItems}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...bind('data_type')}
          />
        </Row>

        <Row>
          <Input
            md={12}
            label={t('field.defaultValue')}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            disabled={fieldsLocked || state.is_auto_increment}
            title={state.is_auto_increment ? t('column.autoIncrementNoDefault') : undefined}
            {...bind('column_default')}
          />

          <Input
            md={12}
            label={t('field.comment')}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...bind('description')}
          />
        </Row>

        <div className={styles.checkboxes}>
          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="is_primary_key"
              checked={state.is_primary_key}
              disabled={fieldsLocked || hasPrimaryKey}
              title={hasPrimaryKey ? t('message.primaryKeyAlreadyExistsTitle') : undefined}
              onChange={(event) => {
                changePrimaryKey(event.target.checked);
              }}
            />
            {t('field.primaryKey')}
          </label>

          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="required"
              checked={state.required}
              disabled={fieldsLocked}
              onChange={bind('required').onChange}
            />
            {t('field.required')}
          </label>

          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="is_unique"
              checked={state.is_unique}
              disabled={fieldsLocked}
              onChange={(event) => {
                changeUnique(event.target.checked);
              }}
            />
            {t('field.unique')}
          </label>

          {structure?.supportsAutoIncrement && (
            <label className={styles.checkbox} style={{ color: colors.color }}>
              <input
                type="checkbox"
                name="is_auto_increment"
                checked={state.is_auto_increment}
                disabled={fieldsLocked}
                onChange={(event) => {
                  changeAutoIncrement(event.target.checked);
                }}
              />
              {t('column.autoIncrement')}
            </label>
          )}

          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="is_index"
              checked={state.is_index}
                onChange={bind('is_index').onChange}
            />
            {t('field.index')}
          </label>

          <label className={styles.checkbox} style={{ color: colors.color }}>
            <input
              type="checkbox"
              name="is_foreign_key"
              checked={state.is_foreign_key}
              disabled={fieldsLocked || state.is_auto_increment}
              onChange={bind('is_foreign_key').onChange}
            />
            {t('tabs.foreignKeys')}
          </label>
        </div>

        {state.is_foreign_key && (
          <Row>
            <Autocomplete
              md={12}
              required
              label={t('column.referencedTable')}
              data={tableOptions}
              extractLabel={(item) => item.label}
              extractValue={(item) => item.value}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              disabled={fieldsLocked}
              {...bind('reference_table')}
              onChange={({ name, value }) => {
                if (!show) return;
                setReferenceRestrictions([]);
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
              label={t('column.referencedColumn')}
              data={referenceColumnOptions}
              loading={loadingRestrictions}
              extractLabel={(item) => item.label}
              extractValue={(item) => item.value}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              emptyMessage={t('message.noPkOrUniqueColumn')}
              disabled={fieldsLocked}
              {...bind('reference_column_name')}
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
            {t('settings.customization.cancel')}
          </Button>

          {(!structure && catalog.status === 'error') && (
            <Button text onClick={retry}>
              {t('column.retryDraft')}
            </Button>
          )}

          <Button
            type="submit"
            disabled={fieldsLocked}
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
            xs={6}
            sm={4}
            md={3}
          >
            {t('common.add')}
          </Button>
        </Row>
      </form>
    </Modal>
  );
};

export default ModalNewColumn;

interface IModalNewColumnProps {
  show?: boolean;
  tableStore: TableInfoStoreApi;
  onClose?(): void;
  onAdd?(
    column: IPendingColumnCreate,
    options?: {
      constraintType?: 'primary_key' | 'unique_key';
      reference?: IPendingReferenceCreate;
      index?: IPendingIndexCreate;
    },
  ): boolean | void;
}

type IFormData = NewColumnFormData;
