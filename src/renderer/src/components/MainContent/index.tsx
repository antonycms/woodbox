import React from 'react';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { TabBar, TabWindow, TabContent } from '@renderer/components/Tabs';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import styles from './styles.module.css';

export const MainContent = () => {
  const { tabs, removeTab, addTab, activeTabId, setActiveTabId } = useAppTabContext();

  React.useEffect(() => {
    // addTab({ component: QueryEditor });
    // addTab({ component: () => <TableInfo id_connection="teste" table="teste" />, unsaved: true });
  }, []);

  return (
    <div className={styles.container}>
      <TabBar
        allowClose
        draggable
        activeTabId={activeTabId}
        onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
        idTabBar="app_tabs"
        onRemoveTab={(tab) => removeTab(tab.idTab)}
        tabs={tabs.map(({ id: idTab, title, unsaved }) => ({ idTab, title, unsaved }))}
        borderBottom
      />

      <TabWindow idTabBar="app_tabs">
        {tabs.map(({ id, component: TabComponent }) => (
          <TabContent key={id} idTab={id}>
            <TabComponent />
          </TabContent>
        ))}
      </TabWindow>
    </div>
  );
};
