import React from 'react';
import Table from '@renderer/components/Table2';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { AddIcon, DuplicateIcon, IconRefresh, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';

const ForeingKeys = ({ id_connection, schema, table }: ITableInfoProps) => {
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
        columns={[
          { label: 'Nome', attribute: 'constraint_name' },
          { label: 'Coluna', attribute: 'column_name' },
          { label: 'Tabela Referenciada', attribute: 'table_reference' },
          { label: 'Coluna Referenciada', attribute: 'reference_column_name' },
          { label: 'Comentário', attribute: 'comment' },
          { label: 'Regra de Remoção', attribute: 'remove_rule' },
          { label: 'Regra de Alteração', attribute: 'update_rule' },
        ]}
      />

      <Bar>
        <Button title="Salvar" text smallIcon>
          <SaveIcon size={16} />
        </Button>

        <Button title="Adicionar" text smallIcon>
          <AddIcon size={14} />
        </Button>

        <Button title="Duplicar itens selecionados" text smallIcon>
          <DuplicateIcon size={20} />
        </Button>

        <Button title="Remover itens selecionados" text smallIcon>
          <RemoveIcon size={16} />
        </Button>

        <Button title="Atualizar dados" text smallIcon>
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Data da última atualização">
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>
    </>
  );
};

export default ForeingKeys;
