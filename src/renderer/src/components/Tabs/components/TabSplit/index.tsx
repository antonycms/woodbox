import React from 'react';
import { classes } from '@renderer/styles/theme';
import type { ITab } from '../TabBar';
import TabContent from '../TabContent';
import TabWindow from '../TabWindow';
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
    renderBar,
    renderTabContent,
    emptyPane,
    borderColor,
    backgroundColor,
    contentBackgroundColor,
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
  const [dragDataType] = React.useState(`application/x-woodbox-tab-split-${crypto.randomUUID()}`);
  const [draggingTabId, setDraggingTabId] = React.useState<string>();
  const layoutRef = React.useRef<HTMLDivElement>(null);
  const activeGlobalPaneId = React.useMemo(() => {
    return getPaneIdByTabId(panes, activeTabId);
  }, [activeTabId, panes]);

  const tabsById = React.useMemo(() => {
    return new Map(tabs.map((tab) => [tab.idTab, tab]));
  }, [tabs]);

  const paneLayouts = React.useMemo(() => {
    return panes.map((pane, paneIndex) => {
      const paneTabs = pane.tabIds.flatMap((id) => {
        const tab = tabsById.get(id);

        return tab ? [tab] : [];
      });
      const visiblePaneTabs = paneTabs.filter(isTabVisible);
      const paneActiveTabId =
        pane.activeTabId && visiblePaneTabs.some((tab) => tab.idTab === pane.activeTabId)
          ? pane.activeTabId
          : visiblePaneTabs[visiblePaneTabs.length - 1]?.idTab;

      return { pane, paneIndex, paneTabs, activeTabId: paneActiveTabId };
    });
  }, [panes, tabsById, isTabVisible]);

  const tabLayouts = React.useMemo(() => {
    return new Map(
      paneLayouts.flatMap((layout) => layout.pane.tabIds.map((id) => [id, layout] as const)),
    );
  }, [paneLayouts]);

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

    const tabId = event.dataTransfer.getData(dragDataType);

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

  const getPaneEvents = (paneId: string, paneActiveTabId?: string) => ({
    onDragEnter: (event: React.DragEvent<HTMLDivElement>) => handlePaneDragOver(event, paneId),
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => handlePaneDragOver(event, paneId),
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setDropTarget((prev) => (prev?.paneId === paneId ? undefined : prev));
      }
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => handlePaneDrop(event, paneId),
    onClick: (event: React.MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('[data-tab-bar-id]')) return;

      setActivePaneId(paneId);
      if (paneActiveTabId) onActiveTabIdChange(paneActiveTabId);
    },
  });

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
    <div
      ref={layoutRef}
      className={classes(styles.layout, className)}
      style={
        {
          '--tabSplitBorderColor': borderColor,
          gridTemplateColumns:
            panes.length === 2
              ? `minmax(0, ${firstPanePercent}fr) minmax(0, ${100 - firstPanePercent}fr)`
              : 'minmax(0, 1fr)',
          backgroundColor,
          ...style,
        } as React.CSSProperties
      }
    >
      {paneLayouts.map(({ pane, paneIndex, paneTabs, activeTabId: paneActiveTabId }) => {
        if (!paneTabs.length) return null;

        const paneStyle = { gridColumn: paneIndex + 1 };
        const paneBorder = paneIndex > 0 && styles.paneBorder;
        const paneEvents = getPaneEvents(pane.id, paneActiveTabId);

        return (
          <React.Fragment key={pane.id}>
            <div
              className={classes(styles.paneHeader, paneBorder)}
              style={paneStyle}
              {...paneEvents}
            >
              {renderBar({
                pane,
                paneTabs,
                paneIndex,
                isLastPane: paneIndex === panes.length - 1,
                activeTabId: paneActiveTabId,
                tabBarProps: {
                  dragDataType,
                  onDraggingTabId: setDraggingTabId,
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
            </div>

            <div
              className={classes(
                styles.paneContent,
                paneBorder,
                dropTarget?.paneId === pane.id &&
                  (dropTarget.side === 'full'
                    ? styles.dropFull
                    : dropTarget.side === 'left'
                      ? styles.dropLeft
                      : styles.dropRight),
              )}
              style={paneStyle}
              {...paneEvents}
            >
              {!paneActiveTabId && emptyPane}
            </div>
          </React.Fragment>
        );
      })}

      {/* A identidade do conteúdo depende só da aba, nunca do pane que a exibe. */}
      {tabs.map((tab) => {
        const layout = tabLayouts.get(tab.idTab);
        const isActive = layout?.activeTabId === tab.idTab;

        return (
          <div
            key={tab.idTab}
            data-tab-split-content={tab.idTab}
            className={classes(styles.paneContent, layout?.paneIndex > 0 && styles.paneBorder)}
            style={{ gridColumn: (layout?.paneIndex ?? 0) + 1 }}
            hidden={!isActive}
            {...(layout && getPaneEvents(layout.pane.id, layout.activeTabId))}
          >
            <TabWindow>
              <TabContent activeTabId={layout?.activeTabId} idTab={tab.idTab} backgroundColor={contentBackgroundColor}>
                {renderTabContent(tab, isActive)}
              </TabContent>
            </TabWindow>
          </div>
        );
      })}

      {panes.length === 2 && (
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
};

export default TabSplit;

export type { ITabSplitBarProps, ITabSplitPane, ITabSplitProps } from './types';
