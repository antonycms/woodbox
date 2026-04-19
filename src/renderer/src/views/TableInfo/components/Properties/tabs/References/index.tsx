import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';

interface IReferencesProps extends ITableInfoProps {
  onOpenTable?: (idConnection: string, schema: string, table: string) => void;
}

const References = ({ id_connection, schema, table, onOpenTable }: IReferencesProps) => {
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

  const handleCellLinkClick = (attribute: string, value: string) => {
    if (attribute !== 'source_table' || !onOpenTable) return;
    const row = rowsSerialized.find((r) => r.source_table === value);
    if (row) onOpenTable(id_connection, row.table_schema, row.table_name);
  };

  return (
    <>
      <Table
        selectable
        rowKeyExtractor={(item) => `${item.constraint_name}-${item.column_name}`}
        loading={loading.usedAsReference}
        rows={rowsSerialized}
        onCellLinkClick={handleCellLinkClick}
        columns={[
          { label: 'Nome', attribute: 'constraint_name' },
          { label: 'Tabela', attribute: 'source_table', isLink: true },
          { label: 'Coluna', attribute: 'column_name' },
          { label: 'Coluna Referenciada', attribute: 'reference_column_name' },
        ]}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title="Atualizar dados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={() => loadTableUsedAsReference(id_connection, { schema, table })}
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

export default References;
