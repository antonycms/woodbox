import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import type { IColumnInfo } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { AddIcon, DuplicateIcon, IconRefresh, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateAddColumnsDdl } from './ddl';
import styles from './styles.module.css';

const Columns = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { columns, references, restrictions, loadTableColumns, lastFetchDate, loading } =
    useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedColumns, setSelectedColumns] = React.useState<IColumnInfo[]>([]);
  const [columnFilterText, setColumnFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.columns);
  const columnFilterTextSerialized = columnFilterText.trim().toLowerCase();

  const filteredColumnsAndSortedColumns = React.useMemo(() => {
    if (!columnFilterTextSerialized) return sortRows(columns, sort);

    const texts = columnFilterTextSerialized.split(',').map((t) => t.trim());

    const columnsFiltered = columns.filter((column) =>
      [column.column_name, column.data_type].some((value) =>
        texts.some((text) => text && value?.toLowerCase().includes(text)),
      ),
    );

    return sortRows(columnsFiltered, sort);
  }, [columns, columnFilterTextSerialized, sort]);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Nova coluna',
        onClick: () => null,
      },
      {
        text: 'Duplicar itens selecionados',
        onClick: () => null,
      },
      {
        text: 'Excluir itens selecionados',
        onClick: () => null,
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
  }, [schema, table, selectedColumns, references, restrictions]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadTableColumns(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedColumns([]);
  }, [columns, columnFilterTextSerialized]);

  return (
    <>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL show={showDdlModal} sql={ddlSql} onClose={() => setShowDdlModal(false)} />

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
        rowKeyExtractor={(item) => item.column_name}
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
    </>
  );
};

export default Columns;
