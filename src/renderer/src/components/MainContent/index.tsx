import React from 'react';
import {
  TabBar,
  TabSplit,
  IActiveTabContextMenu,
} from '@renderer/components/Tabs';
import { Welcolme } from '@renderer/components/Welcome';
import { useAppTabContext, type IAppTab, type IAppTabData } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useAIChatPanelContext } from '@renderer/contexts/AIChatPanel';
import { useI18n } from '@renderer/contexts/I18n';
import { useStoreContext } from '@renderer/contexts/Store';
import { copyToClipboard } from '@renderer/utils/methods';
import { IContextMenuOption } from '@renderer/components/ContextMenu';
import styles from './styles.module.css';

const getTabConnectionId = (data?: IAppTabData) => {
  return data && 'id_connection' in data ? data.id_connection : undefined;
};

export const MainContent = () => {
  const [groupEditorRequest, setGroupEditorRequest] = React.useState<{
    groupId: string;
    position: { x: number; y: number };
  }>();
  const {
    tabs,
    tabGroups,
    removeTab,
    moveTab,
    activeTabId,
    setActiveTabId,
    createTabGroup,
    addTabToGroup,
    removeTabFromGroup,
    updateTabGroup,
    ungroupTabGroup,
    closeTabGroup,
  } = useAppTabContext();
  const { visible: aiChatVisible } = useAIChatPanelContext();
  const { t } = useI18n();
  const { connections } = useStoreContext();
  const {
    activeTheme: { mainTab: theme },
  } = useThemeContext();

  const connectionNameById = React.useMemo(() => {
    return new Map(connections.map((connection) => [connection.id, connection.description]));
  }, [connections]);

  const collapsedGroupIds = React.useMemo(
    () => new Set(tabGroups.filter((group) => group.collapsed).map((group) => group.id)),
    [tabGroups],
  );

  const splitTabs = React.useMemo<IMainSplitTab[]>(() => {
    return tabs.map(({ id, groupId, title, subtitle, unsaved, data, component }) => ({
      id,
      idTab: id,
      groupId,
      title,
      unsaved,
      component,
      subtitle: subtitle || connectionNameById.get(getTabConnectionId(data)),
    }));
  }, [connectionNameById, tabs]);

  const contextMenuOptions = React.useMemo<IContextMenuOption<IActiveTabContextMenu>[]>(
    () => [
      {
        text: t('common.copy'),
        onClick: (info) => copyToClipboard(info.tab.title),
      },
      {
        text: t('tabs.addToGroup'),
        show: (info) => !info?.tab.groupId,
        children: [
          {
            text: t('tabs.newGroup'),
            onClick: (info) => {
              const groupId = createTabGroup(info.tab.idTab);

              setGroupEditorRequest({ groupId, position: info.position });
            },
          },
          ...tabGroups.map((group) => ({
            text: group.title,
            onClick: (info) => addTabToGroup(info.tab.idTab, group.id),
          })),
        ],
      },
      {
        text: t('tabs.removeFromGroup'),
        show: (info) => !!info?.tab.groupId,
        onClick: (info) => removeTabFromGroup(info.tab.idTab),
      },
      {
        text: t('tabs.closeTab'),
        onClick: (info) => {
          removeTab(info.tab.idTab);
        },
      },
      tabs.length > 1 && {
        text: t('tabs.closeOtherTabs'),
        onClick: (info) => {
          setActiveTabId(info.tab.idTab);
          removeTab(tabs.filter((t) => t.id !== info.tab.idTab).map((t) => t.id));
        },
      },
      tabs.length > 1 && {
        text: t('context.closeTabsLeft'),
        onClick: (info) => {
          const idx = tabs.findIndex((t) => t.id === info.tab.idTab);
          removeTab(tabs.slice(0, idx).map((t) => t.id));
        },
      },
      tabs.length > 1 && {
        text: t('context.closeTabsRight'),
        onClick: (info) => {
          const idx = tabs.findIndex((t) => t.id === info.tab.idTab);
          removeTab(tabs.slice(idx + 1).map((t) => t.id));
        },
      },
      tabs.length > 1 && {
        text: t('tabs.closeAllTabs'),
        onClick: () => {
          removeTab(tabs.map((t) => t.id));
        },
      },
    ],
    [
      addTabToGroup,
      createTabGroup,
      removeTab,
      removeTabFromGroup,
      setActiveTabId,
      tabGroups,
      tabs,
      t,
    ],
  );

  if (!tabs.length) return <Welcolme />;

  return (
    <div className={styles.container}>
      <TabSplit
        tabs={splitTabs}
        activeTabId={activeTabId}
        onActiveTabIdChange={setActiveTabId}
        onMoveTab={moveTab}
        isTabVisible={(tab) => !tab.groupId || !collapsedGroupIds.has(tab.groupId)}
        borderColor={theme.bar.borderColor}
        backgroundColor={theme.bar.backgroundColor}
        renderTabContent={({ component: TabComponent }) => <TabComponent />}
        emptyPane={<Welcolme />}
        renderBar={({ isLastPane, tabBarProps }) => (
          <TabBar
            {...tabBarProps}
            allowClose
            draggable
            borderBottom
            padding={isLastPane && !aiChatVisible ? '0 34px 0 0' : undefined}
            color={theme.color}
            ascentColor={theme.ascentColor}
            backgroundColor={theme.backgroundColor}
            backgroundColorBar={theme.bar.backgroundColor}
            borderColor={theme.bar.borderColor}
            onRemoveTab={(tab) => removeTab(tab.idTab)}
            groups={tabGroups}
            onAddTabToGroup={addTabToGroup}
            onRemoveTabFromGroup={removeTabFromGroup}
            onUpdateTabGroup={updateTabGroup}
            onUngroupTabGroup={ungroupTabGroup}
            onCloseTabGroup={closeTabGroup}
            groupEditorRequest={groupEditorRequest}
            height="42px"
            contextMenuOptions={contextMenuOptions}
          />
        )}
      />
    </div>
  );
};

interface IMainSplitTab
  extends Pick<IAppTab, 'id' | 'groupId' | 'title' | 'subtitle' | 'unsaved' | 'component'> {
  idTab: string;
}
