import React from 'react';
import { FaGripLines, FaRegListAlt } from 'react-icons/fa';
import { TabBar, TabWindow, TabContent } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/string';
import TableInfoProvider from '@renderer/contexts/TableInfoContext';
import { useAppTabContext } from '@renderer/contexts/AppTab';

import Data from './components/Data';
import Properties from './components/Properties';
import styles from './styles.module.css';
import { ITableInfoProps } from './dtos';
import { useThemeContext } from '@renderer/contexts/Theme';

const TableInfo = (props: ITableInfoProps) => {
  const {
    activeTheme: { tableInfo: theme },
  } = useThemeContext();
  const { addTab, getTab, setActiveTabId } = useAppTabContext();
  const [id] = React.useState(generateHash());
  const [activeTableInfoTabId, setActiveTableInfoTabId] = React.useState(
    props.initialTab || 'tabProperties',
  );

  const handleOpenTableSimple = React.useCallback(
    (idConnection: string, schema: string, table: string) => {
      const tabId = `${idConnection}_${schema}_${table}`;
      if (getTab(tabId)) {
        setActiveTabId(tabId);
      } else {
        addTab({
          id: tabId,
          title: table,
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
      const tabTitle = `${table} [${filterColumn}=${filterValue}]`;
      const escapedValue = filterValue.replace(/'/g, "''");
      const initialWhere = `"${filterColumn}" = '${escapedValue}'`;
      addTab({
        title: tabTitle,
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

  return (
    <div className={styles.container}>
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
            icon: () => <FaGripLines className={styles.icon} />,
          },
          {
            idTab: 'tabData',
            title: 'Dados',
            icon: () => <FaRegListAlt className={styles.icon} />,
          },
        ]}
      />

      <TabWindow idTabBar={id}>
        <TabContent idTab="tabProperties">
          <Properties {...props} onOpenTable={handleOpenTableSimple} />
        </TabContent>

        <TabContent idTab="tabData">
          <Data {...props} onOpenTable={handleOpenTable} />
        </TabContent>
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
