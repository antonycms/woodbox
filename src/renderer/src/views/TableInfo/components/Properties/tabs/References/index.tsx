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
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import styles from '../Columns/styles.module.css';

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
  const [referenceFilterText, setReferenceFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);

  const lastFetchDateSerialized = toDateTime(lastFetchDate.usedAsReference);
  const referenceFilterTextSerialized = referenceFilterText.trim().toLowerCase();

  React.useEffect(() => {
    loadTableUsedAsReference(id_connection, { schema, table });
  }, []);

  const rowsSerialized = React.useMemo(
    () =>
      usedAsReference.map((ref) => ({
        ...ref,
        source_table: !ref.table_schema ? ref.table_name : `${ref.table_schema}.${ref.table_name}`,
      })),
    [usedAsReference],
  );

  const filteredAndSortedRows = React.useMemo(() => {
    if (!referenceFilterTextSerialized) return sortRows(rowsSerialized, sort);

    const texts = referenceFilterTextSerialized.split(',').map((text) => text.trim());
    const rowsFiltered = rowsSerialized.filter((row) =>
      [row.constraint_name, row.source_table, row.column_name, row.reference_column_name].some(
        (value) => texts.some((text) => text && String(value ?? '').toLowerCase().includes(text)),
      ),
    );

    return sortRows(rowsFiltered, sort);
  }, [referenceFilterTextSerialized, rowsSerialized, sort]);

  const handleCellLinkClick = (attribute: string, value: string) => {
    if (attribute !== 'source_table' || !onOpenTable) return;
    const row = rowsSerialized.find((r) => r.source_table === value);
    if (row) onOpenTable(id_connection, row.table_schema, row.table_name);
  };

  return (
    <>
      <div
        className={styles.filterBar}
        style={{
          backgroundColor: theme.bar.backgroundColor,
          borderColor: theme.bar.borderColor,
        }}
      >
        <input
          className={styles.filterInput}
          placeholder="Filtrar referências por nome, tabela ou coluna (separe por virgula)"
          value={referenceFilterText}
          onChange={(event) => setReferenceFilterText(event.target.value)}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <Table
        rowKeyExtractor={(item) =>
          `${item.table_schema}-${item.table_name}-${item.constraint_name}-${item.column_name}`
        }
        loading={loading.usedAsReference}
        rows={filteredAndSortedRows}
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
            label: 'Tabela',
            attribute: 'source_table',
            isLink: true,
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
            label: 'Coluna Referenciada',
            attribute: 'reference_column_name',
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
          onClick={() => loadTableUsedAsReference(id_connection, { schema, table })}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredAndSortedRows?.length > 1
            ? `${filteredAndSortedRows?.length} Itens`
            : `${filteredAndSortedRows?.length || 0} Item`}
        </Text>

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>
    </>
  );
};

export default References;
