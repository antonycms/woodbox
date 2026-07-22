import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { type IColumnInfo, useStoreContext } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import {
  type IPendingColumnChange,
  type IPendingColumnCreate,
  type IPendingIndexCreate,
  type IPendingReferenceCreate,
  useTableInfoContext,
} from '@renderer/contexts/TableInfoContext';
import { AddIcon, CancelIcon, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import { generateHash } from '@renderer/utils/string';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateAddColumnsDdl } from './ddl';
import ModalNewColumn from './components/ModalNewColumn';
import { getRendererDialect } from '@renderer/database/dialects';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import styles from './styles.module.css';

const getColumnSelectionKey = (column: IColumnInfo) =>
  (column as IColumnInfo & { __pendingId?: string }).__pendingId ||
  (column as IPendingColumnChange).__originalColumn?.column_name ||
  column.column_name;

const getGeneratedConstraintName = (
  table: string,
  type: 'primary_key' | 'unique_key',
  columns: string[],
) => {
  const suffix = type === 'primary_key' ? 'pk' : 'unique';

  return `${table}_${columns.join('_')}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const normalizeOptionalString = (value: unknown) => {
  const normalizedValue = String(value ?? '').trim();

  return normalizedValue || undefined;
};

const parseNullableValue = (value: unknown) => {
  if (typeof value === 'boolean') return value;

  const normalizedValue = String(value ?? '')
    .trim()
    .toLowerCase();

  if (['true', 'sim', 'yes', '1'].includes(normalizedValue)) return true;
  if (['false', 'não', 'nao', 'no', '0'].includes(normalizedValue)) return false;

  return null;
};

const booleanLabelOptions = ['Sim', 'Não'];

const serializeBooleanLabel = (value: unknown) => (value ? 'Sim' : 'Não');

const mysqlAutoIncrementTypes = new Set([
  'tinyint',
  'smallint',
  'mediumint',
  'int',
  'integer',
  'bigint',
]);

const isMysqlAutoIncrementType = (dataType: string) => {
  const normalizedDataType = dataType.trim().toLowerCase().split('(')[0];

  return mysqlAutoIncrementTypes.has(normalizedDataType);
};

const serializeColumnBooleanLabels = (column: IColumnInfo): IColumnInfo => ({
  ...column,
  is_nullable_label: serializeBooleanLabel(column.is_nullable),
  is_auto_increment_label: serializeBooleanLabel(column.is_auto_increment),
});

const getOriginalColumnName = (column: IColumnInfo) =>
  (column as IPendingColumnChange).__originalColumn?.column_name || column.column_name;

const Columns = ({
  id_connection,
  schema,
  table,
  mode,
  tableComment,
  onCreateApplied,
}: ITableInfoProps) => {
  const {
    activeTheme: {
      __colors,
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { connections, connectionsInfo } = useStoreContext();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const { showToast } = useToast();
  const { t } = useI18n();
  const {
    columns,
    pendingColumns,
    pendingDroppedColumns,
    pendingChangedColumns,
    pendingRestrictions,
    pendingReferences,
    indexes,
    pendingIndexes,
    columnTypes,
    references,
    restrictions,
    addPendingColumn,
    addPendingIndex,
    updatePendingColumn,
    addPendingRestriction,
    addPendingReference,
    removePendingColumn,
    addPendingDroppedColumns,
    removePendingDroppedColumns,
    addPendingChangedColumn,
    removePendingChangedColumns,
    clearPendingChanges,
    loadColumnTypes,
    loadTableColumns,
    loadTableReferences,
    loadTableRestrictions,
    openPendingChangesSqlModal,
    lastFetchDate,
    loading,
  } = useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedColumns, setSelectedColumns] = React.useState<IColumnInfo[]>([]);
  const [columnFilterText, setColumnFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [showNewColumnModal, setShowNewColumnModal] = React.useState(false);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.columns);
  const connectionInfo = connectionsInfo.get(id_connection);
  const columnFilterTextSerialized = columnFilterText.trim().toLowerCase();
  const droppedColumnNames = React.useMemo(
    () => new Set(pendingDroppedColumns.map((column) => column.column_name)),
    [pendingDroppedColumns],
  );
  const changedColumnsByOriginalName = React.useMemo(
    () =>
      new Map(pendingChangedColumns.map((column) => [column.__originalColumn.column_name, column])),
    [pendingChangedColumns],
  );
  const allColumns = React.useMemo(
    () => [
      ...columns.map((column) => {
        const currentColumn = changedColumnsByOriginalName.get(column.column_name) || column;
        const columnWithBooleanLabels = serializeColumnBooleanLabels(currentColumn);

        if (droppedColumnNames.has(column.column_name)) {
          return {
            ...columnWithBooleanLabels,
            __pendingAction: 'drop',
            __style: {
              backgroundColor: __colors.redTransparent,
              textDecoration: 'line-through',
            },
          };
        }

        return columnWithBooleanLabels;
      }),
      ...pendingColumns.map(serializeColumnBooleanLabels),
    ],
    [
      __colors.redTransparent,
      changedColumnsByOriginalName,
      columns,
      droppedColumnNames,
      pendingColumns,
    ],
  );
  const hasPrimaryKey = React.useMemo(
    () =>
      restrictions.some((restriction) => restriction.constraint_type === 'primary_key') ||
      pendingRestrictions.some((restriction) => restriction.constraint_type === 'primary_key'),
    [pendingRestrictions, restrictions],
  );

  const filteredColumnsAndSortedColumns = React.useMemo(() => {
    if (!columnFilterTextSerialized) return sortRows(allColumns, sort);

    const texts = columnFilterTextSerialized.split(',').map((t) => t.trim());

    const columnsFiltered = allColumns.filter((column) =>
      [column.column_name, column.data_type].some((value) =>
        texts.some((text) => text && value?.toLowerCase().includes(text)),
      ),
    );

    return sortRows(columnsFiltered, sort);
  }, [allColumns, columnFilterTextSerialized, sort]);

  const handleOpenNewColumnModal = React.useCallback(() => {
    setShowNewColumnModal(true);
    setContextMenuPosition(null);
  }, []);

  const handleAddPendingColumn = React.useCallback(
    (
      column: Parameters<typeof addPendingColumn>[0],
      options?: {
        constraintType?: 'primary_key' | 'unique_key';
        reference?: IPendingReferenceCreate;
        index?: IPendingIndexCreate;
      },
    ) => {
      const columnName = column.column_name.toLowerCase();
      const alreadyExists = allColumns.some(
        (item) => item.column_name.toLowerCase() === columnName,
      );

      if (alreadyExists) {
        showToast({ type: 'warn', title: t('toast.columnExists') });
        return false;
      }

      if (options?.reference) {
        const referenceConstraintName = options.reference.constraint_name.toLowerCase();
        const referenceAlreadyExists = [...references, ...pendingReferences].some(
          (item) => item.constraint_name.toLowerCase() === referenceConstraintName,
        );

        if (referenceAlreadyExists) {
          showToast({ type: 'warn', title: t('toast.foreignKeyExists') });
          return false;
        }
      }

      if (options?.index) {
        const indexName = options.index.index_name.toLowerCase();
        const indexAlreadyExists = [...indexes, ...pendingIndexes].some(
          (item) => item.index_name.toLowerCase() === indexName,
        );

        if (indexAlreadyExists) {
          showToast({ type: 'warn', title: t('toast.indexExists') });
          return false;
        }
      }

      addPendingColumn(column);

      if (options?.index) {
        addPendingIndex(options.index);
      }

      if (options?.constraintType) {
        addPendingRestriction({
          __pendingId: generateHash(),
          __pendingAction: 'create',
          constraint_name: getGeneratedConstraintName(table, options.constraintType, [
            column.column_name,
          ]),
          constraint_type: options.constraintType,
          column_names: [column.column_name],
        });
      }

      if (options?.reference) {
        addPendingReference({
          ...options.reference,
          table_schema: schema,
          table_name: table,
          column_name: column.column_name,
        });
      }

      return true;
    },
    [
      addPendingColumn,
      addPendingIndex,
      addPendingReference,
      addPendingRestriction,
      allColumns,
      indexes,
      pendingIndexes,
      pendingReferences,
      references,
      schema,
      showToast,
      table,
    ],
  );

  const handleEditColumn = React.useCallback(
    (indexRow: number, attribute: string, value: unknown) => {
      const column = filteredColumnsAndSortedColumns[indexRow];
      if (!column) return;

      let nextValue: unknown = value;
      let extraColumnChanges: Partial<IColumnInfo> = {};

      if (attribute === 'column_name') {
        nextValue = String(value ?? '').trim();

        if (!nextValue) {
          showToast({ type: 'warn', title: t('toast.columnNameRequired') });
          return;
        }

        const currentPendingId = (column as IPendingColumnCreate).__pendingId;
        const currentOriginalColumnName = getOriginalColumnName(column);
        const alreadyExists = allColumns.some((item) => {
          const itemPendingId = (item as IPendingColumnCreate).__pendingId;
          const itemOriginalColumnName = getOriginalColumnName(item);

          if (currentPendingId && itemPendingId === currentPendingId) return false;
          if (!currentPendingId && itemOriginalColumnName === currentOriginalColumnName) {
            return false;
          }

          return item.column_name.toLowerCase() === String(nextValue).toLowerCase();
        });

        if (alreadyExists) {
          showToast({ type: 'warn', title: t('toast.columnExists') });
          return;
        }
      } else if (attribute === 'data_type') {
        nextValue = String(value ?? '').trim();

        if (!nextValue) {
          showToast({ type: 'warn', title: t('toast.columnTypeRequired') });
          return;
        }
      } else if (attribute === 'is_nullable_label') {
        const parsedNullableValue = parseNullableValue(value);

        if (parsedNullableValue === null) {
          showToast({
            type: 'warn',
            title: t('toast.invalidNullable'),
            description: t('toast.invalidNullableHelp'),
          });
          return;
        }

        attribute = 'is_nullable';
        nextValue = parsedNullableValue;
      } else if (attribute === 'is_auto_increment_label') {
        const parsedAutoIncrementValue = parseNullableValue(value);

        if (parsedAutoIncrementValue === null) {
          showToast({
            type: 'warn',
            title: t('toast.invalidAutoIncrement'),
            description: t('toast.invalidAutoIncrementHelp'),
          });
          return;
        }

        if (parsedAutoIncrementValue && !isMysqlAutoIncrementType(column.data_type)) {
          showToast({
            type: 'warn',
            title: t('toast.invalidAutoIncrementType'),
            description: t('toast.invalidAutoIncrementMysqlHelp'),
          });
          return;
        }

        attribute = 'is_auto_increment';
        nextValue = parsedAutoIncrementValue;

        if (parsedAutoIncrementValue) {
          extraColumnChanges = {
            column_default: undefined,
            is_nullable: false,
            is_nullable_label: 'Não',
          };
        }
      } else if (['column_default', 'description'].includes(attribute)) {
        nextValue = normalizeOptionalString(value);
      } else {
        return;
      }

      const columnChanges = {
        [attribute]: nextValue,
        ...extraColumnChanges,
      } as Partial<IColumnInfo>;
      const pendingId = (column as IPendingColumnCreate).__pendingId;

      if (pendingId && (column as IPendingColumnCreate).__pendingAction === 'create') {
        updatePendingColumn(pendingId, columnChanges);
        return;
      }

      addPendingChangedColumn(column, columnChanges);
    },
    [
      addPendingChangedColumn,
      allColumns,
      filteredColumnsAndSortedColumns,
      showToast,
      updatePendingColumn,
      t,
    ],
  );

  const handleRemoveSelectedColumns = React.useCallback(() => {
    if (!selectedColumns.length) {
      showToast({ type: 'warn', title: t('toast.selectColumnsRemove') });
      return;
    }

    selectedColumns.forEach((column) => {
      const pendingId = (column as IPendingColumnCreate).__pendingId;

      if (pendingId) {
        removePendingColumn(pendingId);
        return;
      }

      addPendingDroppedColumns([(column as IPendingColumnChange).__originalColumn || column]);
    });

    setContextMenuPosition(null);
  }, [selectedColumns, removePendingColumn, addPendingDroppedColumns, showToast, t]);

  const handleClearPendingChanges = React.useCallback(() => {
    clearPendingChanges();
    setSelectedColumns([]);
  }, [clearPendingChanges]);

  const handleSavePendingChanges = React.useCallback(() => {
    openPendingChangesSqlModal(
      id_connection,
      { schema, table },
      {
        mode,
        tableComment,
        onApplied: onCreateApplied,
      },
    );
  }, [
    id_connection,
    mode,
    onCreateApplied,
    openPendingChangesSqlModal,
    schema,
    table,
    tableComment,
  ]);

  const handleUndoSelectedDroppedColumns = React.useCallback(() => {
    const droppedColumnNamesToUndo = selectedColumns
      .filter(
        (column) =>
          (column as { __pendingAction?: string }).__pendingAction === 'drop' ||
          droppedColumnNames.has(column.column_name),
      )
      .map((column) => column.column_name);
    const changedColumnNamesToUndo = selectedColumns
      .filter((column) => (column as { __pendingAction?: string }).__pendingAction === 'change')
      .map(getOriginalColumnName);

    if (!droppedColumnNamesToUndo.length && !changedColumnNamesToUndo.length) return;

    if (droppedColumnNamesToUndo.length) removePendingDroppedColumns(droppedColumnNamesToUndo);
    if (changedColumnNamesToUndo.length) removePendingChangedColumns(changedColumnNamesToUndo);
    setSelectedColumns([]);
  }, [
    selectedColumns,
    droppedColumnNames,
    removePendingDroppedColumns,
    removePendingChangedColumns,
  ]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: t('column.newColumn'),
        onClick: handleOpenNewColumnModal,
      },
      {
        text: t('common.duplicateSelectedItems'),
        onClick: () => null,
      },
      {
        text: t('context.deleteSelectedItems'),
        onClick: handleRemoveSelectedColumns,
      },
      {
        text: t('modal.generateDdl'),
        onClick: () => {
          setDdlSql(
            generateAddColumnsDdl(dialect, schema, table, selectedColumns, {
              references,
              restrictions,
            }),
          );

          setShowDdlModal(true);
        },
      },
    ];
  }, [
    schema,
    table,
    selectedColumns,
    references,
    restrictions,
    dialect,
    handleOpenNewColumnModal,
    handleRemoveSelectedColumns,
    t,
  ]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadColumnTypes(id_connection);

    if (mode === 'create') return;

    loadTableColumns(id_connection, { schema, table });
    loadTableRestrictions(id_connection, { schema, table });
    loadTableReferences(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedColumns([]);
  }, [columnFilterTextSerialized]);

  React.useEffect(() => {
    setSelectedColumns((currentSelectedColumns) => {
      if (!currentSelectedColumns.length) return currentSelectedColumns;

      const columnsByKey = new Map(
        allColumns.map((column) => [getColumnSelectionKey(column), column]),
      );
      const nextSelectedColumns = currentSelectedColumns
        .map((column) => columnsByKey.get(getColumnSelectionKey(column)))
        .filter((column): column is IColumnInfo => !!column);

      if (
        nextSelectedColumns.length === currentSelectedColumns.length &&
        nextSelectedColumns.every((column, index) => column === currentSelectedColumns[index])
      ) {
        return currentSelectedColumns;
      }

      return nextSelectedColumns;
    });
  }, [allColumns]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        handleRemoveSelectedColumns();
        return;
      }

      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSavePendingChanges();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleUndoSelectedDroppedColumns();
      }
    },
    [handleRemoveSelectedColumns, handleSavePendingChanges, handleUndoSelectedDroppedColumns],
  );

  return (
    <div style={{ display: 'contents' }} onKeyDown={handleKeyDown}>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL
        show={showDdlModal}
        sql={ddlSql}
        dialect={dialect}
        onClose={() => setShowDdlModal(false)}
      />

      <ModalNewColumn
        show={showNewColumnModal}
        idConnection={id_connection}
        table={table}
        types={columnTypes}
        tables={connectionInfo?.tables || []}
        hasPrimaryKey={hasPrimaryKey}
        supportsAutoIncrement={dialect.supportsAutoIncrement}
        indexMethods={dialect.indexMethods || []}
        onClose={() => setShowNewColumnModal(false)}
        onAdd={handleAddPendingColumn}
      />

      <div
        className={styles.filterBar}
        style={{
          backgroundColor: theme.bar.backgroundColor,
          borderColor: theme.bar.borderColor,
        }}
      >
        <input
          className={styles.filterInput}
          placeholder={t('placeholder.filterColumns')}
          value={columnFilterText}
          onChange={(event) => setColumnFilterText(event.target.value)}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <Table
        loading={loading.columns}
        rowKeyExtractor={getColumnSelectionKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedColumns}
        rows={filteredColumnsAndSortedColumns}
        onEditRow={handleEditColumn}
        sort={sort}
        onSort={(column, sortType) =>
          setSort((current) => getNextSort(current, column.attribute, sortType))
        }
        columns={[
          {
            label: t('column.columnName'),
            attribute: 'column_name',
            editable: true,
            sortable: true,
          },
          {
            label: t('field.type'),
            attribute: 'data_type',
            editable: true,
            sortable: true,
            type: 'autocomplete',
            dataAutocomplete: columnTypes,
          },
          {
            label: t('field.nullable'),
            attribute: 'is_nullable_label',
            editable: true,
            sortable: true,
            type: 'autocomplete',
            dataAutocomplete: booleanLabelOptions,
          },
          ...(dialect.supportsAutoIncrement
            ? [
                {
                  label: t('column.autoInc'),
                  attribute: 'is_auto_increment_label' as const,
                  editable: true,
                  sortable: true,
                  type: 'autocomplete' as const,
                  dataAutocomplete: booleanLabelOptions,
                },
              ]
            : []),
          {
            label: t('field.default'),
            attribute: 'column_default',
            editable: true,
            sortable: true,
          },
          {
            label: t('field.comment'),
            attribute: 'description',
            editable: true,
            sortable: true,
          },
        ]}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title={t('common.save')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleSavePendingChanges}
        >
          <SaveIcon size={16} />
        </Button>

        <Button
          title={t('common.cancelChanges')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleClearPendingChanges}
        >
          <CancelIcon size={16} />
        </Button>

        <Button
          title={t('common.add')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleOpenNewColumnModal}
        >
          <AddIcon size={14} />
        </Button>

        <Button
          title="Remover itens selecionados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleRemoveSelectedColumns}
        >
          <RemoveIcon size={16} />
        </Button>

        {mode !== 'create' && (
          <RefreshButton
            menuPlacement="top"
            color={theme.bar.color}
            onRefresh={() => loadTableColumns(id_connection, { schema, table })}
          />
        )}

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredColumnsAndSortedColumns?.length > 1
            ? `${filteredColumnsAndSortedColumns?.length} Itens`
            : `${filteredColumnsAndSortedColumns?.length || 0} Item`}
        </Text>

        {mode !== 'create' && (
          <Text userSelect={false} title={t('common.lastUpdatedAt')} color={theme.bar.color}>
            {t('common.updatedAt', { date: lastFetchDateSerialized })}
          </Text>
        )}
      </Bar>
    </div>
  );
};

export default Columns;
