import React from 'react';
import {
  TabBar,
  TabWindow,
  TabContent,
  IActiveTabContextMenu,
  TAB_DRAG_DATA_TYPE,
} from '@renderer/components/Tabs';
import { Welcolme } from '@renderer/components/Welcome';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useI18n } from '@renderer/contexts/I18n';
import { useStoreContext } from '@renderer/contexts/Store';
import { copyToClipboard } from '@renderer/utils/methods';
import { IContextMenuOption } from '@renderer/components/ContextMenu';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

const MAIN_SPLIT_PANE_ID = 'main';
const MIN_SPLIT_PANE_PERCENT = 20;
const MAX_SPLIT_PANE_PERCENT = 80;

const createSplitPaneId = () => `split_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const normalizeSplitPane = (pane: ISplitPane): ISplitPane => ({
  ...pane,
  activeTabId:
    pane.activeTabId && pane.tabIds.includes(pane.activeTabId)
      ? pane.activeTabId
      : pane.tabIds[pane.tabIds.length - 1],
});

export const MainContent = () => {
  const [groupEditorRequest, setGroupEditorRequest] = React.useState<{
    groupId: string;
    position: { x: number; y: number };
  }>();
  const [splitPanes, setSplitPanes] = React.useState<ISplitPane[]>([
    { id: MAIN_SPLIT_PANE_ID, tabIds: [] },
  ]);
  const [activeSplitPaneId, setActiveSplitPaneId] = React.useState(MAIN_SPLIT_PANE_ID);
  const [splitDropTarget, setSplitDropTarget] = React.useState<ISplitDropTarget>();
  const [splitFirstPanePercent, setSplitFirstPanePercent] = React.useState(50);
  const splitLayoutRef = React.useRef<HTMLDivElement>(null);
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

  React.useEffect(() => {
    const existingTabIds = new Set(tabs.map((tab) => tab.id));

    setSplitPanes((prev) => {
      const next = prev.map((pane) =>
        normalizeSplitPane({
          ...pane,
          tabIds: pane.tabIds.filter((id) => existingTabIds.has(id)),
        }),
      );
      const assignedTabIds = new Set(next.flatMap((pane) => pane.tabIds));
      const missingTabIds = tabs.filter((tab) => !assignedTabIds.has(tab.id)).map((tab) => tab.id);

      if (!next.length) next.push({ id: MAIN_SPLIT_PANE_ID, tabIds: [] });

      const activePaneIndex = Math.max(
        0,
        next.findIndex((pane) => pane.id === activeSplitPaneId),
      );

      next[activePaneIndex].tabIds.push(...missingTabIds);

      const panesWithTabs = next.filter((pane) => pane.tabIds.length);

      return (panesWithTabs.length ? panesWithTabs : [{ id: MAIN_SPLIT_PANE_ID, tabIds: [] }]).map(
        normalizeSplitPane,
      );
    });
  }, [activeSplitPaneId, tabs]);

  const activeGlobalPaneId = React.useMemo(() => {
    if (!activeTabId) return undefined;

    return splitPanes.find((pane) => pane.tabIds.includes(activeTabId))?.id;
  }, [activeTabId, splitPanes]);

  React.useEffect(() => {
    if (!activeGlobalPaneId) return;

    setActiveSplitPaneId(activeGlobalPaneId);
    setSplitPanes((prev) => {
      const pane = prev.find((item) => item.id === activeGlobalPaneId);

      if (!pane || pane.activeTabId === activeTabId) return prev;

      return prev.map((item) => (item.id === activeGlobalPaneId ? { ...item, activeTabId } : item));
    });
  }, [activeGlobalPaneId, activeTabId]);

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

  const formatTabBarTabs = React.useCallback(
    (paneTabs: typeof tabs) =>
      paneTabs.map(({ id: idTab, groupId, title, subtitle, unsaved, data }) => ({
        idTab,
        groupId,
        unsaved,
        title,
        subtitle: subtitle || connectionNameById.get(data?.id_connection),
      })),
    [connectionNameById],
  );

  const getSplitDropSide = (
    event: React.DragEvent<HTMLDivElement>,
    element: HTMLDivElement,
  ): ISplitDropSide => {
    const rect = element.getBoundingClientRect();

    return event.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
  };

  const moveTabToSplitPane = React.useCallback(
    (tabId: string, targetPaneId: string, side: ISplitDropSide) => {
      setActiveTabId(tabId);
      setSplitPanes((prev) => {
        const sourcePane = prev.find((pane) => pane.tabIds.includes(tabId));
        const targetPane = prev.find((pane) => pane.id === targetPaneId);

        if (!sourcePane || !targetPane) return prev;

        if (prev.length === 1) {
          const remainingTabIds = targetPane.tabIds.filter((id) => id !== tabId);

          if (!remainingTabIds.length) return prev.map((pane) => ({ ...pane, activeTabId: tabId }));

          const originalPane = normalizeSplitPane({ ...targetPane, tabIds: remainingTabIds });
          const splitPane: ISplitPane = {
            id: createSplitPaneId(),
            tabIds: [tabId],
            activeTabId: tabId,
          };

          return side === 'left' ? [splitPane, originalPane] : [originalPane, splitPane];
        }

        if (sourcePane.id === targetPaneId) {
          return prev.map((pane) =>
            pane.id === targetPaneId ? { ...pane, activeTabId: tabId } : pane,
          );
        }

        return prev
          .map((pane) => {
            const nextPane = {
              ...pane,
              tabIds: pane.tabIds.filter((id) => id !== tabId),
            };

            if (pane.id === targetPaneId) {
              nextPane.tabIds.push(tabId);
              nextPane.activeTabId = tabId;
            }

            return normalizeSplitPane(nextPane);
          })
          .filter((pane) => pane.tabIds.length);
      });
    },
    [setActiveTabId],
  );

  const handleSplitPaneDragOver = (event: React.DragEvent<HTMLDivElement>, paneId: string) => {
    if (!Array.from(event.dataTransfer.types).includes(TAB_DRAG_DATA_TYPE)) return;
    if ((event.target as HTMLElement).closest('[data-tab-bar-id]')) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const side = getSplitDropSide(event, event.currentTarget);

    setSplitDropTarget((prev) =>
      prev?.paneId === paneId && prev.side === side ? prev : { paneId, side },
    );
  };

  const handleSplitPaneDrop = (event: React.DragEvent<HTMLDivElement>, paneId: string) => {
    const tabId =
      event.dataTransfer.getData(TAB_DRAG_DATA_TYPE) || event.dataTransfer.getData('text/plain');

    setSplitDropTarget(undefined);

    if (!tabId) return;

    const sourcePane = splitPanes.find((pane) => pane.tabIds.includes(tabId));

    if (sourcePane?.id === paneId && (event.target as HTMLElement).closest('[data-tab-bar-id]')) {
      return;
    }

    event.preventDefault();
    moveTabToSplitPane(tabId, paneId, getSplitDropSide(event, event.currentTarget));
  };

  const handleSplitResizeStart = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.buttons !== 1) return;

    const layout = splitLayoutRef.current;
    if (!layout) return;

    event.preventDefault();
    event.stopPropagation();

    const { currentTarget, pointerId } = event;
    const rect = layout.getBoundingClientRect();

    const updateSplitSize = (clientX: number) => {
      const nextPercent = ((clientX - rect.left) / rect.width) * 100;

      setSplitFirstPanePercent(
        Math.min(MAX_SPLIT_PANE_PERCENT, Math.max(MIN_SPLIT_PANE_PERCENT, nextPercent)),
      );
    };

    function onPointerMove(event: PointerEvent) {
      updateSplitSize(event.clientX);
    }

    function onLostPointerCapture() {
      currentTarget.removeEventListener('pointermove', onPointerMove);
      currentTarget.removeEventListener('lostpointercapture', onLostPointerCapture);
    }

    currentTarget.setPointerCapture(pointerId);
    currentTarget.addEventListener('pointermove', onPointerMove);
    currentTarget.addEventListener('lostpointercapture', onLostPointerCapture);
    updateSplitSize(event.clientX);
  }, []);

  if (!tabs.length) return <Welcolme />;

  return (
    <div className={styles.container}>
      <div
        ref={splitLayoutRef}
        className={styles.splitLayout}
        style={
          {
            '--colorBorder': theme.bar.borderColor,
            backgroundColor: theme.bar.backgroundColor,
          } as React.CSSProperties
        }
      >
        {splitPanes.map((pane, paneIndex) => {
          const paneTabs = tabs.filter((tab) => pane.tabIds.includes(tab.id));
          const visiblePaneTabs = paneTabs.filter(
            (tab) => !tab.groupId || !collapsedGroupIds.has(tab.groupId),
          );
          const paneActiveTabId =
            pane.activeTabId && visiblePaneTabs.some((tab) => tab.id === pane.activeTabId)
              ? pane.activeTabId
              : visiblePaneTabs[visiblePaneTabs.length - 1]?.id;

          if (!paneTabs.length) return null;

          const splitPaneStyle =
            splitPanes.length === 2
              ? ({
                  flex: `0 0 ${
                    paneIndex === 0 ? splitFirstPanePercent : 100 - splitFirstPanePercent
                  }%`,
                } as React.CSSProperties)
              : undefined;

          return (
            <div
              key={pane.id}
              className={classes(
                styles.splitPane,
                splitDropTarget?.paneId === pane.id &&
                  (splitDropTarget.side === 'left' ? styles.dropLeft : styles.dropRight),
              )}
              style={splitPaneStyle}
              onDragOver={(event) => handleSplitPaneDragOver(event, pane.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setSplitDropTarget((prev) => (prev?.paneId === pane.id ? undefined : prev));
                }
              }}
              onDrop={(event) => handleSplitPaneDrop(event, pane.id)}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('[data-tab-bar-id]')) return;

                setActiveSplitPaneId(pane.id);
                if (paneActiveTabId) setActiveTabId(paneActiveTabId);
              }}
            >
              <TabBar
                allowClose
                draggable
                borderBottom
                color={theme.color}
                ascentColor={theme.ascentColor}
                backgroundColor={theme.backgroundColor}
                backgroundColorBar={theme.bar.backgroundColor}
                borderColor={theme.bar.borderColor}
                activeTabId={paneActiveTabId}
                onActiveTab={(tab) => {
                  const nextActiveTabId = tab?.idTab;

                  setActiveSplitPaneId((prev) => (prev === pane.id ? prev : pane.id));
                  setSplitPanes((prev) => {
                    let changed = false;

                    const next = prev.map((item) => {
                      if (item.id !== pane.id || item.activeTabId === nextActiveTabId) return item;

                      changed = true;
                      return { ...item, activeTabId: nextActiveTabId };
                    });

                    return changed ? next : prev;
                  });
                  setActiveTabId((prev) => (prev === nextActiveTabId ? prev : nextActiveTabId));
                }}
                idTabBar={`app_tabs_${pane.id}`}
                onRemoveTab={(tab) => removeTab(tab.idTab)}
                onMoveTab={moveTab}
                groups={tabGroups}
                onAddTabToGroup={addTabToGroup}
                onRemoveTabFromGroup={removeTabFromGroup}
                onUpdateTabGroup={updateTabGroup}
                onUngroupTabGroup={ungroupTabGroup}
                onCloseTabGroup={closeTabGroup}
                groupEditorRequest={groupEditorRequest}
                height="42px"
                contextMenuOptions={contextMenuOptions}
                tabs={formatTabBarTabs(paneTabs)}
              />

              {!paneActiveTabId ? (
                <Welcolme />
              ) : (
                <TabWindow activeTabId={paneActiveTabId}>
                  {paneTabs.map(({ id, component: TabComponent }) => (
                    <TabContent key={id} idTab={id}>
                      <TabComponent />
                    </TabContent>
                  ))}
                </TabWindow>
              )}
              {paneIndex === 0 && splitPanes.length === 2 && (
                <div
                  className={styles.splitResizeHandle}
                  role="separator"
                  aria-orientation="vertical"
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={() => setSplitFirstPanePercent(50)}
                  onPointerDown={handleSplitResizeStart}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

type ISplitDropSide = 'left' | 'right';

interface ISplitPane {
  id: string;
  tabIds: string[];
  activeTabId?: string;
}

interface ISplitDropTarget {
  paneId: string;
  side: ISplitDropSide;
}
