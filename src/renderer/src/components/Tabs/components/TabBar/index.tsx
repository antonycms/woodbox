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
    height = '30px',
    width = '100%',
  } = props;

  const ref = React.useRef<HTMLDivElement>();
  const [idTabDraging, setIdTabDraging] = React.useState<string>(null);
  const [activeTabContextMenu, setActiveTabContextMenu] = React.useState<IActiveTabContextMenu>();
  const noHasContent = !tabs.length;

  const changeTabContent = () => {
    const element = document.querySelector(`#tab_window_${idTabBar}`);
    const idTabContentActive = `tab_content_${activeTabId}`;

    if (!element) {
      return console.error(`[TabBar(${idTabBar})] TabWindow not found.`);
    }

    const AllElementsContent: NodeListOf<HTMLDivElement> = document.querySelectorAll(
      `#tab_window_${idTabBar} > .${styles.tabContent}`,
    );

    AllElementsContent.forEach((content) => {
      content.id === idTabContentActive
        ? content.classList.add(styles.active)
        : content.classList.remove(styles.active);
    });
  };

  const tabDragEnd = (e?: React.DragEvent<HTMLDivElement>) => {
    const children = ref.current?.children;

    if (e && idTabDraging) setIdTabDraging(null);

    for (let i = 0; i < children?.length; i++) {
      children[i].classList.remove(styles.tabIsDragging);
    }
  };

  const tabDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    const currentElement = e.currentTarget as EventTarget & HTMLDivElement;

    tabDragEnd();

    if (!idTabDraging) return;

    currentElement.classList.add(styles.tabIsDragging);
  };

  const tabDragStart = (e: React.DragEvent<HTMLDivElement>, idTab: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setIdTabDraging(idTab);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-tab-id]') as HTMLElement;
    const targetTabId = target?.dataset.tabId;
    const sourceTabId = idTabDraging;

    setIdTabDraging(null);
    tabDragEnd();

    if (!sourceTabId || !targetTabId || sourceTabId === targetTabId) return;

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
    const cssProperties = toCssProperties({ colorBorder: borderColor });
    return { ...cssProperties, height: vertical ? undefined : height };
  }, [tabs.length, borderColor, vertical, borderBottom, borderTop]);

  const styleTabBar = React.useMemo(() => {
    const cssProperties = toCssProperties({ backgroundColorBar });
    return { ...cssProperties, width: vertical ? width : undefined };
  }, [backgroundColorBar, width, vertical]);

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
    changeTabContent();

    const activeTab = tabs.find((t) => t.idTab === activeTabId);

    if (!activeTab) {
      onActiveTab(tabs[tabs.length - 1]);
    } //
    else if (activeTab?.idTab != activeTabId) {
      onActiveTab(activeTab);
    }
  }, [tabs, activeTabId]);

  return (
    <div className={classes(styles.outsideBar, classes)} style={styleOutsideContainer}>
      <div
        id={`tab_bar_${idTabBar}`}
        ref={ref}
        onDrop={draggable ? onDrop : undefined}
        onDragOver={(e) => e.preventDefault()}
        style={styleTabBar}
        className={classesTabBar}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={`tab_${idTabBar}_${tab.idTab}`}
            id={`tab_${idTabBar}_${tab.idTab}`}
            tabId={tab.idTab}
            title={tab.title || 'Sem título'}
            ascentColor={ascentColor}
            color={color}
            backgroundColor={backgroundColor}
            allowClose={allowClose}
            active={tab.idTab === activeTabId}
            icon={tab.icon}
            draggable={draggable ? 'true' : 'false'}
            onDragStart={draggable ? (event) => tabDragStart(event, tab.idTab) : undefined}
            onDragEnter={draggable ? tabDragEnter : undefined}
            onDragEnd={draggable ? tabDragEnd : undefined}
            height={height}
            vertical={vertical}
            isDraging={!!idTabDraging}
            onClick={() => handleClickTab(tab)}
            onRemove={() => onRemoveTab?.(tab)}
            unsaved={tab.unsaved}
            onContextMenu={(event) => {
              setActiveTabContextMenu({
                index,
                tab,
                position: { x: event.clientX, y: event.clientY },
              });
            }}
          />
        ))}
      </div>

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

export interface ITab {
  idTab: string;
  title?: string;
  unsaved?: boolean;
  icon?(): JSX.Element;
}

export interface ITabsBarProps {
  idTabBar: string;
  tabs: ITab[];
  activeTabId: string;
  onActiveTab(tab: ITab): void;
  onRemoveTab?(tab: ITab): void;
  onMoveTab?(sourceTabId: string, targetTabId: string): void;
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
