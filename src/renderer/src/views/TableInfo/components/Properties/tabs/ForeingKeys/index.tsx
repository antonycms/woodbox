import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Bar } from '@renderer/components/Bar';
import type { IColumnReferenceInfo } from '@renderer/contexts/Store';
import { useStoreContext } from '@renderer/contexts/Store';
import {
  type IPendingReferenceCreate,
  useTableInfoContext,
} from '@renderer/contexts/TableInfoContext';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { AddIcon, CancelIcon, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
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
import FilterBar from '../../components/FilterBar';
import { generateReferencesDdl } from '../Columns/ddl';
import ModalNewReference from './components/ModalNewReference';
import { getRendererDialect } from '@renderer/database/dialects';

interface IForeingKeysProps extends ITableInfoProps {
  onOpenTable?: (idConnection: string, schema: string, table: string) => void;
}

interface IReferenceSerialized extends IColumnReferenceInfo {
  table_reference: string;
  __pendingId?: string;
}

const getReferenceSelectionKey = (reference: IColumnReferenceInfo) =>
  (reference as IColumnReferenceInfo & { __pendingId?: string }).__pendingId ||
  `${reference.constraint_name}-${reference.column_name}`;

const getReferenceSearchValues = (reference: IReferenceSerialized) => [
  reference.constraint_name,
  reference.column_name,
  reference.table_reference,
  reference.reference_column_name,
  reference.comment,
  reference.remove_rule,
  reference.update_rule,
];

const ForeingKeys = ({
  id_connection,
  schema,
  table,
  mode,
  tableComment,
  onCreateApplied,
  onOpenTable,
}: IForeingKeysProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { t } = useI18n();
  const { connections, connectionsInfo } = useStoreContext();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const { showToast } = useToast();
  const {
    columns,
    pendingColumns,
    pendingDroppedColumns,
    references,
    pendingReferences,
    pendingDroppedReferences,
    addPendingReference,
    removePendingReference,
    addPendingDroppedReferences,
    removePendingDroppedReferences,
    clearPendingChanges,
    loadTableReferences,
    openPendingChangesSqlModal,
    lastFetchDate,
    loading,
  } = useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedReferences, setSelectedReferences] = React.useState<IReferenceSerialized[]>([]);
  const [referenceFilterText, setReferenceFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);
  const [showNewReferenceModal, setShowNewReferenceModal] = React.useState(false);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.references);
  const connectionInfo = connectionsInfo.get(id_connection);
  const droppedConstraintNames = React.useMemo(
    () => new Set(pendingDroppedReferences.map((reference) => reference.constraint_name)),
    [pendingDroppedReferences],
  );
  const droppedColumnNames = React.useMemo(
    () => new Set(pendingDroppedColumns.map((column) => column.column_name)),
    [pendingDroppedColumns],
  );
  const availableColumns = React.useMemo(
    () => [
      ...columns.filter((column) => !droppedColumnNames.has(column.column_name)),
      ...pendingColumns,
    ],
    [columns, droppedColumnNames, pendingColumns],
  );

  const existingReferences = React.useMemo<IReferenceSerialized[]>(
    () =>
      references.map<IReferenceSerialized>((ref) => ({
        ...ref,
        table_reference: !ref.reference_table_schema
          ? ref.reference_table_name
          : `${ref.reference_table_schema}.${ref.reference_table_name}`,
      })),
    [references],
  );
  const pendingReferenceRows = React.useMemo<IReferenceSerialized[]>(
    () =>
      pendingReferences.map<IReferenceSerialized>((ref) => ({
        ...ref,
        table_reference: !ref.reference_table_schema
          ? ref.reference_table_name
          : `${ref.reference_table_schema}.${ref.reference_table_name}`,
      })),
    [pendingReferences],
  );
  const allReferences = React.useMemo<IReferenceSerialized[]>(
    () => [...existingReferences, ...pendingReferenceRows],
    [existingReferences, pendingReferenceRows],
  );

  const filteredAndSortedReferences = useFilteredSortedRows({
    rows: existingReferences,
    filterText: referenceFilterText,
    sort,
    getSearchValues: getReferenceSearchValues,
  });

  const filteredPendingReferenceRows = useFilteredSortedRows({
    rows: pendingReferenceRows,
    filterText: referenceFilterText,
    sort,
    getSearchValues: getReferenceSearchValues,
  });
  const newReferenceRows = React.useMemo(
    () =>
      new Map(
        filteredPendingReferenceRows.map((reference) => [
          (reference as IPendingReferenceCreate).__pendingId,
          reference,
        ]),
      ),
    [filteredPendingReferenceRows],
  );

  const removedReferenceKeys = React.useMemo(
    () =>
      new Set(
        allReferences
          .filter((reference) => droppedConstraintNames.has(reference.constraint_name))
          .map(getReferenceSelectionKey),
      ),
    [allReferences, droppedConstraintNames],
  );

  const handleSortReferences = React.useCallback(
    (column: IColumn<IReferenceSerialized>, sortType?: ISortDirection | null) => {
      setSort((current) => getNextSort(current, column.attribute, sortType));
    },
    [],
  );

  const tableColumns = React.useMemo<IColumn<IReferenceSerialized>[]>(
    () => [
      {
        label: t('field.name'),
        attribute: 'constraint_name',
        sortable: true,
      },
      {
        label: t('field.column'),
        attribute: 'column_name',
        sortable: true,
      },
      {
        label: t('field.referencedTableTitle'),
        attribute: 'table_reference',
        isLink: true,
        sortable: true,
      },
      {
        label: t('field.referencedColumnTitle'),
        attribute: 'reference_column_name',
        sortable: true,
      },
      {
        label: t('field.comment'),
        attribute: 'comment',
        sortable: true,
      },
      {
        label: t('field.deleteRule'),
        attribute: 'remove_rule',
        sortable: true,
      },
      {
        label: t('field.updateRule'),
        attribute: 'update_rule',
        sortable: true,
      },
    ],
    [t],
  );

  const handleOpenNewReferenceModal = React.useCallback(() => {
    setShowNewReferenceModal(true);
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

  const handleAddPendingReference = React.useCallback(
    (reference: IPendingReferenceCreate) => {
      const constraintName = reference.constraint_name.toLowerCase();
      const alreadyExists = allReferences.some(
        (item) => item.constraint_name.toLowerCase() === constraintName,
      );

      if (alreadyExists) {
        showToast({ type: 'warn', title: t('toast.foreignKeyExists') });
        return false;
      }

      addPendingReference({
        ...reference,
        table_schema: schema,
        table_name: table,
      });
      return true;
    },
    [addPendingReference, allReferences, schema, showToast, table],
  );

  const handleRemoveSelectedReferences = React.useCallback(() => {
    if (!selectedReferences.length) {
      showToast({ type: 'warn', title: t('foreignKey.selectRemove') });
      return;
    }

    selectedReferences.forEach((reference) => {
      const pendingId = (reference as IPendingReferenceCreate).__pendingId;

      if (pendingId) {
        removePendingReference(pendingId);
        return;
      }

      addPendingDroppedReferences(
        references.filter((item) => item.constraint_name === reference.constraint_name),
      );
    });

    setContextMenuPosition(null);
  }, [
    selectedReferences,
    removePendingReference,
    addPendingDroppedReferences,
    references,
    showToast,
  ]);

  const handleUndoSelectedDroppedReferences = React.useCallback(() => {
    const constraintNames = selectedReferences
      .filter((reference) => droppedConstraintNames.has(reference.constraint_name))
      .map((reference) => reference.constraint_name);

    if (!constraintNames.length) return;

    removePendingDroppedReferences(constraintNames);
    setSelectedReferences([]);
  }, [selectedReferences, droppedConstraintNames, removePendingDroppedReferences]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: t('foreignKey.newKey'),
        onClick: handleOpenNewReferenceModal,
      },
      {
        text: t('context.deleteSelectedItems'),
        onClick: handleRemoveSelectedReferences,
      },
      {
        text: t('modal.generateDdl'),
        onClick: () => {
          setDdlSql(generateReferencesDdl(dialect, schema, table, selectedReferences));
          setShowDdlModal(true);
        },
      },
    ];
  }, [
    schema,
    table,
    selectedReferences,
    dialect,
    handleOpenNewReferenceModal,
    handleRemoveSelectedReferences,
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

  const handleCellLinkClick = React.useCallback((attribute: string, value: string) => {
    if (attribute !== 'table_reference' || !onOpenTable) return;
    const row = allReferences.find((r) => r.table_reference === value);
    if (row) onOpenTable(id_connection, row.reference_table_schema, row.reference_table_name);
  }, [allReferences, id_connection, onOpenTable]);

  const handleKeyDown = usePropertiesKeyboardShortcuts({
    onRemove: handleRemoveSelectedReferences,
    onSave: handleSavePendingChanges,
    onUndo: handleUndoSelectedDroppedReferences,
  });

  React.useEffect(() => {
    // Monta uma vez: a aba é recriada quando a tabela/conexão muda.
    if (mode === 'create') return;

    loadTableReferences(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedReferences([]);
  }, [referenceFilterText]);

  useSelectionReconciliation({
    rows: allReferences,
    setSelectedRows: setSelectedReferences,
    getSelectionKey: getReferenceSelectionKey,
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

      <ModalNewReference
        show={showNewReferenceModal}
        idConnection={id_connection}
        table={table}
        columns={availableColumns}
        tables={connectionInfo?.tables || []}
        onClose={() => setShowNewReferenceModal(false)}
        onAdd={handleAddPendingReference}
      />

      <FilterBar
        placeholder={t('placeholder.filterKeys')}
        value={referenceFilterText}
        onChange={setReferenceFilterText}
      />

      <Table<IReferenceSerialized>
        rowKeyExtractor={getReferenceSelectionKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedReferences}
        loading={loading.references}
        rows={filteredAndSortedReferences}
        sort={sort}
        onSort={handleSortReferences}
        onCellLinkClick={handleCellLinkClick}
        newRows={newReferenceRows}
        newRowsPosition="end"
        removedRows={removedReferenceKeys}
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
          onClick={handleOpenNewReferenceModal}
        >
          <AddIcon size={14} />
        </Button>

        <Button
          title="Remover itens selecionados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleRemoveSelectedReferences}
        >
          <RemoveIcon size={16} />
        </Button>

        {mode !== 'create' && (
          <RefreshButton
            menuPlacement="top"
            color={theme.bar.color}
            onRefresh={() => loadTableReferences(id_connection, { schema, table })}
          />
        )}

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredAndSortedReferences?.length > 1
            ? `${filteredAndSortedReferences?.length} Itens`
            : `${filteredAndSortedReferences?.length || 0} Item`}
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

export default ForeingKeys;
