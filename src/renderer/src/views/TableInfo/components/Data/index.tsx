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
import { generateInsertDdl, generateUpdateDdl } from '../Properties/tabs/Columns/ddl';

interface IDataProps extends ITableInfoProps {
  onOpenTable?: (
    idConnection: string,
    schema: string,
    table: string,
    filterColumn: string,
    filterValue: string,
  ) => void;
}

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
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const lastPageSearch = React.useRef(page);
  const [lastFetchDate, setLastFetchDate] = React.useState(new Date());
  const [editedFieldsRows, setEditedFieldsRows] = React.useState<
    Map<React.Key, Record<string, any>>
  >(new Map());
  const [showNoPkModal, setShowNoPkModal] = React.useState(false);
  const [applyingChanges, setApplyingChanges] = React.useState(false);
  const [whereInput, setWhereInput] = React.useState(initialWhere || '');
  const [appliedWhere, setAppliedWhere] = React.useState(initialWhere || '');
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

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
        if (!editedFieldsRows.has(index)) return item;

        return {
          ...item,
          __style: {
            ...(item as any).__style,
            backgroundColor: '#d2992233',
          },
        };
      }),
    [items, editedFieldsRows],
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

  const handleAddItem = () => {
    // setItems((prevState) => [
    //   {
    //     id: 'kaskakdksa ',
    //     name: 'testando',
    //     age: null,
    //     dj: null,
    //     __table_hash_item: `${generateHash()}_${prevState.length}`,
    //     __style: { backgroundColor: theme.green, color: theme.dark },
    //     __table_disable_cell_edited_color: true,
    //   },
    //   ...prevState,
    // ]);
  };

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
    setItems((prevState) => [...prevState, ...data]);
  }, [id_connection, loading, schema, table, page, appliedWhere, sort]);

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
    setItems(data);
  }, [id_connection, loading, schema, table, appliedWhere, sort]);

  const applyEditedRows = React.useCallback(
    async (whereColumns: string[]) => {
      if (!editedFieldsRows.size || applyingChanges) return;

      const rowsToUpdate = [...editedFieldsRows.entries()]
        .map(([rowKey, changes]) => ({
          originalRow: items[Number(rowKey)],
          changes,
        }))
        .filter((row) => row.originalRow && Object.keys(row.changes).length);

      const sql = generateUpdateDdl(schema, table, rowsToUpdate, whereColumns);
      if (!sql.trim()) return;

      setApplyingChanges(true);

      try {
        await runSql(id_connection, sql);
        setEditedFieldsRows(new Map());
        setShowNoPkModal(false);
        showToast({ type: 'success', title: 'Dados atualizados com sucesso!' });
        await handleRefresh();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao atualizar dados.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setApplyingChanges(false);
      }
    },
    [
      editedFieldsRows,
      applyingChanges,
      items,
      schema,
      table,
      runSql,
      id_connection,
      showToast,
      handleRefresh,
    ],
  );

  const handleSaveItems = React.useCallback(() => {
    if (!editedFieldsRows.size) return;

    if (!primaryKeyColumns.length) {
      setShowNoPkModal(true);
      return;
    }

    applyEditedRows(primaryKeyColumns);
  }, [editedFieldsRows, primaryKeyColumns, applyEditedRows]);

  const handleApplyWithoutPrimaryKey = React.useCallback(() => {
    applyEditedRows(columns.map((column) => column.column_name));
  }, [applyEditedRows, columns]);

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

        setItems(data);
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } finally {
        setLoading(false);
      }
    },
    [id_connection, schema, table, appliedWhere, sort, loading],
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
        setItems(data);
        setPage(1);
        lastPageSearch.current = 1;
        setLastFetchDate(new Date());
      } finally {
        setLoading(false);
      }
    },
    [id_connection, whereInput, loading, schema, table, sort],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;

      event.preventDefault();
      handleSaveItems();
    },
    [handleSaveItems],
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
        rowKeyExtractor={(_, index) => index}
        onScrollEnd={loadData}
        loading={isLoading}
        onContextMenu={onContextMenuTable}
        editedRows={editedFieldsRows}
        onCellLinkClick={handleFkCellClick}
        onEditRow={(index, attribute, value) => {
          setEditedFieldsRows((prevState) => {
            const newState = new Map(prevState);
            const prevRowEdited = { ...(newState.get(index) || {}) };
            const originalValue = items[index]?.[attribute];

            if (String(originalValue ?? '') === String(value ?? '')) {
              delete prevRowEdited[attribute];

              if (Object.keys(prevRowEdited).length) newState.set(index, prevRowEdited);
              else newState.delete(index);

              return newState;
            }

            newState.set(index, { ...prevRowEdited, [attribute]: value });

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

        <Button title="Adicionar" text smallIcon color={theme.bar.color}>
          <AddIcon size={14} />
        </Button>

        <Button title="Duplicar itens selecionados" text smallIcon color={theme.bar.color}>
          <DuplicateIcon size={20} />
        </Button>

        <Button title="Remover itens selecionados" text smallIcon color={theme.bar.color}>
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
          { text: 'Definir como null' },
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
