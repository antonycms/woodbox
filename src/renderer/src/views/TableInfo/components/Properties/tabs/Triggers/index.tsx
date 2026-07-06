import React from 'react';
import Table from '@renderer/components/Table';
import { Spacer } from '@renderer/components/Spacer';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import type { ITriggerInfo } from '@renderer/contexts/Store';
import { useStoreContext } from '@renderer/contexts/Store';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { ITableSort } from '@renderer/components/Table/dtos';
import { getNextSort, sortRows } from '@renderer/utils/tableSort';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import ModalGenerateDDL from '../../components/ModalGenerateDDL';
import { generateTriggersDdl } from '../Columns/ddl';
import { getRendererDialect } from '@renderer/database/dialects';
import styles from '../Columns/styles.module.css';

const Triggers = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
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

  const triggerFilterTextSerialized = triggerFilterText.trim().toLowerCase();

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

  React.useEffect(() => {
    setSelectedTriggers([]);
  }, [triggerFilterTextSerialized]);

  const filteredAndSortedTriggers = React.useMemo(() => {
    if (!triggerFilterTextSerialized) return sortRows(triggers, sort);

    const texts = triggerFilterTextSerialized.split(',').map((text) => text.trim());
    const triggersFiltered = triggers.filter((trigger) =>
      [
        trigger.trigger_name,
        trigger.timing,
        trigger.event,
        trigger.orientation,
        trigger.function_name,
        trigger.status,
      ].some((value) =>
        texts.some((text) => text && String(value ?? '').toLowerCase().includes(text)),
      ),
    );

    return sortRows(triggersFiltered, sort);
  }, [triggerFilterTextSerialized, triggers, sort]);

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

      <div
        className={styles.filterBar}
        style={{
          backgroundColor: theme.bar.backgroundColor,
          borderColor: theme.bar.borderColor,
        }}
      >
        <input
          className={styles.filterInput}
          placeholder="Filtrar triggers por nome, evento ou função (separe por virgula)"
          value={triggerFilterText}
          onChange={(event) => setTriggerFilterText(event.target.value)}
          style={{ color: theme.bar.color }}
          spellCheck={false}
        />
      </div>

      <Table
        rowKeyExtractor={(item) => item.trigger_name}
        onContextMenu={onContextMenuTable}
        onSelectRow={setSelectedTriggers}
        loading={loading.triggers}
        rows={filteredAndSortedTriggers}
        sort={sort}
        onSort={(column) => setSort((current) => getNextSort(current, column.attribute))}
        onCellLinkClick={(_attr, value) => {
          const words = value.split('.');

          const fn = words[1] || words[0];
          const schema = words[1] ? words[0] : null;

          handleFunctionCtrlClick(fn, schema);
        }}
        columns={[
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Nome',
            attribute: 'trigger_name',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Momento',
            attribute: 'timing',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Evento',
            attribute: 'event',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Nível',
            attribute: 'orientation',
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Função',
            attribute: 'function_name',
            isLink: true,
            sortable: true,
          },
          {
            title: 'Clique para ordenar por essa coluna',
            label: 'Status',
            attribute: 'status',
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
          onClick={() => loadTableTriggers(id_connection, { schema, table })}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Total de itens" color={theme.bar.color}>
          {filteredAndSortedTriggers?.length > 1
            ? `${filteredAndSortedTriggers?.length} Itens`
            : `${filteredAndSortedTriggers?.length || 0} Item`}
        </Text>

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {toDateTime(lastFetchDate.triggers)}
        </Text>
      </Bar>
    </>
  );
};

export default Triggers;
