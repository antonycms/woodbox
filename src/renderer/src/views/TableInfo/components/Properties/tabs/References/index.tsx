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

const References = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { usedAsReference, loadTableUsedAsReference, lastFetchDate, loading } =
    useTableInfoContext();

  const lastFetchDateSerialized = toDateTime(lastFetchDate.usedAsReference);

  React.useEffect(() => {
    loadTableUsedAsReference(id_connection, { schema, table });
  }, []);

  const rowsSerialized = usedAsReference.map((ref) => ({
    ...ref,
    source_table: !ref.table_schema ? ref.table_name : `${ref.table_schema}.${ref.table_name}`,
  }));

  return (
    <>
      <Table
        selectable
        rowKeyExtractor={(item) => `${item.constraint_name}-${item.column_name}`}
        loading={loading.usedAsReference}
        rows={rowsSerialized}
        columns={[
          { label: 'Nome', attribute: 'constraint_name' },
          { label: 'Tabela', attribute: 'source_table' },
          { label: 'Coluna', attribute: 'column_name' },
          { label: 'Coluna Referenciada', attribute: 'reference_column_name' },
        ]}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
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

export default References;
