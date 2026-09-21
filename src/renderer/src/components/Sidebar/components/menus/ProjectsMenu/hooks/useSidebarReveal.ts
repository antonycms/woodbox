import type { ProjectTreeItem } from '../types';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ITreeViewRef } from '@renderer/components/TreeView';
import { useAppTabStore } from '@renderer/stores/AppTab';

type SidebarRevealTarget = {
  type: 'table' | 'function';
  idConnection: string;
  schema?: string;
  name: string;
};

type SidebarRevealPath = { id: string; parentIds: string[] };

const normalizeSchema = (schema?: string | null) => schema || undefined;

const getSidebarRevealKey = (target: SidebarRevealTarget) => {
  return [target.type, target.idConnection, normalizeSchema(target.schema) || '', target.name].join(
    '\0',
  );
};

const getSidebarRevealItemKey = (item: ProjectTreeItem) => {
  if (item.type !== 'table' && item.type !== 'function') return;

  if (item.type === 'table') {
    if (!item.data?.id_connection || !item.data?.table_name) return;

    return getSidebarRevealKey({
      type: 'table',
      idConnection: item.data?.id_connection,
      schema: item.data?.table_schema,
      name: item.data?.table_name,
    });
  }

  if (item.type === 'function') {
    if (!item.data?.id_connection || !item.data?.function_name) return;

    return getSidebarRevealKey({
      type: 'function',
      idConnection: item.data?.id_connection,
      schema: item.data?.function_schema,
      name: item.data?.function_name,
    });
  }
};

const buildSidebarRevealIndex = (items: ProjectTreeItem[]) => {
  const index = new Map<string, SidebarRevealPath>();

  const addItems = (itemsToAdd: ProjectTreeItem[] = [], parentIds: string[] = []) => {
    for (const item of itemsToAdd) {
      if (!item) continue;

      const itemKey = getSidebarRevealItemKey(item);

      if (itemKey) {
        index.set(itemKey, { id: item.id, parentIds });
      }

      if (item.childs?.length) {
        addItems(item.childs, [...parentIds, item.id]);
      }
    }
  };

  addItems(items);

  return index;
};

const getSidebarRevealPath = (
  sidebarRevealIndex: Map<string, SidebarRevealPath>,
  target: SidebarRevealTarget,
) => {
  return sidebarRevealIndex.get(getSidebarRevealKey(target));
};

const scheduleSidebarReveal = (callback: () => void) => {
  let secondFrameId: number | undefined;

  const firstFrameId = window.requestAnimationFrame(() => {
    secondFrameId = window.requestAnimationFrame(callback);
  });

  return () => {
    window.cancelAnimationFrame(firstFrameId);
    if (secondFrameId) window.cancelAnimationFrame(secondFrameId);
  };
};

export const useSidebarReveal = (
  treeViewRef: React.RefObject<ITreeViewRef>,
  projectsSerialized: ProjectTreeItem[],
) => {
  const { tabs, activeTabId } = useAppTabStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    })),
  );
  const lastRevealKeyRef = React.useRef('');

  const sidebarRevealIndex = React.useMemo(() => {
    return buildSidebarRevealIndex(projectsSerialized);
  }, [projectsSerialized]);

  const activeSidebarRevealTarget = React.useMemo<SidebarRevealTarget | undefined>(() => {
    const tab = tabs.find((item) => item.id === activeTabId);
    const data = tab?.data;

    if (data?.type === 'table-info') {
      return {
        type: 'table',
        idConnection: data.id_connection,
        schema: data.schema,
        name: data.table,
      };
    }

    if (data?.type === 'function-info') {
      return {
        type: 'function',
        idConnection: data.id_connection,
        schema: data.schema,
        name: data.function_name,
      };
    }
  }, [activeTabId, tabs]);

  React.useEffect(() => {
    if (!activeSidebarRevealTarget) {
      lastRevealKeyRef.current = '';
      return;
    }

    const revealPath = getSidebarRevealPath(sidebarRevealIndex, activeSidebarRevealTarget);

    if (!revealPath) {
      lastRevealKeyRef.current = '';
      return;
    }

    const revealKey = [activeTabId, revealPath.id, ...revealPath.parentIds].join('|');

    if (lastRevealKeyRef.current === revealKey) return;

    lastRevealKeyRef.current = revealKey;

    return scheduleSidebarReveal(() => {
      treeViewRef.current?.reveal(revealPath.id, revealPath.parentIds, { focus: false });
    });
  }, [activeSidebarRevealTarget, activeTabId, sidebarRevealIndex]);
};
