import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import type { ITriggerInfo } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateTriggersDdl } from '../Columns/ddl';

const Triggers = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { triggers, loadTableTriggers, lastFetchDate, loading } = useTableInfoContext();
  const handleFunctionCtrlClick = useEditorCtrlClickNavigate(id_connection);
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedTriggers, setSelectedTriggers] = React.useState<ITriggerInfo[]>([]);
  const [ddlSql, setDdlSql] = React.useState('');
  const [showDdlModal, setShowDdlModal] = React.useState(false);

  const contextMenuOptions = React.useMemo(() => {
    return [
      {
        text: 'Gerar DDL',
        onClick: () => {
          setDdlSql(generateTriggersDdl(selectedTriggers));
          setShowDdlModal(true);
        },
      },
    ];
  }, [selectedTriggers]);

  const onContextMenuTable = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  React.useEffect(() => {
    loadTableTriggers(id_connection, { schema, table });
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
        rowKeyExtractor={(item) => item.trigger_name}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedTriggers}
        loading={loading.triggers}
        rows={triggers}
        onCellLinkClick={(_attr, value) => {
          const words = value.split('.');

          const fn = words[1] || words[0];
          const schema = words[1] ? words[0] : null;

          handleFunctionCtrlClick(fn, schema);
        }}
        columns={[
          { label: 'Nome', attribute: 'trigger_name' },
          { label: 'Momento', attribute: 'timing' },
          { label: 'Evento', attribute: 'event' },
          { label: 'Nível', attribute: 'orientation' },
          { label: 'Função', attribute: 'function_name', isLink: true },
          { label: 'Status', attribute: 'status' },
        ]}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title="Atualizar dados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={() => loadTableTriggers(id_connection, { schema, table })}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {triggers?.length > 1 ? `${triggers?.length} Itens` : `${triggers?.length || 0} Item`}
        </Text>

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {toDateTime(lastFetchDate.triggers)}
        </Text>
      </Bar>
    </>
  );
};

export default Triggers;
