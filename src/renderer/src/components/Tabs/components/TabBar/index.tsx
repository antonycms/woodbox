import React from 'react';
import { classes, toCssProperties } from '@renderer/styles/theme';
import {
  ContextMenu,
  IContextMenuOption,
  IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import Tab from '../Tab';
import styles from '../../styles.module.css';

const TabsBar = (props: ITabsBarProps) => {
  const {
    tabs = [],
    idTabBar,
    reverse,
    activeTabId,
    onActiveTab,
    onRemoveTab,
    onMoveTab,
    borderTop,
    borderBottom,
    borderLeft,
    borderRight,
    allowClose,
    draggable,
    vertical,
    backgroundColorBar,
    color,
    backgroundColor,
    ascentColor,
    borderColor,
    contextMenuOptions,
    groups = [],
    groupEditorRequest,
    onAddTabToGroup,
    onRemoveTabFromGroup,
    onUpdateTabGroup,
    onUngroupTabGroup,
    onCloseTabGroup,
    height = '30px',
    width = '100%',
  } = props;

  const ref = React.useRef<HTMLDivElement>(null);
  const handledGroupEditorRequestRef = React.useRef<IGroupEditorRequest>(null);
  const [idTabDraging, setIdTabDraging] = React.useState<string>(null);
  const [idTabDragTarget, setIdTabDragTarget] = React.useState<string>(null);
  const [idGroupDragTarget, setIdGroupDragTarget] = React.useState<string>(null);
  const [activeTabContextMenu, setActiveTabContextMenu] = React.useState<IActiveTabContextMenu>();
  const [activeGroupContext, setActiveGroupContext] = React.useState<IActiveGroupContextMenu>();
  const noHasContent = !tabs.length;

  const tabDragEnd = (e?: React.DragEvent<HTMLDivElement>) => {
    if (e && idTabDraging) setIdTabDraging(null);
    setIdTabDragTarget(null);
    setIdGroupDragTarget(null);
  };

  const tabDragEnter = (idTab: string) => {
    if (!idTabDraging) return;

    setIdTabDragTarget(idTab);
    setIdGroupDragTarget(null);
  };

  const groupDragEnter = (groupId: string) => {
    if (!idTabDraging) return;

    setIdTabDragTarget(null);
    setIdGroupDragTarget(groupId);
  };

  const tabDragStart = (e: React.DragEvent<HTMLDivElement>, idTab: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setIdTabDraging(idTab);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-tab-id]') as HTMLElement;
    const targetGroup = (e.target as HTMLElement).closest(
      '[data-tab-group-header-id]',
    ) as HTMLElement;
    const targetTabId = target?.dataset.tabId;
    const targetGroupId = targetGroup?.dataset.tabGroupHeaderId;
    const sourceTabId = idTabDraging;
    const sourceTab = tabs.find((tab) => tab.idTab === sourceTabId);
    const targetTab = tabs.find((tab) => tab.idTab === targetTabId);

    setIdTabDraging(null);
    tabDragEnd();

    if (!sourceTabId) return;

    if (targetGroupId) {
      onAddTabToGroup?.(sourceTabId, targetGroupId);
      return;
    }

    if (!targetTabId) {
      if (sourceTab?.groupId) onRemoveTabFromGroup?.(sourceTabId);
      return;
    }

    if (sourceTabId === targetTabId) return;

    if (targetTab?.groupId && sourceTab?.groupId !== targetTab.groupId) {
      onAddTabToGroup?.(sourceTabId, targetTab.groupId, targetTabId);
      return;
    }

    if (sourceTab?.groupId && !targetTab?.groupId) {
      onRemoveTabFromGroup?.(sourceTabId, targetTabId);
      return;
    }

    onMoveTab?.(sourceTabId, targetTabId);
  };

  const handleClickTab = (tab: ITab) => {
    if (tab?.idTab === activeTabId) return;
    onActiveTab(tab);
  };

  const classesTabBar = classes(
    styles.tabBar,
    noHasContent && styles.noContent,
    borderTop && styles.borderTop,
    borderBottom && styles.borderBottom,
    borderLeft && styles.borderLeft,
    borderRight && styles.borderRight,
    vertical && styles.vertical,
    reverse && styles.reverse,
  );

  const styleOutsideContainer = React.useMemo(() => {
    const cssProperties = toCssProperties({
      colorBorder: borderColor,
      backgroundColorBar,
      backgroundColor,
    });
    return { ...cssProperties, height: vertical ? undefined : height };
  }, [
    tabs.length,
    borderColor,
    backgroundColorBar,
    backgroundColor,
    vertical,
    borderBottom,
    borderTop,
  ]);

  const styleTabBar = React.useMemo(() => {
    const cssProperties = toCssProperties({ backgroundColorBar });
    return { ...cssProperties, width: vertical ? width : undefined };
  }, [backgroundColorBar, width, vertical]);

  const groupsById = React.useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );

  const groupedTabItems = React.useMemo(() => {
    const renderedGroups = new Set<string>();
    const renderedTabs = new Set<string>();

    return tabs.flatMap((tab) => {
      if (renderedTabs.has(tab.idTab)) return [];

      const group = tab.groupId ? groupsById.get(tab.groupId) : undefined;

      if (!group) {
        renderedTabs.add(tab.idTab);

        return [{ type: 'tab' as const, tab }];
      }

      if (renderedGroups.has(group.id)) return [];

      const items: IGroupedTabItem[] = [];
      const groupTabs = tabs.filter((item) => item.groupId === group.id);

      renderedGroups.add(group.id);
      groupTabs.forEach((item) => renderedTabs.add(item.idTab));
      items.push({ type: 'group', group });

      if (!group.collapsed) {
        groupTabs.forEach((item) => items.push({ type: 'tab', tab: item, group }));
      }

      return items;
    });
  }, [groupsById, tabs]);

  React.useEffect(() => {
    if (!activeGroupContext) return;

    const handleClick = () => setActiveGroupContext(null);

    window.addEventListener('click', handleClick);

    return () => window.removeEventListener('click', handleClick);
  }, [activeGroupContext]);

  React.useEffect(() => {
    if (!activeGroupContext) return;

    const nextGroup = groups.find((group) => group.id === activeGroupContext.group.id);

    if (!nextGroup) {
      setActiveGroupContext(null);
      return;
    }

    if (nextGroup !== activeGroupContext.group) {
      setActiveGroupContext((prev) => (prev ? { ...prev, group: nextGroup } : prev));
    }
  }, [activeGroupContext, groups]);

  React.useEffect(() => {
    if (!groupEditorRequest) return;
    if (handledGroupEditorRequestRef.current === groupEditorRequest) return;

    const group = groups.find((item) => item.id === groupEditorRequest.groupId);

    if (!group) return;

    handledGroupEditorRequestRef.current = groupEditorRequest;
    setActiveTabContextMenu(null);
    setActiveGroupContext({ group, position: groupEditorRequest.position });
  }, [groupEditorRequest, groups]);

  React.useEffect(() => {
    const element = ref.current;

    function enableHorizontalWheelScroll(e: WheelEvent) {
      if (!element || e.deltaX) return;

      if (e.deltaY > 0) element.scrollLeft += 50;
      else element.scrollLeft -= 50;
    }

    element.addEventListener('wheel', enableHorizontalWheelScroll);

    return () => {
      element.removeEventListener('wheel', enableHorizontalWheelScroll);
    };
  }, []);

  React.useLayoutEffect(() => {
    if (!tabs.length) return;

    const visibleTabs = tabs.filter((tab) => {
      const group = tab.groupId ? groupsById.get(tab.groupId) : undefined;

      return !group?.collapsed;
    });
    const activeTab = visibleTabs.find((t) => t.idTab === activeTabId);

    if (!visibleTabs.length) {
      if (activeTabId) onActiveTab(undefined);
      return;
    }

    if (!activeTab) {
      onActiveTab(visibleTabs[visibleTabs.length - 1]);
    }
  }, [tabs, activeTabId, groupsById]);

  return (
    <div className={styles.outsideBar} style={styleOutsideContainer}>
      <div
        ref={ref}
        onDrop={draggable ? onDrop : undefined}
        onDragOver={(e) => e.preventDefault()}
        style={styleTabBar}
        className={classesTabBar}
      >
        {groupedTabItems.map((item) => {
          if (item.type === 'group') {
            return (
              <TabGroupHeader
                key={`tab_group_${idTabBar}_${item.group.id}`}
                group={item.group}
                height={height}
                active={activeGroupContext?.group.id === item.group.id}
                dragTarget={idGroupDragTarget === item.group.id}
                onDragEnter={draggable ? () => groupDragEnter(item.group.id) : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveTabContextMenu(null);
                  setActiveGroupContext(null);
                  onUpdateTabGroup?.(item.group.id, { collapsed: !item.group.collapsed });
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setActiveTabContextMenu(null);
                  setActiveGroupContext({
                    group: item.group,
                    position: { x: event.clientX, y: event.clientY },
                  });
                }}
              />
            );
          }

          const index = tabs.findIndex((tab) => tab.idTab === item.tab.idTab);

          return (
            <Tab
              key={`tab_${idTabBar}_${item.tab.idTab}`}
              tabId={item.tab.idTab}
              groupId={item.tab.groupId}
              groupColor={item.group?.color}
              title={item.tab.title || 'Sem título'}
              subtitle={item.tab.subtitle}
              ascentColor={item.group?.color || ascentColor}
              color={color}
              backgroundColor={backgroundColor}
              allowClose={allowClose}
              active={item.tab.idTab === activeTabId}
              icon={item.tab.icon}
              draggable={draggable ? 'true' : 'false'}
              onDragStart={draggable ? (event) => tabDragStart(event, item.tab.idTab) : undefined}
              onDragEnter={draggable ? () => tabDragEnter(item.tab.idTab) : undefined}
              onDragEnd={draggable ? tabDragEnd : undefined}
              height={height}
              vertical={vertical}
              isDraging={!!idTabDraging}
              dragTarget={idTabDragTarget === item.tab.idTab}
              onClick={() => handleClickTab(item.tab)}
              onRemove={() => onRemoveTab?.(item.tab)}
              unsaved={item.tab.unsaved}
              onContextMenu={(event) => {
                setActiveGroupContext(null);
                setActiveTabContextMenu({
                  index,
                  tab: item.tab,
                  position: { x: event.clientX, y: event.clientY },
                });
              }}
            />
          );
        })}
      </div>

      {!!activeGroupContext && (
        <TabGroupEditor
          context={activeGroupContext}
          onUpdateGroup={(data) => {
            setActiveGroupContext((prev) =>
              prev ? { ...prev, group: { ...prev.group, ...data } } : prev,
            );
            onUpdateTabGroup?.(activeGroupContext.group.id, data);
          }}
          onUngroup={() => {
            onUngroupTabGroup?.(activeGroupContext.group.id);
            setActiveGroupContext(null);
          }}
          onCloseGroup={() => {
            onCloseTabGroup?.(activeGroupContext.group.id);
            setActiveGroupContext(null);
          }}
        />
      )}

      {!!contextMenuOptions?.length && (
        <ContextMenu
          activeContextInfo={activeTabContextMenu}
          position={activeTabContextMenu?.position}
          options={contextMenuOptions}
          onClose={() => setActiveTabContextMenu(null)}
        />
      )}
    </div>
  );
};

