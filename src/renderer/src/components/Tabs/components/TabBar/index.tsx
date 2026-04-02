import React from 'react';
import { classes, toCssProperties } from '@renderer/styles/theme';
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
    height = '30px',
    width = '100%',
  } = props;

  const ref = React.useRef<HTMLDivElement>();
  const [idTabDraging, setIdTabDraging] = React.useState<string>(null);
  const [tabBarSize, setTabBarSize] = React.useState(0);
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
    return toCssProperties({ colorBorder: borderColor });
  }, [borderColor]);

  // const styleOutsideContainer = React.useMemo(() => {
  //   const cssProperties = toCssProperties({ colorBorder: borderColor });

  //   const outsideContainerElement = ref?.current?.parentElement;

  //   const hasHorizontalScroll = outsideContainerElement?.scrollWidth > outsideContainerElement?.clientWidth;
  //   const horizontalHeight = `calc(${height} + ${hasHorizontalScroll ? '10px' : '2px'})`

  //   console.log(outsideContainerElement?.scrollWidth, outsideContainerElement?.clientWidth)

  //   return { ...cssProperties, height: vertical ? undefined : horizontalHeight };
  // }, [tabs, borderColor, vertical]);

  const styleTabBar = React.useMemo(() => {
    const cssProperties = toCssProperties({ backgroundColorBar });
    return { ...cssProperties, width: vertical ? width : `${tabBarSize}px` };
  }, [backgroundColorBar, width, vertical, tabBarSize]);

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
    const outsideContainerElement = ref?.current?.parentElement;

    const totalSize = [...(ref?.current?.children || [])].reduce((acm, child) => {
      const tabSize = Math.floor(vertical ? child.clientHeight : child.clientWidth) + 2.5;
      return acm + tabSize;
    }, 0);

    setTabBarSize(totalSize);

    const borderSize = `${[borderTop, borderBottom].filter(Boolean).length ? 2 : 0}px`;

    // console.log(borderSize)

    setTimeout(() => {
      if (outsideContainerElement && !vertical) {
        const hasHorizontalScroll =
          outsideContainerElement?.scrollWidth > outsideContainerElement?.clientWidth;
        const horizontalHeight = `calc(${height} + ${
          hasHorizontalScroll ? '10px' : '2px'
        } - ${borderSize})`;

        // console.log(hasHorizontalScroll)

        outsideContainerElement.style.height = horizontalHeight;
      }
    });

    // console.log(outsideContainerElement?.scrollWidth, outsideContainerElement?.clientWidth)
  }, [tabs, vertical, borderBottom, borderTop]);

  React.useEffect(() => {
    changeTabContent();

    const activeTab = tabs.find((t) => t.idTab === activeTabId);

    if (!activeTab) {
      onActiveTab(tabs[tabs.length - 1]);
    } //
    else if (activeTab?.idTab != activeTabId) {
      onActiveTab(activeTab);
    }

    if (ref.current) {
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
        {tabs.map((tab) => (
          <Tab
            key={`tab_${idTabBar}_${tab.idTab}`}
            id={`tab_${idTabBar}_${tab.idTab}`}
            title={tab.title || 'Sem título'}
            ascentColor={ascentColor}
            color={color}
            backgroundColor={backgroundColor}
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
  vertical?: boolean;
  draggable?: boolean;
  reverse?: boolean;
  ascentColor: string;
  color: string;
  backgroundColor: string;
  backgroundColorBar: string;
  borderColor: string;
}
