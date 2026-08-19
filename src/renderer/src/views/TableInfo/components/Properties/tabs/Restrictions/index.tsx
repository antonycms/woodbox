import React from 'react';
import Table from '@renderer/components/Table';
import { AddIcon, CancelIcon, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import type { IColumnRestrictionsInfo } from '@renderer/contexts/Store';
import { useStoreContext } from '@renderer/contexts/Store';
import {
  type IPendingRestrictionCreate,
  useTableInfoContext,
} from '@renderer/contexts/TableInfoContext';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { toDateTime } from '@renderer/utils/date';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort } from '@renderer/utils/tableSort';
import { useFilteredSortedRows } from '../../hooks/useFilteredSortedRows';
import { useSelectionReconciliation } from '../../hooks/useSelectionReconciliation';
import { usePropertiesKeyboardShortcuts } from '../../hooks/usePropertiesKeyboardShortcuts';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateRestrictionsDdl } from '../Columns/ddl';
import ModalNewRestriction from './components/ModalNewRestriction';
import { getRendererDialect } from '@renderer/database/dialects';
import styles from '../Columns/styles.module.css';

const getRestrictionSelectionKey = (restriction: IColumnRestrictionsInfo) =>
  (restriction as IColumnRestrictionsInfo & { __pendingId?: string }).__pendingId ||
  restriction.constraint_name;

const getRestrictionSearchValues = (restriction: IColumnRestrictionsInfo) => [
  restriction.constraint_name,
  restriction.constraint_type,
  Array.isArray(restriction.column_names)
    ? restriction.column_names.join(', ')
    : restriction.column_names,
  restriction.expression,
  restriction.comment,
];