export default TabsBar;

const TabGroupHeader = (props: ITabGroupHeaderProps) => {
  const { group, active, dragTarget, height, onClick, onContextMenu, onDragEnter } = props;
  const style = toCssProperties({ tabGroupColor: group.color });

  return (
    <button
      className={classes(
        styles.tabGroupHeader,
        active && styles.activeTabGroupHeader,
        dragTarget && styles.tabIsDragging,
      )}
      data-tab-group-header-id={group.id}
      type="button"
      style={{ ...style, height } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragEnter={onDragEnter}
      title={group.title}
    >
      <span className={styles.tabGroupDot} />
      <span className={styles.tabGroupTitle}>{group.title}</span>
    </button>
  );
};

const TabGroupEditor = (props: ITabGroupEditorProps) => {
  const { context, onUpdateGroup, onUngroup, onCloseGroup } = props;
  const { group, position } = context;
  const [title, setTitle] = React.useState(group.title);

  React.useEffect(() => {
    setTitle(group.title);
  }, [group.title]);

  const saveTitle = () => {
    const nextTitle = title.trim() || 'Grupo';

    setTitle(nextTitle);
    onUpdateGroup({ title: nextTitle });
  };

  return (
    <div
      className={styles.tabGroupEditor}
      style={
        {
          ...toCssProperties({ tabGroupColor: group.color }),
          top: position.y,
          left: position.x,
        } as React.CSSProperties
      }
      onClick={(event) => event.stopPropagation()}
    >
      <input
        className={styles.tabGroupNameInput}
        value={title}
        autoFocus
        onChange={(event) => setTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />

      <div className={styles.tabGroupColors}>
        {TAB_GROUP_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={classes(
              styles.tabGroupColorButton,
              group.color === color && styles.selectedTabGroupColor,
            )}
            style={{ ...toCssProperties({ tabGroupColor: color }) } as React.CSSProperties}
            onClick={() => onUpdateGroup({ color })}
            title={color}
          />
        ))}
      </div>

      <button
        type="button"
        className={styles.tabGroupAction}
        onClick={() => onUpdateGroup({ collapsed: !group.collapsed })}
      >
        {group.collapsed ? 'Expandir grupo' : 'Recolher grupo'}
      </button>

      <button type="button" className={styles.tabGroupAction} onClick={onUngroup}>
        Desagrupar
      </button>

      <button type="button" className={styles.tabGroupAction} onClick={onCloseGroup}>
        Fechar grupo
      </button>
    </div>
  );
};

