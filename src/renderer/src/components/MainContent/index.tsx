import React from 'react';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { TabBar, TabWindow, TabContent } from '@renderer/components/Tabs';
import { QueryEditor } from '@renderer/views/QueryEditor';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

export const MainContent = () => {
  const { tabs, removeTab, addTab, activeTabId, setActiveTabId } = useAppTabContext();
  const { activeTheme } = useThemeContext();

  React.useEffect(() => {
    addTab({ component: QueryEditor });
  }, []);

  return (
    <div className={styles.container}>
      <TabBar
        allowClose
        draggable
        borderBottom
        color={activeTheme.mainTab.color}
        ascentColor={activeTheme.mainTab.ascentColor}
        backgroundColor={activeTheme.mainTab.backgroundColor}
        backgroundColorBar={activeTheme.mainTab.bar.backgroundColor}
        activeTabId={activeTabId}
        onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
        idTabBar="app_tabs"
        onRemoveTab={(tab) => removeTab(tab.idTab)}
        tabs={tabs.map(({ id: idTab, title, unsaved }) => ({ idTab, title, unsaved }))}
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
