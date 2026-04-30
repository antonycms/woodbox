import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import type { IIndexInfo } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateIndexesDdl } from '../Columns/ddl';

const Indexes = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { indexes, loadTableIndexes, lastFetchDate, loading } = useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedIndexes, setSelectedIndexes] = React.useState<IIndexInfo[]>([]);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Gerar DDL',
        onClick: () => {
          setDdlSql(generateIndexesDdl(selectedIndexes));
          setShowDdlModal(true);
        },
      },
    ];
  }, [selectedIndexes]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadTableIndexes(id_connection, { schema, table });
  }, []);

  const sortedIndexes = React.useMemo(() => sortRows(indexes, sort), [indexes, sort]);

  return (
    <>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL show={showDdlModal} sql={ddlSql} onClose={() => setShowDdlModal(false)} />

      <Table
        rowKeyExtractor={(item) => item.index_name}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedIndexes}
        loading={loading.indexes}
        rows={sortedIndexes}
        sort={sort}
        onSort={(column) => setSort((current) => getNextSort(current, column.attribute))}
        columns={[
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Nome',
            attribute: 'index_name',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Método',
            attribute: 'index_method',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Único',
            attribute: 'is_unique',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Primário',
            attribute: 'is_primary',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Válido',
            attribute: 'is_valid',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Colunas',
            attribute: 'column_names',
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
            label: 'Predicado',
            attribute: 'predicate',
            sortable: true,
          },
        ]}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title="Atualizar dados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={() => loadTableIndexes(id_connection, { schema, table })}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {indexes?.length > 1 ? `${indexes?.length} Itens` : `${indexes?.length || 0} Item`}
        </Text>

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {toDateTime(lastFetchDate.indexes)}
        </Text>
      </Bar>
    </>
  );
};

export default Indexes;
