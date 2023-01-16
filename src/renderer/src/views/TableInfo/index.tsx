import React from 'react';
import { FaGripLines, FaRegListAlt } from 'react-icons/fa';
import { TabBar, TabWindow, TabContent } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/methods';
import TableInfoProvider from '@renderer/contexts/TableInfoContext';

import Data from './components/Data';
import Properties from './components/Properties';
import styles from './styles.module.css';
import { ITableInfoProps } from './dtos';

const TableInfo = (props: ITableInfoProps) => {
  const [id] = React.useState(generateHash());
  const [activeTabId, setActiveTabId] = React.useState('tabProperties');

  return (
    <div className={styles.container}>
      <TabBar
        idTabBar={id}
        activeTabId={activeTabId}
        onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
        ascentColor="purple"
        borderBottom
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
          <Data {...props} />
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
