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
import ModalGenerateDDL from './components/ModalGenerateDDL';
import { generateAddColumnsDdl } from './ddl';

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
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.columns);

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

  return (
    <>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL show={showDdlModal} sql={ddlSql} onClose={() => setShowDdlModal(false)} />

      <Table
        loading={loading.columns}
        rowKeyExtractor={(item) => item.column_name}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedColumns}
        rows={columns}
        onCopy={(rows) => console.log(rows)}
        columns={[
          { label: 'Nome da coluna', attribute: 'column_name', editable: true },
          { label: 'Tipo', attribute: 'data_type', editable: true },
          { label: 'Nulável', attribute: 'is_nullable', editable: true },
          { label: 'Padrão', attribute: 'column_default', editable: true },
          { label: 'Comentário', attribute: 'description', editable: true },
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

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>
    </>
  );
};

export default Columns;