const Restrictios = ({
  id_connection,
  schema,
  table,
  mode,
  tableComment,
  onCreateApplied,
}: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { connections } = useStoreContext();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const {
    columns,
    pendingColumns,
    pendingDroppedColumns,
    restrictions,
    pendingRestrictions,
    pendingDroppedRestrictions,
    addPendingRestriction,
    removePendingRestriction,
    addPendingDroppedRestrictions,
    removePendingDroppedRestrictions,
    clearPendingChanges,
    loadTableRestrictions,
    openPendingChangesSqlModal,
    lastFetchDate,
    loading,
  } = useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedRestrictions, setSelectedRestrictions] = React.useState<IColumnRestrictionsInfo[]>(
    [],
  );
  const [restrictionFilterText, setRestrictionFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [showNewRestrictionModal, setShowNewRestrictionModal] = React.useState(false);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.restrictions);
  const droppedConstraintNames = React.useMemo(
    () => new Set(pendingDroppedRestrictions.map((restriction) => restriction.constraint_name)),
    [pendingDroppedRestrictions],
  );
  const droppedColumnNames = React.useMemo(
    () => new Set(pendingDroppedColumns.map((column) => column.column_name)),
    [pendingDroppedColumns],
  );
  const availableColumnNames = React.useMemo(
    () => [
      ...columns
        .filter((column) => !droppedColumnNames.has(column.column_name))
        .map((column) => column.column_name),
      ...pendingColumns.map((column) => column.column_name),
    ],
    [columns, droppedColumnNames, pendingColumns],
  );
  const existingRestrictions = React.useMemo(() => restrictions, [restrictions]);
  const pendingRestrictionRows = React.useMemo(
    () => pendingRestrictions,
    [pendingRestrictions],
  );
  const allRestrictions = React.useMemo(
    () => [...existingRestrictions, ...pendingRestrictionRows],
    [existingRestrictions, pendingRestrictionRows],
  );
  const filteredAndSortedRestrictions = useFilteredSortedRows({
    rows: existingRestrictions,
    filterText: restrictionFilterText,
    sort,
    getSearchValues: getRestrictionSearchValues,
  });

  const filteredPendingRestrictionRows = useFilteredSortedRows({
    rows: pendingRestrictionRows,
    filterText: restrictionFilterText,
    sort,
    getSearchValues: getRestrictionSearchValues,
  });
  const newRestrictionRows = React.useMemo(
    () =>
      new Map(
        filteredPendingRestrictionRows.map((restriction) => [
          (restriction as IPendingRestrictionCreate).__pendingId,
          restriction,
        ]),
      ),
    [filteredPendingRestrictionRows],
  );

  const handleSortRestrictions = React.useCallback(
    (column: IColumn<IColumnRestrictionsInfo>, sortType?: ISortDirection | null) => {
      setSort((current) => getNextSort(current, column.attribute, sortType));
    },
    [],
  );

  const tableColumns = React.useMemo<IColumn<IColumnRestrictionsInfo>[]>(
    () => [
      {
        label: t('field.name'),
        attribute: 'constraint_name',
        sortable: true,
      },
      {
        label: t('field.type'),
        attribute: 'constraint_type',
        sortable: true,
      },
      {
        label: t('field.columns'),
        attribute: 'column_names',
        type: 'autocomplete-multi',
        sortable: true,
      },
      {
        label: t('field.expression'),
        attribute: 'expression',
        sortable: true,
      },
      {
        label: t('field.comment'),
        attribute: 'comment',
        sortable: true,
      },
    ],
    [t],
  );

  const hasPrimaryKey = React.useMemo(
    () =>
      restrictions.some(
        (restriction) =>
          restriction.constraint_type === 'primary_key' &&
          !droppedConstraintNames.has(restriction.constraint_name),
      ) || pendingRestrictions.some((restriction) => restriction.constraint_type === 'primary_key'),
    [droppedConstraintNames, pendingRestrictions, restrictions],
  );

  const handleOpenNewRestrictionModal = React.useCallback(() => {
    setShowNewRestrictionModal(true);
    setContextMenuPosition(null);
  }, []);

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

  const handleAddPendingRestriction = React.useCallback(
    (restriction: IPendingRestrictionCreate) => {
      const constraintName = restriction.constraint_name.toLowerCase();
      const alreadyExists = allRestrictions.some(
        (item) => item.constraint_name.toLowerCase() === constraintName,
      );

      if (alreadyExists) {
        showToast({ type: 'warn', title: t('toast.constraintExists') });
        return false;
      }

      addPendingRestriction(restriction);
      return true;
    },
    [addPendingRestriction, allRestrictions, showToast],
  );

  const handleRemoveSelectedRestrictions = React.useCallback(() => {
    if (!selectedRestrictions.length) {
      showToast({ type: 'warn', title: t('toast.selectConstraintsRemove') });
      return;
    }

    selectedRestrictions.forEach((restriction) => {
      const pendingId = (restriction as IPendingRestrictionCreate).__pendingId;

      if (pendingId) {
        removePendingRestriction(pendingId);
        return;
      }

      addPendingDroppedRestrictions([restriction]);
    });

    setContextMenuPosition(null);
  }, [selectedRestrictions, removePendingRestriction, addPendingDroppedRestrictions, showToast]);

  const handleUndoSelectedDroppedRestrictions = React.useCallback(() => {
    const constraintNames = selectedRestrictions
      .filter((restriction) => droppedConstraintNames.has(restriction.constraint_name))
      .map((restriction) => restriction.constraint_name);

    if (!constraintNames.length) return;

    removePendingDroppedRestrictions(constraintNames);
    setSelectedRestrictions([]);
  }, [selectedRestrictions, droppedConstraintNames, removePendingDroppedRestrictions]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: t('modal.newConstraint'),
        onClick: handleOpenNewRestrictionModal,
      },
      {
        text: t('context.deleteSelectedItems'),
        onClick: handleRemoveSelectedRestrictions,
      },
      {
        text: t('modal.generateDdl'),
        onClick: () => {
          setDdlSql(generateRestrictionsDdl(dialect, schema, table, selectedRestrictions));
          setShowDdlModal(true);
        },
      },
    ];
  }, [
    schema,
    table,
    selectedRestrictions,
    dialect,
    handleOpenNewRestrictionModal,
    handleRemoveSelectedRestrictions,
    t,
  ]);

  const onContextMenuTable = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      setContextMenuPosition({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  const handleKeyDown = usePropertiesKeyboardShortcuts({
    onRemove: handleRemoveSelectedRestrictions,
    onSave: handleSavePendingChanges,
    onUndo: handleUndoSelectedDroppedRestrictions,
  });

  React.useEffect(() => {
    // Monta uma vez: a aba é recriada quando a tabela/conexão muda.
    if (mode === 'create') return;

    loadTableRestrictions(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedRestrictions([]);
  }, [restrictionFilterText]);

  useSelectionReconciliation({
    rows: allRestrictions,
    setSelectedRows: setSelectedRestrictions,
    getSelectionKey: getRestrictionSelectionKey,
  });

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

      <ModalNewRestriction
        show={showNewRestrictionModal}
        table={table}
        columns={availableColumnNames}
        hasPrimaryKey={hasPrimaryKey}
        dialect={dialect}
        onClose={() => setShowNewRestrictionModal(false)}
        onAdd={handleAddPendingRestriction}
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
          placeholder={t('placeholder.filterConstraints')}
          value={restrictionFilterText}
          onChange={(event) => setRestrictionFilterText(event.target.value)}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <Table
        rows={filteredAndSortedRestrictions}
        sort={sort}
        onSort={handleSortRestrictions}
        loading={loading.restrictions}
        rowKeyExtractor={getRestrictionSelectionKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedRestrictions}
        newRows={newRestrictionRows}
        newRowsPosition="end"
        removedRows={droppedConstraintNames}
        columns={tableColumns}
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
          onClick={clearPendingChanges}
        >
          <CancelIcon size={16} />
        </Button>

        <Button
          title={t('common.add')}
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleOpenNewRestrictionModal}
        >
          <AddIcon size={14} />
        </Button>

        <Button
          title="Remover itens selecionados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleRemoveSelectedRestrictions}
        >
          <RemoveIcon size={16} />
        </Button>

        {mode !== 'create' && (
          <RefreshButton
            menuPlacement="top"
            color={theme.bar.color}
            onRefresh={() => loadTableRestrictions(id_connection, { schema, table })}
          />
        )}

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredAndSortedRestrictions?.length > 1
            ? `${filteredAndSortedRestrictions?.length} Itens`
            : `${filteredAndSortedRestrictions?.length || 0} Item`}
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

export default Restrictios;
