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
  const { addTab } = useAppTabContext();
  const [id] = React.useState(generateHash());
  const [activeTabId, setActiveTabId] = React.useState(props.initialTab || 'tabProperties');

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
        activeTabId={activeTabId}
        onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
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
          <Properties {...props} />
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
