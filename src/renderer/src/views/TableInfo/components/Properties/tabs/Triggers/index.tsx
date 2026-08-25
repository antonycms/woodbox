import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Bar } from '@renderer/components/Bar';
import type { ITriggerInfo } from '@renderer/contexts/Store';
import { useStoreContext } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { toDateTime } from '@renderer/utils/date';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { IColumn, ISortDirection, ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort } from '@renderer/utils/tableSort';
import { useFilteredSortedRows } from '../../hooks/useFilteredSortedRows';
import { useSelectionReconciliation } from '../../hooks/useSelectionReconciliation';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import FilterBar from '../../components/FilterBar';
import { generateTriggersDdl } from '../Columns/ddl';
import { getRendererDialect } from '@renderer/database/dialects';

const getTriggerSearchValues = (trigger: ITriggerInfo) => [
  trigger.trigger_name,
  trigger.timing,
  trigger.event,
  trigger.orientation,
  trigger.function_name,
  trigger.status,
];

const getTriggerSelectionKey = (trigger: ITriggerInfo) => trigger.trigger_name;

const getTriggerRowKey = (item: ITriggerInfo) => item.trigger_name;

const Triggers = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { t } = useI18n();
  const { triggers, loadTableTriggers, lastFetchDate, loading } = useTableInfoContext();
  const { connections } = useStoreContext();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const handleFunctionCtrlClick = useEditorCtrlClickNavigate(id_connection);
  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [selectedTriggers, setSelectedTriggers] = React.useState<ITriggerInfo[]>([]);
  const [triggerFilterText, setTriggerFilterText] = React.useState('');
  const [sort, setSort] = React.useState<ITableSort[]>([]);
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

  const onContextMenuTable = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      setContextMenuPosition({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  React.useEffect(() => {
    // Monta uma vez: a aba é recriada quando a tabela/conexão muda.
    loadTableTriggers(id_connection, { schema, table });
  }, []);

  React.useEffect(() => {
    setSelectedTriggers([]);
  }, [triggerFilterText]);

  useSelectionReconciliation({
    rows: triggers,
    setSelectedRows: setSelectedTriggers,
    getSelectionKey: getTriggerSelectionKey,
  });

  const filteredAndSortedTriggers = useFilteredSortedRows({
    rows: triggers,
    filterText: triggerFilterText,
    sort,
    getSearchValues: getTriggerSearchValues,
  });

  const handleSortTriggers = React.useCallback(
    (column: IColumn<ITriggerInfo>, sortType?: ISortDirection | null) => {
      setSort((current) => getNextSort(current, column.attribute, sortType));
    },
    [],
  );

  const handleFunctionLinkClick = React.useCallback(
    (_attr: string, value: string) => {
      const words = value.split('.');

      const functionName = words[1] || words[0];
      const functionSchema = words[1] ? words[0] : null;

      handleFunctionCtrlClick(functionName, functionSchema);
    },
    [handleFunctionCtrlClick],
  );

  const tableColumns = React.useMemo<IColumn<ITriggerInfo>[]>(
    () => [
      {
        label: t('field.name'),
        attribute: 'trigger_name',
        sortable: true,
      },
      {
        label: t('field.timing'),
        attribute: 'timing',
        sortable: true,
      },
      {
        label: t('field.event'),
        attribute: 'event',
        sortable: true,
      },
      {
        label: t('field.level'),
        attribute: 'orientation',
        sortable: true,
      },
      {
        label: t('field.function'),
        attribute: 'function_name',
        isLink: true,
        sortable: true,
      },
      {
        label: t('field.status'),
        attribute: 'status',
        sortable: true,
      },
    ],
    [t],
  );

  return (
    <>
      <ContextMenu
        position={contextMenuPosition}
        options={contextMenuOptions}
        onClose={() => setContextMenuPosition(null)}
      />

      <ModalGenerateDDL
        show={showDdlModal}
        sql={ddlSql}
        dialect={dialect}
        onClose={() => setShowDdlModal(false)}
      />

      <FilterBar
        placeholder={t('placeholder.filterTriggers')}
        value={triggerFilterText}
        onChange={setTriggerFilterText}
      />

      <Table
        rowKeyExtractor={getTriggerRowKey}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedTriggers}
        loading={loading.triggers}
        rows={filteredAndSortedTriggers}
        sort={sort}
        onSort={handleSortTriggers}
        onCellLinkClick={handleFunctionLinkClick}
        columns={tableColumns}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <RefreshButton
          menuPlacement="top"
          color={theme.bar.color}
          onRefresh={() => loadTableTriggers(id_connection, { schema, table })}
        />

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredAndSortedTriggers?.length > 1
            ? `${filteredAndSortedTriggers?.length} Itens`
            : `${filteredAndSortedTriggers?.length || 0} Item`}
        </Text>

        <Text userSelect={false} title={t('common.lastUpdatedAt')} color={theme.bar.color}>
          {t('common.updatedAt', { date: toDateTime(lastFetchDate.triggers) })}
        </Text>
      </Bar>
    </>
  );
};

export default Triggers;
