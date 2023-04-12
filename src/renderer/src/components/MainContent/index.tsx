import React from 'react';
import { TabBar, TabWindow, TabContent } from '@renderer/components/Tabs';
import { Welcolme } from '@renderer/components/Welcome';
import { QueryEditor } from '@renderer/views/QueryEditor';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

export const MainContent = () => {
  const { tabs, removeTab, activeTabId, setActiveTabId } = useAppTabContext();
  const { activeTheme: { mainTab: theme } } = useThemeContext();

  if (!tabs.length) return <Welcolme />;

  return (
    <div className={styles.container}>
      <TabBar
        allowClose
        draggable
        borderBottom
        color={theme.color}
        ascentColor={theme.ascentColor}
        backgroundColor={theme.backgroundColor}
        backgroundColorBar={theme.bar.backgroundColor}
        borderColor={theme.bar.borderColor}
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
