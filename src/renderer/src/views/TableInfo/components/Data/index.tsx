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
import { ITableInfoProps } from '../../dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { toDateTime } from '@renderer/utils/date';
import type { IColumn, ITableSort } from '@renderer/components/Table/dtos';
import { useThemeContext } from '@renderer/contexts/Theme';
import { getNextSort } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../Properties/components/ModalGenerateDDL';
import { generateInsertDdl } from '../Properties/tabs/Columns/ddl';

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
    },
  } = useThemeContext();
  const {
    columns,
    references,
    loadTableReferences,
    loading: loadingTableInfo,
  } = useTableInfoContext();

  const { getTableData } = useStoreContext();
  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const lastPageSearch = React.useRef(page);
  const [lastFetchDate, setLastFetchDate] = React.useState(new Date());
  const [editedFieldsRows, setEditedFieldsRows] = React.useState<Map<React.Key, any>>(new Map());
  const [whereInput, setWhereInput] = React.useState(initialWhere || '');
  const [appliedWhere, setAppliedWhere] = React.useState(initialWhere || '');
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  React.useEffect(() => {
    if (references.length === 0) {
      loadTableReferences(id_connection, { table, schema });
    }
  }, [id_connection, table, schema]);

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
        isLink: fkMap.has(column.column_name),
      })),
    [columns, fkMap],
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

  const handleSaveItems = () => {
    // if (!editedItems.length) return;
    // console.log(editedItems);
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

  React.useEffect(() => {
    loadData();
  }, []);

  return (
    <div className={styles.container}>
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
        rows={items}
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

            const prevRowEdited = newState.get(index) || {};
            newState.set(index, { ...prevRowEdited, [attribute]: value });

            return newState;
          });
        }}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button title="Salvar" text smallIcon color={theme.bar.color}>
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
