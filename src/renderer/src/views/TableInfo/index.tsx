import React from 'react';
import { TabBar, TabWindow, TabContent } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/string';
import TableInfoProvider from '@renderer/contexts/TableInfoContext';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useAppTabContext } from '@renderer/contexts/AppTab';

import Data from './components/Data';
import Properties from './components/Properties';
import styles from './styles.module.css';
import { ITableInfoProps } from './dtos';

import IconFaRegularListAlt from '~icons/fa-regular/list-alt';
import IconFaSolidGripLines from '~icons/fa-solid/grip-lines';

const TableInfo = (props: ITableInfoProps) => {
  const {
    activeTheme: { tableInfo: theme },
  } = useThemeContext();
  const { addTab, getTab, setActiveTabId } = useAppTabContext();
  const [id] = React.useState(generateHash());
  const [mode, setMode] = React.useState(props.mode || 'view');
  const [table, setTable] = React.useState(props.table);
  const [activeTableInfoTabId, setActiveTableInfoTabId] = React.useState(
    props.initialTab || 'tabProperties',
  );
  const propertiesRefreshRef = React.useRef<(() => void | Promise<void>) | undefined>(undefined);
  const dataRefreshRef = React.useRef<(() => void | Promise<void>) | undefined>(undefined);
  const isCreateMode = mode === 'create';

  const tabsProps = React.useMemo(() => ({ ...props, mode, table }), [mode, props, table]);

  const handleCreateApplied = React.useCallback(
    (createdTable: string) => {
      const tabId = `${props.id_connection}_${props.schema}_${createdTable}`;
      const title = `${props.schema ? `${props.schema}.` : ''}${createdTable}`;

      if (props.draftTabId) {
        addTab({
          replaceId: props.draftTabId,
          id: tabId,
          title,
          unsaved: false,
          data: {
            type: 'table-info',
            id_connection: props.id_connection,
            schema: props.schema,
            table: createdTable,
          },
          component: () => (
            <TableInfoWithContext
              id_connection={props.id_connection}
              schema={props.schema}
              table={createdTable}
            />
          ),
        });

        return;
      }

      setTable(createdTable);
      setMode('view');
    },
    [addTab, props.draftTabId, props.id_connection, props.schema],
  );

  const handleOpenTableSimple = React.useCallback(
    (idConnection: string, schema: string, table: string) => {
      const tabId = `${idConnection}_${schema}_${table}`;
      if (getTab(tabId)) {
        setActiveTabId(tabId);
      } else {
        addTab({
          id: tabId,
          title: `${schema ? `${schema}.` : ''}${table}`,
          data: {
            type: 'table-info',
            id_connection: idConnection,
            schema,
            table,
          },
          component: () => (
            <TableInfoWithContext id_connection={idConnection} schema={schema} table={table} />
          ),
        });
      }
    },
    [addTab, getTab, setActiveTabId],
  );

  const handleOpenTable = React.useCallback(
    (
      idConnection: string,
      schema: string,
      table: string,
      filterColumn: string,
      filterValue: string,
    ) => {
      const tabTitle = `${schema ? `${schema}.` : ''}${table} [${filterColumn}=${filterValue}]`;
      const escapedValue = filterValue.replace(/'/g, "''");
      const initialWhere = `"${filterColumn}" = '${escapedValue}'`;
      addTab({
        title: tabTitle,
        data: {
          type: 'table-info',
          id_connection: idConnection,
          schema,
          table,
          initialWhere,
          filterLocked: true,
          initialTab: 'tabData',
        },
        component: () => (
          <TableInfoWithContext
            id_connection={idConnection}
            schema={schema}
            table={table}
            initialWhere={initialWhere}
            filterLocked
            initialTab="tabData"
          />
        ),
      });
    },
    [addTab],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'F5') return;

      event.preventDefault();

      if (activeTableInfoTabId === 'tabProperties') {
        propertiesRefreshRef.current?.();
        return;
      }

      if (activeTableInfoTabId === 'tabData') {
        dataRefreshRef.current?.();
      }
    },
    [activeTableInfoTabId],
  );

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
      <TabBar
        borderBottom
        idTabBar={id}
        activeTabId={activeTableInfoTabId}
        onActiveTab={(tab) => setActiveTableInfoTabId(tab?.idTab)}
        ascentColor={theme.tab.ascentColor}
        backgroundColor={theme.tab.backgroundColor}
        backgroundColorBar={theme.tab.bar.backgroundColor}
        borderColor={theme.tab.borderColor}
        color={theme.tab.color}
        tabs={[
          {
            idTab: 'tabProperties',
            title: 'Propriedades',
            icon: () => <IconFaSolidGripLines className={styles.icon} width={12} height={12} />,
          },
          !isCreateMode && {
            idTab: 'tabData',
            title: 'Dados',
            icon: () => <IconFaRegularListAlt className={styles.icon} width={12} height={12} />,
          },
        ].filter(Boolean)}
      />

      <TabWindow idTabBar={id}>
        <TabContent idTab="tabProperties">
          <Properties
            {...tabsProps}
            onOpenTable={handleOpenTableSimple}
            onCreateApplied={handleCreateApplied}
            onRegisterRefresh={(refresh) => {
              propertiesRefreshRef.current = refresh;
            }}
          />
        </TabContent>

        {!isCreateMode && (
          <TabContent idTab="tabData">
            <Data
              {...tabsProps}
              onOpenTable={handleOpenTable}
              onRegisterRefresh={(refresh) => {
                dataRefreshRef.current = refresh;
              }}
            />
          </TabContent>
        )}
      </TabWindow>
    </div>
  );
};

const TableInfoWithContext = (props: ITableInfoProps) => {
  return (
    <TableInfoProvider>
      <TableInfo {...props} />
    </TableInfoProvider>
  );
};

export default TableInfoWithContext;
