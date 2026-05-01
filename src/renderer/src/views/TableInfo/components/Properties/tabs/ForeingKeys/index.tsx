import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import type { IColumnReferenceInfo } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { AddIcon, DuplicateIcon, IconRefresh, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateReferencesDdl } from '../Columns/ddl';

interface IForeingKeysProps extends ITableInfoProps {
  onOpenTable?: (idConnection: string, schema: string, table: string) => void;
}

interface IReferenceSerialized extends IColumnReferenceInfo {
  table_reference: string;
}

const ForeingKeys = ({ id_connection, schema, table, onOpenTable }: IForeingKeysProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { references, loadTableReferences, lastFetchDate, loading } = useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedReferences, setSelectedReferences] = React.useState<IReferenceSerialized[]>([]);
  const [sort, setSort] = React.useState<ITableSort[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.references);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Nova chave',
        onClick: () => null,
      },
      {
        text: 'Gerar DDL',
        onClick: () => {
          setDdlSql(generateReferencesDdl(schema, table, selectedReferences));
          setShowDdlModal(true);
        },
      },
    ];
  }, [schema, table, selectedReferences]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadTableReferences(id_connection, { schema, table });
  }, []);

  const referencesSerialized = React.useMemo(() => {
    return references.map((ref) => ({
      ...ref,
      table_reference: !ref.table_schema
        ? ref.reference_table_name
        : `${ref.reference_table_schema}.${ref.reference_table_name}`,
    }));
  }, [references]);

  const sortedReferences = React.useMemo(
    () => sortRows(referencesSerialized, sort),
    [referencesSerialized, sort],
  );

  const handleCellLinkClick = (attribute: string, value: string) => {
    if (attribute !== 'table_reference' || !onOpenTable) return;
    const row = referencesSerialized.find((r) => r.table_reference === value);
    if (row) onOpenTable(id_connection, row.reference_table_schema, row.reference_table_name);
  };

  return (
    <>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL show={showDdlModal} sql={ddlSql} onClose={() => setShowDdlModal(false)} />

      <Table
        rowKeyExtractor={(item) => `${item.constraint_name}-${item.column_name}`}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedReferences}
        loading={loading.references}
        rows={sortedReferences}
        sort={sort}
        onSort={(column) => setSort((current) => getNextSort(current, column.attribute))}
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
          onClick={() => loadTableReferences(id_connection, { schema, table })}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {referencesSerialized?.length > 1
            ? `${referencesSerialized?.length} Itens`
            : `${referencesSerialized?.length || 0} Item`}
        </Text>

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>
    </>
  );
};

export default ForeingKeys;
