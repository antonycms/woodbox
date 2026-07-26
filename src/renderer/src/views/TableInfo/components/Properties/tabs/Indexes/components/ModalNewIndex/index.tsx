import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { AutocompleteMulti } from '@renderer/components/AutocompleteMulti';
import { Button } from '@renderer/components/Button';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import type { IndexColumnOrder } from '@renderer/contexts/Store';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { IPendingIndexCreate } from '@renderer/contexts/TableInfoContext';
import { useForm } from '@renderer/hooks/useForm';
import { generateHash } from '@renderer/utils/string';
import styles from './styles.module.css';

const getGeneratedIndexName = (table: string, columns: string[]) => {
  const columnPart = columns.join('_') || 'columns';
  return `${table}_${columnPart}_idx`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const defaultForm: IFormData = {
  column_names: [],
  index_method: 'btree',
  column_orders: {},
};

const ModalNewIndex = ({
  show,
  table,
  columns,
  indexMethods = [],
  onClose,
  onAdd,
}: IModalNewIndexProps) => {
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  const { t } = useI18n();
  const { state, register, handleSubmit, reset, setState } = useForm<IFormData>(defaultForm);

  const selectedColumns = React.useMemo(
    () => state.column_names.filter(Boolean),
    [state.column_names],
  );

  const orderListStyle = React.useMemo(
    () =>
      ({
        '--index-order-color': colors.fieldColor,
        '--index-order-background-color': colors.fieldBackgroundColor,
        '--index-order-active-color': colors.saveButtonColor,
        '--index-order-active-background-color': colors.saveButtonBackgroundColor,
      }) as React.CSSProperties,
    [
      colors.fieldColor,
      colors.fieldBackgroundColor,
      colors.saveButtonColor,
      colors.saveButtonBackgroundColor,
    ],
  );

  const close = React.useCallback(() => {
    reset();
    onClose?.();
  }, [reset, onClose]);

  const handleColumnOrderChange = React.useCallback(
    (columnName: string, order: IndexColumnOrder) => {
      setState((prevState) => ({
        ...prevState,
        column_orders: {
          ...prevState.column_orders,
          [columnName]: order,
        },
      }));
    },
    [setState],
  );

  const onSubmit = React.useCallback(
    handleSubmit((data) => {
      const columnNames = data.column_names.filter(Boolean);
      const columnOrders = columnNames.map((columnName) => data.column_orders[columnName] || 'ASC');
      const indexMethod = data.index_method || indexMethods[0] || '';

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
        column_orders: columnOrders,
      };

      const shouldClose = onAdd?.(index);
      if (shouldClose !== false) close();
    }),
    [handleSubmit, onAdd, close, table, indexMethods],
  );

  React.useEffect(() => {
    if (!show) return;

    setState((prevState) => ({
      ...prevState,
      index_method: indexMethods[0] || '',
    }));
  }, [show, indexMethods, setState]);

  return (
    <Modal title={t('modal.newIndex')} width="440px" show={show} closeOutside onClose={close}>
      <form className={styles.form} onSubmit={onSubmit}>
        <Row>
          <AutocompleteMulti
            md={12}
            required
            label={t('field.columns')}
            data={columns}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            {...register('column_names')}
          />

          {!!indexMethods.length && (
            <Autocomplete
              md={12}
              required
              label={t('field.method')}
              data={indexMethods}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              {...register('index_method')}
            />
          )}

          {!!selectedColumns.length && (
            <div className={styles.orderList} style={orderListStyle}>
              <span className={styles.orderTitle}>{t('index.columnOrder')}</span>

              {selectedColumns.map((columnName) => {
                const currentOrder = state.column_orders[columnName] || 'ASC';

                return (
                  <div className={styles.orderRow} key={columnName}>
                    <span className={styles.orderColumnName} title={columnName}>
                      {columnName}
                    </span>

                    <div className={styles.orderActions}>
                      {(['ASC', 'DESC'] as const).map((order) => (
                        <button
                          className={styles.orderButton}
                          data-active={currentOrder === order}
                          key={order}
                          type="button"
                          onClick={() => handleColumnOrderChange(columnName, order)}
                        >
                          {order}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
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
            {t('settings.customization.cancel')}
          </Button>

          <Button
            type="submit"
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

export default ModalNewIndex;

interface IModalNewIndexProps {
  show?: boolean;
  table: string;
  columns: string[];
  indexMethods?: string[];
  onClose?(): void;
  onAdd?(index: IPendingIndexCreate): boolean | void;
}

interface IFormData {
  column_names: string[];
  index_method: string;
  column_orders: Record<string, IndexColumnOrder>;
}