const TAB_GROUP_COLORS = [
  '#8ab4f8',
  '#f28b82',
  '#fdd663',
  '#81c995',
  '#c58af9',
  '#78d9ec',
  '#f6aea9',
  '#fbbc04',
];

export interface ITab {
  idTab: string;
  groupId?: string;
  title?: string;
  subtitle?: string;
  unsaved?: boolean;
  icon?(): React.ReactElement;
}

export interface ITabGroup {
  id: string;
  title: string;
  color: string;
  collapsed?: boolean;
}

type IGroupedTabItem =
  | { type: 'group'; group: ITabGroup }
  | { type: 'tab'; tab: ITab; group?: ITabGroup };

export interface ITabsBarProps {
  idTabBar: string;
  tabs: ITab[];
  groups?: ITabGroup[];
  groupEditorRequest?: IGroupEditorRequest;
  activeTabId: string | undefined;
  onActiveTab(tab?: ITab): void;
  onRemoveTab?(tab: ITab): void;
  onMoveTab?(sourceTabId: string, targetTabId: string, placement?: 'before' | 'after'): void;
  onAddTabToGroup?(tabId: string, groupId: string, targetTabId?: string): void;
  onRemoveTabFromGroup?(tabId: string, targetTabId?: string): void;
  onUpdateTabGroup?(
    groupId: string,
    data: Partial<Pick<ITabGroup, 'title' | 'color' | 'collapsed'>>,
  ): void;
  onUngroupTabGroup?(groupId: string): void;
  onCloseTabGroup?(groupId: string): void;
  height?: string;
  width?: string;
  borderTop?: boolean;
  allowClose?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  vertical?: boolean;
  draggable?: boolean;
  reverse?: boolean;
  ascentColor: string;
  color: string;
  backgroundColor: string;
  backgroundColorBar: string;
  borderColor: string;
  contextMenuOptions?: IContextMenuOption<IActiveTabContextMenu>[];
}

export interface IActiveTabContextMenu {
  tab: ITab;
  position: IContextMenuPosition;
  index: number;
}

interface IActiveGroupContextMenu {
  group: ITabGroup;
  position: IContextMenuPosition;
}

interface IGroupEditorRequest {
  groupId: string;
  position: IContextMenuPosition;
}

interface ITabGroupHeaderProps {
  group: ITabGroup;
  active?: boolean;
  dragTarget?: boolean;
  height: string;
  onClick(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  onContextMenu(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  onDragEnter?: React.DragEventHandler<HTMLButtonElement>;
}

interface ITabGroupEditorProps {
  context: IActiveGroupContextMenu;
  onUpdateGroup(data: Partial<Pick<ITabGroup, 'title' | 'color' | 'collapsed'>>): void;
  onUngroup(): void;
  onCloseGroup(): void;
}
