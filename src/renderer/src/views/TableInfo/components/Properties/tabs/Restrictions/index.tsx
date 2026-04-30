import React from 'react';
import Table from '@renderer/components/Table';
import { AddIcon, DuplicateIcon, IconRefresh, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import type { IColumnRestrictionsInfo } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateRestrictionsDdl } from '../Columns/ddl';

const Restrictios = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { restrictions, loadTableRestrictions, lastFetchDate, loading } = useTableInfoContext();
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedRestrictions, setSelectedRestrictions] = React.useState<IColumnRestrictionsInfo[]>(
    [],
  );
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.restrictions);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Nova restrição',
        onClick: () => null,
      },
      {
        text: 'Gerar DDL',
        onClick: () => {
          setDdlSql(generateRestrictionsDdl(schema, table, selectedRestrictions));
          setShowDdlModal(true);
        },
      },
    ];
  }, [schema, table, selectedRestrictions]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadTableRestrictions(id_connection, { schema, table });
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
        rows={restrictions}
        loading={loading.restrictions}
        rowKeyExtractor={(item) => item.constraint_name}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedRestrictions}
        columns={[
          { label: 'Nome', attribute: 'constraint_name' },
          { label: 'Tipo', attribute: 'constraint_type' },
          { label: 'Colunas', attribute: 'column_names' },
          { label: 'Expressão', attribute: 'expression' },
          { label: 'Comentário', attribute: 'comment' },
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
          onClick={() => loadTableRestrictions(id_connection, { schema, table })}
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

export default Restrictios;
