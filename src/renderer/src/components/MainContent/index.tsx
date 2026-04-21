import React from 'react';
import { TabBar, TabWindow, TabContent, IActiveTabContextMenu } from '@renderer/components/Tabs';
import { Welcolme } from '@renderer/components/Welcome';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';
import { IContextMenuOption } from '../ContextMenu';

export const MainContent = () => {
  const { tabs, removeTab, activeTabId, setActiveTabId } = useAppTabContext();
  const {
    activeTheme: { mainTab: theme },
  } = useThemeContext();

  const contextMenuOptions = React.useMemo<IContextMenuOption<IActiveTabContextMenu>[]>(
    () => [
      {
        text: 'Fechar aba',
        onClick: (info) => {
          setActiveTabId(info.tab.idTab);
          tabs.forEach((t) => t.id === info.tab.idTab && removeTab(t.id));
        },
      },
      tabs.length > 1 && {
        text: 'Fechar outras abas',
        onClick: (info) => {
          setActiveTabId(info.tab.idTab);
          tabs.forEach((t) => t.id !== info.tab.idTab && removeTab(t.id));
        },
      },
      tabs.length > 1 && {
        text: 'Fechar abas à esquerda',
        onClick: (info) => {
          const idx = tabs.findIndex((t) => t.id === info.tab.idTab);
          tabs.slice(0, idx).forEach((t) => removeTab(t.id));
        },
      },
      tabs.length > 1 && {
        text: 'Fechar abas à direita',
        onClick: (info) => {
          const idx = tabs.findIndex((t) => t.id === info.tab.idTab);
          tabs.slice(idx + 1).forEach((t) => removeTab(t.id));
        },
      },
      tabs.length > 1 && {
        text: 'Fechar todas as abas',
        onClick: () => {
          tabs.forEach((t) => removeTab(t.id));
        },
      },
    ],
    [tabs],
  );

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
        contextMenuOptions={contextMenuOptions}
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
