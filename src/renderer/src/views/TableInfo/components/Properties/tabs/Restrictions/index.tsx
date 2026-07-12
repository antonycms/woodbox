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
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateRestrictionsDdl } from '../Columns/ddl';
import ModalNewRestriction from './components/ModalNewRestriction';
import { getRendererDialect } from '@renderer/database/dialects';
import styles from '../Columns/styles.module.css';

const getRestrictionSelectionKey = (restriction: IColumnRestrictionsInfo) =>
  (restriction as IColumnRestrictionsInfo & { __pendingId?: string }).__pendingId ||
  restriction.constraint_name;

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
      __colors,
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
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
  const restrictionFilterTextSerialized = restrictionFilterText.trim().toLowerCase();
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
  const allRestrictions = React.useMemo(
    () => [
      ...restrictions.map((restriction) => {
        if (!droppedConstraintNames.has(restriction.constraint_name)) return restriction;

        return {
          ...restriction,
          __pendingAction: 'drop',
          __style: {
            backgroundColor: __colors.redTransparent,
            textDecoration: 'line-through',
          },
        };
      }),
      ...pendingRestrictions,
    ],
    [__colors.redTransparent, restrictions, droppedConstraintNames, pendingRestrictions],
  );
  const filteredAndSortedRestrictions = React.useMemo(() => {
    if (!restrictionFilterTextSerialized) return sortRows(allRestrictions, sort);

    const texts = restrictionFilterTextSerialized.split(',').map((text) => text.trim());
    const restrictionsFiltered = allRestrictions.filter((restriction) =>
      [
        restriction.constraint_name,
        restriction.constraint_type,
        Array.isArray(restriction.column_names)
          ? restriction.column_names.join(', ')
          : restriction.column_names,
        restriction.expression,
        restriction.comment,
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

    return sortRows(restrictionsFiltered, sort);
  }, [allRestrictions, restrictionFilterTextSerialized, sort]);
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
        showToast({ type: 'warn', title: 'Já existe uma restrição com esse nome.' });
        return false;
      }

      addPendingRestriction(restriction);
      return true;
    },
    [addPendingRestriction, allRestrictions, showToast],
  );

  const handleRemoveSelectedRestrictions = React.useCallback(() => {
    if (!selectedRestrictions.length) {
      showToast({ type: 'warn', title: 'Selecione uma ou mais restrições para remover.' });
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
      .filter(
        (restriction) =>
          (restriction as { __pendingAction?: string }).__pendingAction === 'drop' ||
          droppedConstraintNames.has(restriction.constraint_name),
      )
      .map((restriction) => restriction.constraint_name);

    if (!constraintNames.length) return;

    removePendingDroppedRestrictions(constraintNames);
    setSelectedRestrictions([]);
  }, [selectedRestrictions, droppedConstraintNames, removePendingDroppedRestrictions]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Nova restrição',
        onClick: handleOpenNewRestrictionModal,
      },
      {
        text: 'Excluir itens selecionados',
        onClick: handleRemoveSelectedRestrictions,
      },
      {
        text: 'Gerar DDL',
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
  ]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        handleRemoveSelectedRestrictions();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSavePendingChanges();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleUndoSelectedDroppedRestrictions();
      }
    },
    [
      handleRemoveSelectedRestrictions,
      handleSavePendingChanges,
      handleUndoSelectedDroppedRestrictions,
    ],
  );

  React.useEffect(() => {
    if (mode === 'create') return;

    loadTableRestrictions(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedRestrictions([]);
  }, [restrictionFilterTextSerialized]);

  React.useEffect(() => {
    setSelectedRestrictions((currentSelectedRestrictions) => {
      if (!currentSelectedRestrictions.length) return currentSelectedRestrictions;

      const restrictionsByKey = new Map(
        allRestrictions.map((restriction) => [
          getRestrictionSelectionKey(restriction),
          restriction,
        ]),
      );
      const nextSelectedRestrictions = currentSelectedRestrictions
        .map((restriction) => restrictionsByKey.get(getRestrictionSelectionKey(restriction)))
        .filter((restriction): restriction is IColumnRestrictionsInfo => !!restriction);

      if (
        nextSelectedRestrictions.length === currentSelectedRestrictions.length &&
        nextSelectedRestrictions.every(
          (restriction, index) => restriction === currentSelectedRestrictions[index],
        )
      ) {
        return currentSelectedRestrictions;
      }

      return nextSelectedRestrictions;
    });
  }, [allRestrictions]);

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
          placeholder="Filtrar restrições por nome, tipo ou coluna (separe por virgula)"
          value={restrictionFilterText}
          onChange={(event) => setRestrictionFilterText(event.target.value)}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <Table
        rows={filteredAndSortedRestrictions}
        sort={sort}
        onSort={(column, sortType) =>
          setSort((current) => getNextSort(current, column.attribute, sortType))
        }
        loading={loading.restrictions}
        rowKeyExtractor={getRestrictionSelectionKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedRestrictions}
        columns={[
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Nome',
            attribute: 'constraint_name',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Tipo',
            attribute: 'constraint_type',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Colunas',
            attribute: 'column_names',
            type: 'autocomplete-multi',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Expressão',
            attribute: 'expression',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Comentário',
            attribute: 'comment',
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
          <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
            Atualizado em {lastFetchDateSerialized}
          </Text>
        )}
      </Bar>
    </div>
  );
};

export default Restrictios;
