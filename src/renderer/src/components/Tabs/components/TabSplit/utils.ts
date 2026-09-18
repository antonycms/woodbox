import type { ITab } from '../TabBar';
import type { ITabMovePlacement, ITabSplitDropSide, ITabSplitPane } from './types';

export const MAIN_SPLIT_PANE_ID = 'main';
export const MIN_SPLIT_PANE_PERCENT = 20;
export const MAX_SPLIT_PANE_PERCENT = 80;

const createSplitPaneId = () => `split_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const normalizeSplitPane = (pane: ITabSplitPane): ITabSplitPane => ({
  ...pane,
  activeTabId:
    pane.activeTabId && pane.tabIds.includes(pane.activeTabId)
      ? pane.activeTabId
      : pane.tabIds[pane.tabIds.length - 1],
});

export const getSplitDropSide = (clientX: number, element: HTMLElement): ITabSplitDropSide => {
  const rect = element.getBoundingClientRect();

  return clientX - rect.left < rect.width / 2 ? 'left' : 'right';
};

export const syncSplitPanes = (panes: ITabSplitPane[], tabs: ITab[], activePaneId: string) => {
  const existingTabIds = new Set(tabs.map((tab) => tab.idTab));
  const next = panes.map((pane) =>
    normalizeSplitPane({
      ...pane,
      tabIds: pane.tabIds.filter((id) => existingTabIds.has(id)),
    }),
  );
  const assignedTabIds = new Set(next.flatMap((pane) => pane.tabIds));
  const missingTabIds = tabs
    .filter((tab) => !assignedTabIds.has(tab.idTab))
    .map((tab) => tab.idTab);

  if (!next.length) next.push({ id: MAIN_SPLIT_PANE_ID, tabIds: [] });

  const activePaneIndex = Math.max(
    0,
    next.findIndex((pane) => pane.id === activePaneId),
  );

  next[activePaneIndex].tabIds.push(...missingTabIds);

  const panesWithTabs = next.filter((pane) => pane.tabIds.length);

  return (panesWithTabs.length ? panesWithTabs : [{ id: MAIN_SPLIT_PANE_ID, tabIds: [] }]).map(
    normalizeSplitPane,
  );
};

export const splitPanesAreEqual = (left: ITabSplitPane[], right: ITabSplitPane[]) => {
  if (left.length !== right.length) return false;

  return left.every((pane, index) => {
    const nextPane = right[index];

    return (
      pane.id === nextPane.id &&
      pane.activeTabId === nextPane.activeTabId &&
      pane.tabIds.length === nextPane.tabIds.length &&
      pane.tabIds.every((id, tabIndex) => id === nextPane.tabIds[tabIndex])
    );
  });
};

export const getPaneIdByTabId = (panes: ITabSplitPane[], tabId?: string | null) => {
  if (!tabId) return undefined;

  return panes.find((pane) => pane.tabIds.includes(tabId))?.id;
};

export const setPaneActiveTab = (
  panes: ITabSplitPane[],
  paneId: string,
  activeTabId: string,
) => {
  const pane = panes.find((item) => item.id === paneId);

  if (!pane || pane.activeTabId === activeTabId) return panes;

  return panes.map((item) => (item.id === paneId ? { ...item, activeTabId } : item));
};

const moveTabInPane = (
  panes: ITabSplitPane[],
  sourceTabId: string,
  targetTabId: string,
  placement: ITabMovePlacement = 'before',
) => {
  return panes.map((pane) => {
    const sourceIndex = pane.tabIds.indexOf(sourceTabId);
    const targetIndex = pane.tabIds.indexOf(targetTabId);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return pane;

    const tabIds = [...pane.tabIds];
    const [sourceTab] = tabIds.splice(sourceIndex, 1);
    const nextTargetIndex = tabIds.indexOf(targetTabId);
    const insertIndex = placement === 'after' ? nextTargetIndex + 1 : nextTargetIndex;

    tabIds.splice(insertIndex, 0, sourceTab);

    return { ...pane, tabIds };
  });
};

export const moveTabToTargetTab = (
  panes: ITabSplitPane[],
  sourceTabId: string,
  targetTabId: string,
  targetPaneId: string,
  placement: ITabMovePlacement = 'before',
) => {
  const sourcePane = panes.find((pane) => pane.tabIds.includes(sourceTabId));
  const targetPane = panes.find((pane) => pane.id === targetPaneId);

  if (!sourcePane || !targetPane) return panes;
  if (sourcePane.id === targetPane.id) {
    return moveTabInPane(panes, sourceTabId, targetTabId, placement);
  }

  return panes
    .map((pane) => {
      const nextPane = {
        ...pane,
        tabIds: pane.tabIds.filter((id) => id !== sourceTabId),
      };

      if (pane.id === targetPaneId) {
        const targetIndex = nextPane.tabIds.indexOf(targetTabId);
        const insertIndex =
          targetIndex >= 0
            ? placement === 'after'
              ? targetIndex + 1
              : targetIndex
            : nextPane.tabIds.length;

        nextPane.tabIds.splice(insertIndex, 0, sourceTabId);
        nextPane.activeTabId = sourceTabId;
      }

      return normalizeSplitPane(nextPane);
    })
    .filter((pane) => pane.tabIds.length);
};

export const moveTabToSplitPane = (
  panes: ITabSplitPane[],
  tabId: string,
  targetPaneId: string,
  side: ITabSplitDropSide,
) => {
  const sourcePane = panes.find((pane) => pane.tabIds.includes(tabId));
  const targetPane = panes.find((pane) => pane.id === targetPaneId);

  if (!sourcePane || !targetPane) return panes;

  if (panes.length === 1) {
    const remainingTabIds = targetPane.tabIds.filter((id) => id !== tabId);

    if (!remainingTabIds.length) return panes.map((pane) => ({ ...pane, activeTabId: tabId }));

    const originalPane = normalizeSplitPane({ ...targetPane, tabIds: remainingTabIds });
    const splitPane: ITabSplitPane = {
      id: createSplitPaneId(),
      tabIds: [tabId],
      activeTabId: tabId,
    };

    return side === 'left' ? [splitPane, originalPane] : [originalPane, splitPane];
  }

  if (sourcePane.id === targetPaneId) {
    return panes.map((pane) => (pane.id === targetPaneId ? { ...pane, activeTabId: tabId } : pane));
  }

  return panes
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
};
