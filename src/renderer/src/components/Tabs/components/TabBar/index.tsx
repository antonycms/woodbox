import React from 'react';
import Tab from '../Tab';
import styles from '../../styles.module.css';
import clsx from 'clsx';
import { IColors } from '@renderer/styles/theme2';

const TabsBar = ({
  tabs = [],
  idTabBar,
  reverse,
  activeTabId,
  onActiveTab,
  onRemoveTab,
  borderTop,
  borderBottom,
  borderLeft,
  borderRight,
  allowClose,
  draggable,
  height = '30px',
  width = '100%',
  ascentColor = 'green',
  vertical,
}: ITabsBarProps) => {
  const ref = React.useRef<HTMLDivElement>();
  const [idTabDraging, setIdTabDraging] = React.useState<string>(null);
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

  const tabDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const element = e.currentTarget as EventTarget & HTMLDivElement;
    e.dataTransfer.effectAllowed = 'copyMove';
    setIdTabDraging(element.id);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const element = e.target as EventTarget & HTMLDivElement;

    const idTab = idTabDraging;
    setIdTabDraging(null);

    if (!element.id || !idTab || element.id === idTab) return;

    // changeTabPosition(idTabDraging, element.id);
  };

  const handleClickTab = (tab: ITab) => {
    if (tab?.idTab === activeTabId) return;
    onActiveTab(tab);
  };

  const classes = clsx(
    styles.tabBar,
    noHasContent && styles.noContent,
    borderTop && styles.borderTop,
    borderBottom && styles.borderBottom,
    borderLeft && styles.borderLeft,
    borderRight && styles.borderRight,
    vertical && styles.vertical,
    reverse && styles.reverse,
  );

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

  React.useEffect(() => {
    changeTabContent();

    const activeTab = tabs.find((t) => t.idTab === activeTabId);

    if (activeTab?.idTab != activeTabId) {
      onActiveTab(activeTab);
    }
  }, [tabs, activeTabId]);

  return (
    <div className={clsx(styles.outsideBar, classes)}>
      <div
        id={`tab_bar_${idTabBar}`}
        ref={ref}
        onDrop={draggable ? onDrop : undefined}
        onDragOver={(e) => e.preventDefault()}
        style={{ width }}
        className={classes}
      >
        {tabs.map((tab) => (
          <Tab
            key={`tab_${idTabBar}_${tab.idTab}`}
            id={`tab_${idTabBar}_${tab.idTab}`}
            title={tab.title || 'Sem título'}
            ascentColor={ascentColor}
            allowClose={allowClose}
            active={tab.idTab === activeTabId}
            icon={tab.icon}
            draggable={draggable ? 'true' : 'false'}
            onDragStart={draggable ? tabDragStart : undefined}
            onDragEnter={draggable ? tabDragEnter : undefined}
            onDragEnd={draggable ? tabDragEnd : undefined}
            height={height}
            vertical={vertical}
            isDraging={!!idTabDraging}
            onClick={() => handleClickTab(tab)}
            onRemove={() => onRemoveTab?.(tab)}
            unsaved={tab.unsaved}
          />
        ))}
      </div>
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
  height?: string;
  width?: string;
  borderTop?: boolean;
  allowClose?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  ascentColor?: keyof IColors;
  vertical?: boolean;
  draggable?: boolean;
  reverse?: boolean;
}
