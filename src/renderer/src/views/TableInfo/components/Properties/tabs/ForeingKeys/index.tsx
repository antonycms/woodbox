import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { AddIcon, DuplicateIcon, IconRefresh, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';

interface IForeingKeysProps extends ITableInfoProps {
  onOpenTable?: (idConnection: string, schema: string, table: string) => void;
}

const ForeingKeys = ({ id_connection, schema, table, onOpenTable }: IForeingKeysProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { references, loadTableReferences, lastFetchDate, loading } = useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();

  const lastFetchDateSerialized = toDateTime(lastFetchDate.references);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Nova chave',
        onClick: () => null,
      },
    ];
  }, []);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadTableReferences(id_connection, { schema, table });
  }, []);

  const referencesSerialized = references.map((ref) => ({
    ...ref,
    table_reference: !ref.table_schema
      ? ref.reference_table_name
      : `${ref.reference_table_schema}.${ref.reference_table_name}`,
  }));

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

      <Table
        selectable
        rowKeyExtractor={(item) => item.constraint_name}
        onContextMenu={onContextMenuTable}
        loading={loading.references}
        rows={referencesSerialized}
        onCellLinkClick={handleCellLinkClick}
        columns={[
          { label: 'Nome', attribute: 'constraint_name' },
          { label: 'Coluna', attribute: 'column_name' },
          { label: 'Tabela Referenciada', attribute: 'table_reference', isLink: true },
          { label: 'Coluna Referenciada', attribute: 'reference_column_name' },
          { label: 'Comentário', attribute: 'comment' },
          { label: 'Regra de Remoção', attribute: 'remove_rule' },
          { label: 'Regra de Alteração', attribute: 'update_rule' },
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

        <Button title="Atualizar dados" text smallIcon color={theme.bar.color}>
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>
    </>
  );
};

export default ForeingKeys;
