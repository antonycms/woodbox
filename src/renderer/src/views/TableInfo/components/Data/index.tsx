import React from 'react';
import Table, { type ITableContextMenuData } from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { copyToClipboard } from '@renderer/utils/methods';
import { ContextMenu } from '@renderer/components/ContextMenu';
import {
  AddIcon,
  DuplicateIcon,
  IconRefresh,
  PanelFile,
  RemoveIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import styles from './styles.module.css';
import { useStoreContext } from '@renderer/contexts/Store';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { ITableInfoProps } from '../../dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { toDateTime } from '@renderer/utils/date';
import type { IColumn, ITableSort } from '@renderer/components/Table/dtos';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { getNextSort } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../Properties/components/ModalGenerateDDL';
import {
  generateDeleteDdl,
  generateInsertDdl,
  generateUpdateDdl,
} from '../Properties/tabs/Columns/ddl';
import { generateHash } from '@renderer/utils/string';

interface IDataProps extends ITableInfoProps {
  onOpenTable?: (
    idConnection: string,
    schema: string,
    table: string,
    filterColumn: string,
    filterValue: string,
  ) => void;
}

const normalizeCellValue = (value: any) => (value === '' ? null : value);

const Data = ({
  id_connection,
  schema,
  table,
  initialWhere,
  filterLocked,
  onOpenTable,
}: IDataProps) => {
  const {
    activeTheme: {
      tableInfo: { data: theme },
      modal: colors,
    },
  } = useThemeContext();
  const {
    columns,
    references,
    restrictions,
    loadTableReferences,
    loadTableRestrictions,
    loading: loadingTableInfo,
  } = useTableInfoContext();

  const { getTableData, runSql } = useStoreContext();
  const { showToast } = useToast();
  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const lastPageSearch = React.useRef(page);
  const [lastFetchDate, setLastFetchDate] = React.useState(new Date());
  const [editedFieldsRows, setEditedFieldsRows] = React.useState<
    Map<React.Key, Record<string, any>>
  >(new Map());
  const [droppedRows, setDroppedRows] = React.useState<Map<React.Key, Record<string, any>>>(
    new Map(),
  );
  const [newRows, setNewRows] = React.useState<Map<React.Key, Record<string, any>>>(new Map());
  const [showNoPkModal, setShowNoPkModal] = React.useState(false);
  const [applyingChanges, setApplyingChanges] = React.useState(false);
  const [whereInput, setWhereInput] = React.useState(initialWhere || '');
  const [appliedWhere, setAppliedWhere] = React.useState(initialWhere || '');
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  const serializeRows = React.useCallback(
    (rows: any[]) =>
      rows.map((row) => ({
        ...row,
        __table_hash_item: `row_${generateHash()}`,
      })),
    [],
  );

  React.useEffect(() => {
    if (references.length === 0) {
      loadTableReferences(id_connection, { table, schema });
    }

    if (restrictions.length === 0) {
      loadTableRestrictions(id_connection, { table, schema });
    }
  }, [
    id_connection,
    table,
    schema,
    references.length,
    restrictions.length,
    loadTableReferences,
    loadTableRestrictions,
  ]);

  const fkMap = React.useMemo(
    () => new Map(references.map((r) => [r.column_name, r])),
    [references],
  );

  const handleFkCellClick = React.useCallback(
    (attribute: string, value: any) => {
      const ref = fkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;
      onOpenTable?.(
        id_connection,
        ref.reference_table_schema,
        ref.reference_table_name,
        ref.reference_column_name,
        String(value),
      );
    },
    [fkMap, id_connection, onOpenTable],
  );

  const isLoading = loadingTableInfo.columns || loading;

  const lastFetchDateSerialized = toDateTime(lastFetchDate);

  const columnsSerialized = React.useMemo(
    () =>
      columns.map<IColumn>((column) => ({
        title: 'Clique para ordenar por essa coluna',
        label: column.column_name,
        attribute: column.column_name,
        required: !!column.is_nullable,
        sortable: true,
        editable: true,
        isLink: fkMap.has(column.column_name),
      })),
    [columns, fkMap],
  );

  const primaryKeyColumns = React.useMemo(
    () =>
      restrictions.find((restriction) => restriction.constraint_type === 'primary_key')
        ?.column_names || [],
    [restrictions],
  );

  const itemsWithPendingStyles = React.useMemo(
    () =>
      items.map((item, index) => {
        const key = item.__table_hash_item ?? index;

        if (droppedRows.has(key)) {
          return {
            ...item,
            __pendingAction: 'drop',
            __style: {
              ...(item as any).__style,
              backgroundColor: '#ff676733',
              textDecoration: 'line-through',
            },
          };
        }

        if (!editedFieldsRows.has(key)) return item;

        return {
          ...item,
          __style: {
            ...(item as any).__style,
            backgroundColor: '#d2992233',
          },
        };
      }),
    [items, droppedRows, editedFieldsRows],
  );

  const onContextMenuTable = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: ITableContextMenuData,
  ) => {
    setContextMenuTable({
      data,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const handleAddItem = React.useCallback(() => {
    const key = `new_${generateHash()}`;

    setNewRows((prevState) => new Map(prevState).set(key, {}));
  }, []);

  const handleDuplicateSelectedRows = React.useCallback(() => {
    if (!selectedRows.length) {
      showToast({ type: 'warn', title: 'Selecione uma ou mais linhas para duplicar.' });
      return;
    }

    setNewRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        const sourceRow = {
          ...row,
          ...(newRows.get(row.__key_row) || {}),
          ...(editedFieldsRows.get(row.__key_row) || {}),
        };

        const duplicatedRow = columns.reduce<Record<string, any>>((acc, column) => {
          acc[column.column_name] = sourceRow[column.column_name];
          return acc;
        }, {});

        nextState.set(`new_${generateHash()}`, duplicatedRow);
      });

      return nextState;
    });

    setContextMenuTable(undefined);
  }, [columns, editedFieldsRows, newRows, selectedRows, showToast]);

  const loadData = React.useCallback(async () => {
    const newPage = page + 1;

    if (loading || newPage === lastPageSearch.current) return;

    setLoading(true);
    const { data } = await getTableData(id_connection, {
      schema,
      table,
      page: newPage,
      where: appliedWhere || undefined,
      orderBy: sort,
    });
    setLoading(false);

    setLastFetchDate(new Date());

    lastPageSearch.current = newPage;

    if (!data.length) return;

    setPage(newPage);
    setItems((prevState) => [...prevState, ...serializeRows(data)]);
  }, [id_connection, loading, schema, table, page, appliedWhere, sort, serializeRows]);

  const handleRefresh = React.useCallback(async () => {
    if (loading) return;

    setLoading(true);
    const { data } = await getTableData(id_connection, {
      schema,
      table,
      page: 1,
      where: appliedWhere || undefined,
      orderBy: sort,
    });
    setLoading(false);

    lastPageSearch.current = 1;
    setPage(1);
    setLastFetchDate(new Date());
    setNewRows(new Map());
    setEditedFieldsRows(new Map());
    setDroppedRows(new Map());
    setItems(serializeRows(data));
  }, [id_connection, loading, schema, table, appliedWhere, sort, serializeRows]);

  const applyPendingRows = React.useCallback(
    async (whereColumns: string[]) => {
      const rowsToInsert = [...newRows.values()].filter((row) => Object.keys(row).length);
      const hasEditedRows = !!editedFieldsRows.size;
      const hasDroppedRows = !!droppedRows.size;

      if ((!rowsToInsert.length && !hasEditedRows && !hasDroppedRows) || applyingChanges) return;

      const rowsToUpdate = [...editedFieldsRows.entries()]
        .map(([rowKey, changes]) => ({
          originalRow:
            items.find((item) => item.__table_hash_item === rowKey) || items[Number(rowKey)],
          rowKey,
          changes,
        }))
        .filter(
          (row) =>
            row.originalRow && Object.keys(row.changes).length && !droppedRows.has(row.rowKey),
        );

      const deleteSql = generateDeleteDdl(schema, table, [...droppedRows.values()], whereColumns);
      const insertSql = generateInsertDdl(
        schema,
        table,
        rowsToInsert,
        columns.map((column) => column.column_name),
      );
      const updateSql = generateUpdateDdl(schema, table, rowsToUpdate, whereColumns);
      const sql = [deleteSql, insertSql, updateSql].filter((item) => item.trim()).join('\n\n');

      if (!sql.trim()) return;

      setApplyingChanges(true);

      try {
        await runSql(id_connection, sql);
        setNewRows(new Map());
        setEditedFieldsRows(new Map());
        setDroppedRows(new Map());
        setShowNoPkModal(false);
        showToast({ type: 'success', title: 'Dados salvos com sucesso!' });
        await handleRefresh();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao salvar dados.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setApplyingChanges(false);
      }
    },
    [
      editedFieldsRows,
      droppedRows,
      newRows,
      applyingChanges,
      items,
      schema,
      table,
      columns,
      runSql,
      id_connection,
      showToast,
      handleRefresh,
    ],
  );

  const handleSaveItems = React.useCallback(() => {
    const hasNewRows = [...newRows.values()].some((row) => Object.keys(row).length);

    if (!hasNewRows && !editedFieldsRows.size && !droppedRows.size) return;

    if ((editedFieldsRows.size || droppedRows.size) && !primaryKeyColumns.length) {
      setShowNoPkModal(true);
      return;
    }

    applyPendingRows(primaryKeyColumns);
  }, [newRows, editedFieldsRows, droppedRows, primaryKeyColumns, applyPendingRows]);

  const handleApplyWithoutPrimaryKey = React.useCallback(() => {
    applyPendingRows(columns.map((column) => column.column_name));
  }, [applyPendingRows, columns]);

  const handleCancelSelectedRowsEditions = React.useCallback(() => {
    if (!selectedRows.length) return;

    setEditedFieldsRows((prevState) => {
      const newState = new Map(prevState);

      selectedRows.forEach((row) => {
        newState.delete(row.__key_row);
      });

      return newState;
    });
  }, [selectedRows]);

  const handleUndoSelectedDroppedRows = React.useCallback(() => {
    if (!selectedRows.length) return;

    setDroppedRows((prevState) => {
      const newState = new Map(prevState);

      selectedRows.forEach((row) => {
        newState.delete(row.__key_row);
      });

      return newState;
    });
  }, [selectedRows]);

  const handleRemoveSelectedRows = React.useCallback(() => {
    if (!selectedRows.length) {
      showToast({ type: 'warn', title: 'Selecione uma ou mais linhas para remover.' });
      return;
    }

    setNewRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        if (row.__is_new_row) nextState.delete(row.__key_row);
      });

      return nextState;
    });

    setDroppedRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        if (!row.__is_new_row) nextState.set(row.__key_row, row);
      });

      return nextState;
    });

    setEditedFieldsRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        nextState.delete(row.__key_row);
      });

      return nextState;
    });

    setContextMenuTable(undefined);
  }, [selectedRows, showToast]);

  const handleSort = React.useCallback(
    async (column: IColumn) => {
      if (loading || !column.sortable) return;

      const nextSort = getNextSort(sort, column.attribute);
      setSort(nextSort);
      setLoading(true);

      try {
        const { data } = await getTableData(id_connection, {
          schema,
          table,
          page: 1,
          where: appliedWhere || undefined,
          orderBy: nextSort,
        });

        setNewRows(new Map());
        setEditedFieldsRows(new Map());
        setDroppedRows(new Map());
        setItems(serializeRows(data));
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } finally {
        setLoading(false);
      }
    },
    [id_connection, schema, table, appliedWhere, sort, loading, serializeRows],
  );

  const handleFilterKeyDown = React.useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || loading) return;

      const newWhere = whereInput || undefined;
      setAppliedWhere(whereInput);
      setLoading(true);
      try {
        const { data } = await getTableData(id_connection, {
          schema,
          table,
          page: 1,
          where: newWhere,
          orderBy: sort,
        });
        setNewRows(new Map());
        setEditedFieldsRows(new Map());
        setDroppedRows(new Map());
        setItems(serializeRows(data));
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } finally {
        setLoading(false);
      }
    },
    [id_connection, whereInput, loading, schema, table, sort, serializeRows],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSaveItems();
        return;
      }

      const target = event.target as HTMLElement;
      const isEditableTarget = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        handleRemoveSelectedRows();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelSelectedRowsEditions();
        handleUndoSelectedDroppedRows();
        return;
      }
    },
    [
      handleCancelSelectedRowsEditions,
      handleRemoveSelectedRows,
      handleSaveItems,
      handleUndoSelectedDroppedRows,
    ],
  );

  React.useEffect(() => {
    loadData();
  }, []);

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
      <div className={styles.filterBar} style={{ backgroundColor: theme.bar.backgroundColor }}>
        <input
          className={styles.filterInput}
          placeholder="Filtrar resultados (ex: id = 1 and status = true)"
          value={whereInput}
          onChange={(e) => !filterLocked && setWhereInput(e.target.value)}
          onKeyDown={handleFilterKeyDown}
          style={{ color: theme.bar.color, opacity: filterLocked ? 0.6 : 1 }}
          disabled={filterLocked}
          spellCheck={false}
        />
      </div>

      <Table
        columns={columnsSerialized}
        rows={itemsWithPendingStyles}
        sort={sort}
        onSort={handleSort}
        rowKeyExtractor={(row, index) => row.__table_hash_item ?? index}
        onScrollEnd={loadData}
        loading={isLoading}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedRows}
        editedRows={editedFieldsRows}
        newRows={newRows}
        onCellLinkClick={handleFkCellClick}
        onEditNewRow={(rowKey, attribute, value) => {
          const normalizedValue = normalizeCellValue(value);

          setNewRows((prevState) => {
            const newState = new Map(prevState);
            const prevRowEdited = { ...(newState.get(rowKey) || {}) };

            newState.set(rowKey, { ...prevRowEdited, [attribute]: normalizedValue });

            return newState;
          });
        }}
        onEditRow={(index, attribute, value, rowKey) => {
          const normalizedValue = normalizeCellValue(value);
          const key = rowKey ?? index;
          const row = items[index];

          setEditedFieldsRows((prevState) => {
            const newState = new Map(prevState);
            const prevRowEdited = { ...(newState.get(key) || {}) };
            const originalValue = row?.[attribute];

            if (String(originalValue ?? '') === String(normalizedValue ?? '')) {
              delete prevRowEdited[attribute];

              if (Object.keys(prevRowEdited).length) newState.set(key, prevRowEdited);
              else newState.delete(key);

              return newState;
            }

            newState.set(key, { ...prevRowEdited, [attribute]: normalizedValue });

            return newState;
          });
        }}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title="Salvar"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleSaveItems}
          loading={applyingChanges}
        >
          <SaveIcon size={16} />
        </Button>

        <Button title="Adicionar" text smallIcon color={theme.bar.color} onClick={handleAddItem}>
          <AddIcon size={14} />
        </Button>

        <Button
          title="Duplicar itens selecionados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleDuplicateSelectedRows}
        >
          <DuplicateIcon size={20} />
        </Button>

        <Button
          title="Remover itens selecionados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleRemoveSelectedRows}
        >
          <RemoveIcon size={16} />
        </Button>

        <Button title="Mostrar dados do vínculo" text smallIcon color={theme.bar.color}>
          <PanelFile size={16} />
        </Button>

        <Button
          title="Atualizar dados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={handleRefresh}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} color={theme.bar.color} title="Data da última atualização">
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>

      <ModalGenerateDDL show={showDdlModal} sql={ddlSql} onClose={() => setShowDdlModal(false)} />

      <Modal
        title="Tabela sem primary key"
        width="560px"
        show={showNoPkModal}
        closeOutside={!applyingChanges}
        onClose={applyingChanges ? undefined : () => setShowNoPkModal(false)}
      >
        <Text color={colors.color || theme.bar.color}>
          A tabela não possui primary key. Usar todas as colunas no WHERE pode atualizar nenhuma
          linha ou múltiplas linhas se existirem registros duplicados.
        </Text>

        <div style={{ height: 16 }} />

        <Text color={colors.color || theme.bar.color}>
          Deseja continuar usando todas as colunas originais para tentar localizar cada linha?
        </Text>

        <div style={{ height: 16 }} />

        <Row>
          <Spacer />

          <Button
            text
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            onClick={() => setShowNoPkModal(false)}
            disabled={applyingChanges}
            xs={6}
            sm={4}
            md={3}
          >
            Cancelar
          </Button>

          <Button
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
            onClick={handleApplyWithoutPrimaryKey}
            loading={applyingChanges}
            xs={6}
            sm={5}
            md={4}
          >
            Usar todas as colunas
          </Button>
        </Row>
      </Modal>

      <ContextMenu
        position={contextMenuTable?.position}
        onClose={() => setContextMenuTable(undefined)}
        options={[
          {
            text: 'Copiar',
            onClick: () => copyToClipboard(contextMenuTable?.data?.cellsText || ''),
          },
          {
            text: 'Copiar linha',
            onClick: () => copyToClipboard(contextMenuTable?.data?.rowsText || ''),
          },
          {
            text: 'Copiar linha como JSON',
            onClick: () => copyToClipboard(contextMenuTable?.data?.rowsJson || ''),
          },
          {
            text: 'Excluir itens selecionados',
            onClick: handleRemoveSelectedRows,
          },
          {
            text: 'Gerar DDL de INSERT da linha',
            onClick: () => {
              setDdlSql(
                generateInsertDdl(
                  schema,
                  table,
                  contextMenuTable?.data?.rows || [],
                  columns.map((column) => column.column_name),
                ),
              );
              setShowDdlModal(true);
            },
          },
          {
            text: 'Gerar DDL de INSERT das células selecionadas',
            onClick: () => {
              setDdlSql(
                generateInsertDdl(
                  schema,
                  table,
                  contextMenuTable?.data?.selectedCellRows || [],
                  columns.map((column) => column.column_name),
                ),
              );
              setShowDdlModal(true);
            },
          },
        ]}
      />
    </div>
  );
};

export default Data;

export interface IContextMenuTable {
  data: ITableContextMenuData | null;
  position: {
    x: number;
    y: number;
  };
}
