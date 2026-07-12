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
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateReferencesDdl } from '../Columns/ddl';
import ModalNewReference from './components/ModalNewReference';
import { getRendererDialect } from '@renderer/database/dialects';
import styles from '../Columns/styles.module.css';

interface IForeingKeysProps extends ITableInfoProps {
  onOpenTable?: (idConnection: string, schema: string, table: string) => void;
}

interface IReferenceSerialized extends IColumnReferenceInfo {
  table_reference: string;
  __pendingId?: string;
  __pendingAction?: 'create' | 'drop';
}

const getReferenceSelectionKey = (reference: IColumnReferenceInfo) =>
  (reference as IColumnReferenceInfo & { __pendingId?: string }).__pendingId ||
  `${reference.constraint_name}-${reference.column_name}`;

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
  const referenceFilterTextSerialized = referenceFilterText.trim().toLowerCase();
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

  const allReferences = React.useMemo<IReferenceSerialized[]>(() => {
    const existingReferences = references.map<IReferenceSerialized>((ref) => ({
      ...ref,
      table_reference: !ref.reference_table_schema
        ? ref.reference_table_name
        : `${ref.reference_table_schema}.${ref.reference_table_name}`,
      ...(droppedConstraintNames.has(ref.constraint_name)
        ? {
            __pendingAction: 'drop' as const,
            __style: {
              backgroundColor: __colors.redTransparent,
              textDecoration: 'line-through',
            },
          }
        : {}),
    }));

    const createdReferences = pendingReferences.map<IReferenceSerialized>((ref) => ({
      ...ref,
      table_reference: !ref.reference_table_schema
        ? ref.reference_table_name
        : `${ref.reference_table_schema}.${ref.reference_table_name}`,
    }));

    return [...existingReferences, ...createdReferences];
  }, [__colors.redTransparent, references, droppedConstraintNames, pendingReferences]);

  const filteredAndSortedReferences = React.useMemo(() => {
    if (!referenceFilterTextSerialized) return sortRows(allReferences, sort);

    const texts = referenceFilterTextSerialized.split(',').map((text) => text.trim());
    const referencesFiltered = allReferences.filter((reference) =>
      [
        reference.constraint_name,
        reference.column_name,
        reference.table_reference,
        reference.reference_column_name,
        reference.comment,
        reference.remove_rule,
        reference.update_rule,
      ].some((value) =>
        texts.some(
          (text) =>
            text &&
            String(value ?? '')
              .toLowerCase()
              .includes(text),
        ),
      ),
    );

    return sortRows(referencesFiltered, sort);
  }, [allReferences, referenceFilterTextSerialized, sort]);

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
        showToast({ type: 'warn', title: 'Já existe uma chave estrangeira com esse nome.' });
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
      showToast({ type: 'warn', title: 'Selecione uma ou mais chaves estrangeiras para remover.' });
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
      .filter(
        (reference) =>
          reference.__pendingAction === 'drop' ||
          droppedConstraintNames.has(reference.constraint_name),
      )
      .map((reference) => reference.constraint_name);

    if (!constraintNames.length) return;

    removePendingDroppedReferences(constraintNames);
    setSelectedReferences([]);
  }, [selectedReferences, droppedConstraintNames, removePendingDroppedReferences]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Nova chave',
        onClick: handleOpenNewReferenceModal,
      },
      {
        text: 'Excluir itens selecionados',
        onClick: handleRemoveSelectedReferences,
      },
      {
        text: 'Gerar DDL',
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
  ]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleCellLinkClick = (attribute: string, value: string) => {
    if (attribute !== 'table_reference' || !onOpenTable) return;
    const row = allReferences.find((r) => r.table_reference === value);
    if (row) onOpenTable(id_connection, row.reference_table_schema, row.reference_table_name);
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        handleRemoveSelectedReferences();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSavePendingChanges();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleUndoSelectedDroppedReferences();
      }
    },
    [handleRemoveSelectedReferences, handleSavePendingChanges, handleUndoSelectedDroppedReferences],
  );

  React.useEffect(() => {
    if (mode === 'create') return;

    loadTableReferences(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedReferences([]);
  }, [referenceFilterTextSerialized]);

  React.useEffect(() => {
    setSelectedReferences((currentSelectedReferences) => {
      if (!currentSelectedReferences.length) return currentSelectedReferences;

      const referencesByKey = new Map(
        allReferences.map((reference) => [getReferenceSelectionKey(reference), reference]),
      );
      const nextSelectedReferences = currentSelectedReferences
        .map((reference) => referencesByKey.get(getReferenceSelectionKey(reference)))
        .filter((reference): reference is IReferenceSerialized => !!reference);

      if (
        nextSelectedReferences.length === currentSelectedReferences.length &&
        nextSelectedReferences.every(
          (reference, index) => reference === currentSelectedReferences[index],
        )
      ) {
        return currentSelectedReferences;
      }

      return nextSelectedReferences;
    });
  }, [allReferences]);

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

      <div
        className={styles.filterBar}
        style={{
          backgroundColor: theme.bar.backgroundColor,
          borderColor: theme.bar.borderColor,
        }}
      >
        <input
          className={styles.filterInput}
          placeholder="Filtrar chaves por nome, coluna ou tabela (separe por virgula)"
          value={referenceFilterText}
          onChange={(event) => setReferenceFilterText(event.target.value)}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <Table<IReferenceSerialized>
        rowKeyExtractor={getReferenceSelectionKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedReferences}
        loading={loading.references}
        rows={filteredAndSortedReferences}
        sort={sort}
        onSort={(column, sortType) =>
          setSort((current) => getNextSort(current, column.attribute, sortType))
        }
        onCellLinkClick={handleCellLinkClick}
        columns={[
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Nome',
            attribute: 'constraint_name',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Coluna',
            attribute: 'column_name',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Tabela Referenciada',
            attribute: 'table_reference',
            isLink: true,
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Coluna Referenciada',
            attribute: 'reference_column_name',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Comentário',
            attribute: 'comment',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Regra de Remoção',
            attribute: 'remove_rule',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Regra de Alteração',
            attribute: 'update_rule',
            sortable: true,
          },
        ]}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title="Salvar"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleSavePendingChanges}
        >
          <SaveIcon size={16} />
        </Button>

        <Button
          title="Cancelar alterações"
          text
          smallIcon
          color={theme.bar.color}
          onClick={clearPendingChanges}
        >
          <CancelIcon size={16} />
        </Button>

        <Button
          title="Adicionar"
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
          <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
            Atualizado em {lastFetchDateSerialized}
          </Text>
        )}
      </Bar>
    </div>
  );
};

export default ForeingKeys;
