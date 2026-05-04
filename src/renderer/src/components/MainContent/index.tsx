import React from 'react';
import { TabBar, TabWindow, TabContent, IActiveTabContextMenu } from '@renderer/components/Tabs';
import { Welcolme } from '@renderer/components/Welcome';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useStoreContext } from '@renderer/contexts/Store';
import { copyToClipboard } from '@renderer/utils/methods';
import { IContextMenuOption } from '@renderer/components/ContextMenu';
import styles from './styles.module.css';

export const MainContent = () => {
  const { tabs, removeTab, moveTab, activeTabId, setActiveTabId } = useAppTabContext();
  const { connections } = useStoreContext();
  const {
    activeTheme: { mainTab: theme },
  } = useThemeContext();

  const connectionNameById = React.useMemo(() => {
    return new Map(connections.map((connection) => [connection.id, connection.description]));
  }, [connections]);

  const contextMenuOptions = React.useMemo<IContextMenuOption<IActiveTabContextMenu>[]>(
    () => [
      {
        text: 'Copiar',
        onClick: (info) => copyToClipboard(info.tab.title),
      },
      {
        text: 'Fechar aba',
        onClick: (info) => {
          removeTab(info.tab.idTab);
        },
      },
      tabs.length > 1 && {
        text: 'Fechar outras abas',
        onClick: (info) => {
          setActiveTabId(info.tab.idTab);
          removeTab(tabs.filter((t) => t.id !== info.tab.idTab).map((t) => t.id));
        },
      },
      tabs.length > 1 && {
        text: 'Fechar abas à esquerda',
        onClick: (info) => {
          const idx = tabs.findIndex((t) => t.id === info.tab.idTab);
          removeTab(tabs.slice(0, idx).map((t) => t.id));
        },
      },
      tabs.length > 1 && {
        text: 'Fechar abas à direita',
        onClick: (info) => {
          const idx = tabs.findIndex((t) => t.id === info.tab.idTab);
          removeTab(tabs.slice(idx + 1).map((t) => t.id));
        },
      },
      tabs.length > 1 && {
        text: 'Fechar todas as abas',
        onClick: () => {
          removeTab(tabs.map((t) => t.id));
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
        onMoveTab={moveTab}
        height="42px"
        contextMenuOptions={contextMenuOptions}
        tabs={tabs.map(({ id: idTab, title, subtitle, unsaved, data }) => ({
          idTab,
          unsaved,
          title,
          subtitle: subtitle || connectionNameById.get(data?.id_connection),
        }))}
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
