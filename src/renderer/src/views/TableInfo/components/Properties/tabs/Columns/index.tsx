import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import type { IColumnInfo } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { type IPendingColumnCreate, useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import {
  AddIcon,
  CancelIcon,
  DuplicateIcon,
  IconRefresh,
  RemoveIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateAddColumnsDdl } from './ddl';
import ModalNewColumn from './components/ModalNewColumn';
import styles from './styles.module.css';

const getColumnSelectionKey = (column: IColumnInfo) =>
  (column as IColumnInfo & { __pendingId?: string }).__pendingId || column.column_name;

const Columns = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { showToast } = useToast();
  const {
    columns,
    pendingColumns,
    pendingDroppedColumns,
    columnTypes,
    references,
    restrictions,
    addPendingColumn,
    removePendingColumn,
    addPendingDroppedColumns,
    removePendingDroppedColumns,
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
  const columnFilterTextSerialized = columnFilterText.trim().toLowerCase();
  const droppedColumnNames = React.useMemo(
    () => new Set(pendingDroppedColumns.map((column) => column.column_name)),
    [pendingDroppedColumns],
  );
  const allColumns = React.useMemo(
    () => [
      ...columns.map((column) => {
        if (!droppedColumnNames.has(column.column_name)) return column;

        return {
          ...column,
          __pendingAction: 'drop',
          __style: {
            backgroundColor: '#ff676733',
            textDecoration: 'line-through',
          },
        };
      }),
      ...pendingColumns,
    ],
    [columns, droppedColumnNames, pendingColumns],
  );
  const hasPrimaryKey = React.useMemo(
    () =>
      restrictions.some((restriction) => restriction.constraint_type === 'primary_key') ||
      pendingColumns.some((column) => column.is_primary_key),
    [pendingColumns, restrictions],
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
    (column: Parameters<typeof addPendingColumn>[0]) => {
      const columnName = column.column_name.toLowerCase();
      const alreadyExists = allColumns.some(
        (item) => item.column_name.toLowerCase() === columnName,
      );

      if (alreadyExists) {
        showToast({ type: 'warn', title: 'Já existe uma coluna com esse nome.' });
        return false;
      }

      addPendingColumn(column);
      return true;
    },
    [addPendingColumn, allColumns, showToast],
  );

  const handleRemoveSelectedColumns = React.useCallback(() => {
    if (!selectedColumns.length) {
      showToast({ type: 'warn', title: 'Selecione uma ou mais colunas para remover.' });
      return;
    }

    selectedColumns.forEach((column) => {
      const pendingId = (column as IPendingColumnCreate).__pendingId;

      if (pendingId) {
        removePendingColumn(pendingId);
        return;
      }

      addPendingDroppedColumns([column]);
    });

    setContextMenuPosition(null);
  }, [selectedColumns, removePendingColumn, addPendingDroppedColumns, showToast]);

  const handleClearPendingChanges = React.useCallback(() => {
    clearPendingChanges();
    setSelectedColumns([]);
  }, [clearPendingChanges]);

  const handleUndoSelectedDroppedColumns = React.useCallback(() => {
    const columnNames = selectedColumns
      .filter(
        (column) =>
          (column as { __pendingAction?: string }).__pendingAction === 'drop' ||
          droppedColumnNames.has(column.column_name),
      )
      .map((column) => column.column_name);

    if (!columnNames.length) return;

    removePendingDroppedColumns(columnNames);
    setSelectedColumns([]);
  }, [selectedColumns, droppedColumnNames, removePendingDroppedColumns]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Nova coluna',
        onClick: handleOpenNewColumnModal,
      },
      {
        text: 'Duplicar itens selecionados',
        onClick: () => null,
      },
      {
        text: 'Excluir itens selecionados',
        onClick: handleRemoveSelectedColumns,
      },
      {
        text: 'Gerar DDL',
        onClick: () => {
          setDdlSql(
            generateAddColumnsDdl(schema, table, selectedColumns, { references, restrictions }),
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
    handleOpenNewColumnModal,
    handleRemoveSelectedColumns,
  ]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadTableColumns(id_connection, { schema, table });
    loadTableRestrictions(id_connection, { schema, table });
    loadTableReferences(id_connection, { schema, table });
    loadColumnTypes(id_connection);
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
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(
        target?.tagName,
      );

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        handleRemoveSelectedColumns();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        openPendingChangesSqlModal(id_connection, { schema, table });
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleUndoSelectedDroppedColumns();
      }
    },
    [
      handleRemoveSelectedColumns,
      handleUndoSelectedDroppedColumns,
      id_connection,
      openPendingChangesSqlModal,
      schema,
      table,
    ],
  );

  return (
    <div style={{ display: 'contents' }} onKeyDown={handleKeyDown}>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL show={showDdlModal} sql={ddlSql} onClose={() => setShowDdlModal(false)} />

      <ModalNewColumn
        show={showNewColumnModal}
        types={columnTypes}
        hasPrimaryKey={hasPrimaryKey}
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
          placeholder="Filtrar colunas por nome ou tipo (separe por virgula)"
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
        sort={sort}
        onSort={(column) => setSort((current) => getNextSort(current, column.attribute))}
        columns={[
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Nome da coluna',
            attribute: 'column_name',
            editable: true,
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Tipo',
            attribute: 'data_type',
            editable: true,
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Nulável',
            attribute: 'is_nullable',
            editable: true,
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Padrão',
            attribute: 'column_default',
            editable: true,
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Comentário',
            attribute: 'description',
            editable: true,
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
          onClick={() => openPendingChangesSqlModal(id_connection, { schema, table })}
        >
          <SaveIcon size={16} />
        </Button>

        <Button
          title="Cancelar alterações"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleClearPendingChanges}
        >
          <CancelIcon size={16} />
        </Button>

        <Button
          title="Adicionar"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleOpenNewColumnModal}
        >
          <AddIcon size={14} />
        </Button>

        <Button title="Duplicar itens selecionados" text smallIcon color={theme.bar.color}>
          <DuplicateIcon size={20} />
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

        <Button
          title="Atualizar dados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={() => loadTableColumns(id_connection, { schema, table })}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredColumnsAndSortedColumns?.length > 1
            ? `${filteredColumnsAndSortedColumns?.length} Itens`
            : `${filteredColumnsAndSortedColumns?.length || 0} Item`}
        </Text>

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>
    </div>
  );
};

export default Columns;
