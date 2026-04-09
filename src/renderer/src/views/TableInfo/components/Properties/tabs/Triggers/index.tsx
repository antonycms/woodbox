import React from 'react';
import Table from '@renderer/components/Table2';
import { Spacer } from '@renderer/components/Spacer';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';

const Triggers = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { triggers, loadTableTriggers, lastFetchDate, loading } = useTableInfoContext();

  React.useEffect(() => {
    loadTableTriggers(id_connection, { schema, table });
  }, []);

  return (
    <>
      <Table
        selectable
        rowKeyExtractor={(item) => item.trigger_name}
        loading={loading.triggers}
        rows={triggers}
        columns={[
          { label: 'Nome', attribute: 'trigger_name' },
          { label: 'Momento', attribute: 'timing' },
          { label: 'Evento', attribute: 'event' },
          { label: 'Nível', attribute: 'orientation' },
          { label: 'Função', attribute: 'function_name' },
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

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {toDateTime(lastFetchDate.triggers)}
        </Text>
      </Bar>
    </>
  );
};

export default Triggers;
