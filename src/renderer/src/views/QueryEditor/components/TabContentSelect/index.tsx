import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { ContextMenu } from '@renderer/components/ContextMenu';
import { Spacer } from '@renderer/components/Spacer';
import Table, { ITableContextMenuData } from '@renderer/components/Table';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import { ExportIcon, IconRefresh, PanelFile, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { copyToClipboard } from '@renderer/utils/methods';
import TableInfoWithContext from '@renderer/views/TableInfo';
import type { IContextMenuTable } from '@renderer/views/TableInfo/components/Data';
import { IColumnReferenceInfo } from '@renderer/contexts/Store';
import { IColumn } from '@renderer/components/Table/dtos';
import { IQueryResult } from '../../dtos';

interface ITabContentSelectProps {
  id_connection: string;
  data: IQueryResult;
  references: Map<string, IColumnReferenceInfo[]>;
  onScrollEnd(): void;
  onSort(column: IColumn<any>): void;
  onRefresh(): void;
}

export const TabContentSelect = (props: ITabContentSelectProps) => {
  const { id_connection, data, onScrollEnd, onSort, onRefresh, references } = props;

  const { activeTheme } = useThemeContext();
  const { addTab } = useAppTabContext();

  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();

  const tabFkMap = new Map<string, IColumnReferenceInfo>();

  data?.tables_info?.forEach?.(({ name, schema }) => {
    const key = `${schema ? schema + '.' : ''}${name}`;

    references.get(key)?.forEach((ref) => tabFkMap.set(ref.column_name, ref));
  });

  const onContextMenuTable = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: ITableContextMenuData,
  ) => {
    setContextMenuTable({ data, position: { x: event.clientX, y: event.clientY } });
  };

  const onCellLinkClick = (attribute: string, value: any) => {
    const ref = tabFkMap.get(attribute);

    if (!ref || value === null || value === undefined) return;

    const escapedValue = String(value).replace(/'/g, "''");
    const initialWhere = `"${ref.reference_column_name}" = '${escapedValue}'`;

    const tabTitle = `${ref.reference_table_schema ? `${ref.reference_table_schema}.` : ''}${
      ref.reference_table_name
    } [${ref.reference_column_name}=${value}]`;

    addTab({
      title: tabTitle,
      data: {
        type: 'table-info',
        id_connection,
        schema: ref.reference_table_schema,
        table: ref.reference_table_name,
        initialWhere,
        filterLocked: true,
        initialTab: 'tabData',
      },
      component: () => (
        <TableInfoWithContext
          id_connection={id_connection}
          schema={ref.reference_table_schema}
          table={ref.reference_table_name}
          initialWhere={initialWhere}
          filterLocked
          initialTab="tabData"
        />
      ),
    });
  };

  return (
    <>
      <Table
        loading={!!data.loading}
        rows={data.rows}
        sort={data.orderBy}
        onSort={onSort}
        onScrollEnd={onScrollEnd}
        onContextMenu={onContextMenuTable}
        onCellLinkClick={onCellLinkClick}
        columns={data.columns.map((column) => ({
          title: 'Clique para ordenar por essa coluna',
          attribute: column,
          label: column,
          sortable: true,
          isLink: tabFkMap.has(column),
        }))}
      />

      <Bar
        backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
        borderColor={activeTheme.queryEditor.bar.borderColor}
      >
        <Button text smallIcon title="Salvar" color={activeTheme.queryEditor.bar.color}>
          <SaveIcon size={16} />
        </Button>

        <Button text smallIcon title="Exportar" color={activeTheme.queryEditor.bar.color}>
          <ExportIcon size={16} />
        </Button>

        <Button
          text
          smallIcon
          title="Mostrar dados do vínculo"
          color={activeTheme.queryEditor.bar.color}
        >
          <PanelFile size={16} />
        </Button>

        <Button
          text
          smallIcon
          title="Atualizar dados"
          onClick={onRefresh}
          color={activeTheme.queryEditor.bar.color}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text
          title="Tempo de execução da query"
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {data.execution_time_ms < 1000
            ? `${data.execution_time_ms}ms`
            : `${(data.execution_time_ms / 1000).toFixed(2)}s`}
        </Text>

        <Text
          title="Total de Linhas sendo exibidas"
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          Linhas exibidas: {data.rows.length}
        </Text>

        <Text
          title="Data da última atualização"
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          Atualizado em {toDateTime(data.date_run)}
        </Text>
      </Bar>

      <ContextMenu
        position={contextMenuTable?.position}
        onClose={() => setContextMenuTable(undefined)}
        options={[
          {
            text: 'Copiar',
            onClick: () => copyToClipboard(contextMenuTable?.data?.cellsText || ''),
          },
          {
            text: 'Copiar linha',
            onClick: () => copyToClipboard(contextMenuTable?.data?.rowsText || ''),
          },
          {
            text: 'Copiar linha como JSON',
            onClick: () => copyToClipboard(contextMenuTable?.data?.rowsJson || ''),
          },
        ]}
      />
    </>
  );
};
