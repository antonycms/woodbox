import React from 'react';
import { classes } from '@renderer/styles/theme';
import type { ITab } from '../TabBar';
import { TabSplitProvider } from './context';
import type {
  ITabMovePlacement,
  ITabSplitDropSide,
  ITabSplitDropTarget,
  ITabSplitPane,
  ITabSplitProps,
} from './types';
import {
  getPaneIdByTabId,
  getSplitDropSide,
  MAIN_SPLIT_PANE_ID,
  MAX_SPLIT_PANE_PERCENT,
  MIN_SPLIT_PANE_PERCENT,
  moveTabToSplitPane,
  moveTabToTargetTab,
  setPaneActiveTab,
  splitPanesAreEqual,
  syncSplitPanes,
} from './utils';
import styles from './styles.module.css';

const TabSplit = <TTab extends ITab = ITab>(props: ITabSplitProps<TTab>) => {
  const {
    tabs,
    activeTabId,
    onActiveTabIdChange,
    onMoveTab,
    children,
    borderColor,
    backgroundColor,
    dropOverlayTop = '30px',
    className,
    style,
    minPanePercent = MIN_SPLIT_PANE_PERCENT,
    maxPanePercent = MAX_SPLIT_PANE_PERCENT,
    isTabVisible = () => true,
  } = props;
  const [panes, setPanes] = React.useState<ITabSplitPane[]>([
    { id: MAIN_SPLIT_PANE_ID, tabIds: [] },
  ]);
  const [activePaneId, setActivePaneId] = React.useState(MAIN_SPLIT_PANE_ID);
  const [dropTarget, setDropTarget] = React.useState<ITabSplitDropTarget>();
  const [firstPanePercent, setFirstPanePercent] = React.useState(50);
  const [draggingTabId, setDraggingTabId] = React.useState<string>();
  const layoutRef = React.useRef<HTMLDivElement>(null);
  const dragDataType = React.useMemo(
    () => `application/x-woodbox-tab-split-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    [],
  );

  const activeGlobalPaneId = React.useMemo(() => {
    return getPaneIdByTabId(panes, activeTabId);
  }, [activeTabId, panes]);

  const tabsById = React.useMemo(() => {
    return new Map(tabs.map((tab) => [tab.idTab, tab]));
  }, [tabs]);

  const contextValue = React.useMemo(
    () => ({ dragDataType, draggingTabId, setDraggingTabId }),
    [dragDataType, draggingTabId],
  );

  const handleMoveTab = React.useCallback(
    (
      sourceTabId: string,
      targetTabId: string,
      targetPaneId: string,
      placement?: ITabMovePlacement,
    ) => {
      onActiveTabIdChange(sourceTabId);
      setPanes((prev) =>
        moveTabToTargetTab(prev, sourceTabId, targetTabId, targetPaneId, placement),
      );
      onMoveTab?.(sourceTabId, targetTabId, placement);
    },
    [onActiveTabIdChange, onMoveTab],
  );

  const moveTabToPane = React.useCallback(
    (tabId: string, targetPaneId: string, side: ITabSplitDropSide) => {
      onActiveTabIdChange(tabId);
      setPanes((prev) => moveTabToSplitPane(prev, tabId, targetPaneId, side));
    },
    [onActiveTabIdChange],
  );

  const clearDropTarget = React.useCallback(() => {
    setDropTarget((prev) => (prev ? undefined : prev));
  }, []);

  const handlePaneDragOver = (event: React.DragEvent<HTMLDivElement>, paneId: string) => {
    if (tabs.length < 2) return;
    if (!Array.from(event.dataTransfer.types).includes(dragDataType)) return;
    if ((event.target as HTMLElement).closest('[data-tab-bar-id]')) {
      clearDropTarget();
      return;
    }

    const sourcePane = draggingTabId
      ? panes.find((pane) => pane.tabIds.includes(draggingTabId))
      : undefined;

    if (panes.length > 1) {
      if (!sourcePane || sourcePane.id === paneId) {
        clearDropTarget();
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      setDropTarget((prev) =>
        prev?.paneId === paneId && prev.side === 'full' ? prev : { paneId, side: 'full' },
      );
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const side = getSplitDropSide(event.clientX, event.currentTarget);

    setDropTarget((prev) =>
      prev?.paneId === paneId && prev.side === side ? prev : { paneId, side },
    );
  };

  const handlePaneDrop = (event: React.DragEvent<HTMLDivElement>, paneId: string) => {
    if (tabs.length < 2) return;
    if ((event.target as HTMLElement).closest('[data-tab-bar-id]')) {
      clearDropTarget();
      return;
    }

    const tabId =
      event.dataTransfer.getData(dragDataType) || event.dataTransfer.getData('text/plain');

    clearDropTarget();

    if (!tabId) return;

    const sourcePane = panes.find((pane) => pane.tabIds.includes(tabId));

    if (!sourcePane || (panes.length > 1 && sourcePane.id === paneId)) {
      return;
    }

    event.preventDefault();
    moveTabToPane(
      tabId,
      paneId,
      panes.length > 1 ? 'full' : getSplitDropSide(event.clientX, event.currentTarget),
    );
  };

  const handleResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.buttons !== 1) return;

      const layout = layoutRef.current;
      if (!layout) return;

      event.preventDefault();
      event.stopPropagation();

      const { currentTarget, pointerId } = event;
      const rect = layout.getBoundingClientRect();

      const updateSplitSize = (clientX: number) => {
        const nextPercent = ((clientX - rect.left) / rect.width) * 100;

        setFirstPanePercent(Math.min(maxPanePercent, Math.max(minPanePercent, nextPercent)));
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
    },
    [maxPanePercent, minPanePercent],
  );

  React.useEffect(() => {
    if (!dropTarget) return;

    window.addEventListener('drop', clearDropTarget);
    window.addEventListener('dragend', clearDropTarget);

    return () => {
      window.removeEventListener('drop', clearDropTarget);
      window.removeEventListener('dragend', clearDropTarget);
    };
  }, [clearDropTarget, dropTarget]);

  React.useEffect(() => {
    setPanes((prev) => {
      const next = syncSplitPanes(prev, tabs, activePaneId);

      return splitPanesAreEqual(prev, next) ? prev : next;
    });
  }, [activePaneId, tabs]);

  React.useEffect(() => {
    if (!activeGlobalPaneId || !activeTabId) return;

    setActivePaneId(activeGlobalPaneId);
    setPanes((prev) => setPaneActiveTab(prev, activeGlobalPaneId, activeTabId));
  }, [activeGlobalPaneId, activeTabId]);

  return (
    <TabSplitProvider value={contextValue}>
      <div
        ref={layoutRef}
        className={classes(styles.layout, className)}
        style={
          {
            '--tabSplitBorderColor': borderColor,
            '--tabSplitDropOverlayTop':
              typeof dropOverlayTop === 'number' ? `${dropOverlayTop}px` : dropOverlayTop,
            backgroundColor,
            ...style,
          } as React.CSSProperties
        }
      >
        {panes.map((pane, paneIndex) => {
          const paneTabs = pane.tabIds.flatMap((id) => {
            const tab = tabsById.get(id);

            return tab ? [tab] : [];
          });
          const visiblePaneTabs = paneTabs.filter(isTabVisible);
          const paneActiveTabId =
            pane.activeTabId && visiblePaneTabs.some((tab) => tab.idTab === pane.activeTabId)
              ? pane.activeTabId
              : visiblePaneTabs[visiblePaneTabs.length - 1]?.idTab;

          if (!paneTabs.length) return null;

          const paneStyle =
            panes.length === 2
              ? ({
                  flex: `0 0 ${
                    paneIndex === 0 ? firstPanePercent : 100 - firstPanePercent
                  }%`,
                } as React.CSSProperties)
              : undefined;

          return (
            <div
              key={pane.id}
              className={classes(
                styles.pane,
                dropTarget?.paneId === pane.id &&
                  (dropTarget.side === 'full'
                    ? styles.dropFull
                    : dropTarget.side === 'left'
                      ? styles.dropLeft
                      : styles.dropRight),
              )}
              style={paneStyle}
              onDragOver={(event) => handlePaneDragOver(event, pane.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDropTarget((prev) => (prev?.paneId === pane.id ? undefined : prev));
                }
              }}
              onDrop={(event) => handlePaneDrop(event, pane.id)}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('[data-tab-bar-id]')) return;

                setActivePaneId(pane.id);
                if (paneActiveTabId) onActiveTabIdChange(paneActiveTabId);
              }}
            >
              {children({
                pane,
                paneTabs,
                paneIndex,
                isLastPane: paneIndex === panes.length - 1,
                activeTabId: paneActiveTabId,
                tabBarProps: {
                  activeTabId: paneActiveTabId,
                  tabs: paneTabs,
                  idTabBar: `tab_split_${pane.id}`,
                  onMoveTab: (sourceTabId, targetTabId, placement) =>
                    handleMoveTab(sourceTabId, targetTabId, pane.id, placement),
                  onActiveTab: (tab) => {
                    const nextActiveTabId = tab?.idTab;

                    setActivePaneId((prev) => (prev === pane.id ? prev : pane.id));
                    if (nextActiveTabId) {
                      setPanes((prev) => setPaneActiveTab(prev, pane.id, nextActiveTabId));
                    }
                    onActiveTabIdChange(nextActiveTabId);
                  },
                },
              })}

              {paneIndex === 0 && panes.length === 2 && (
                <div
                  className={styles.resizeHandle}
                  role="separator"
                  aria-orientation="vertical"
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={() => setFirstPanePercent(50)}
                  onPointerDown={handleResizeStart}
                />
              )}
            </div>
          );
        })}
      </div>
    </TabSplitProvider>
  );
};

export default TabSplit;

export type { ITabSplitChildrenProps, ITabSplitPane, ITabSplitProps } from './types';
