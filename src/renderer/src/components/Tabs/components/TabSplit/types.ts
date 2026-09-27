import type React from 'react';
import type { ITab, ITabsBarProps } from '../TabBar';

export type ITabSplitDropSide = 'left' | 'right' | 'full';
export type ITabMovePlacement = 'before' | 'after';

export interface ITabSplitPane {
  id: string;
  tabIds: string[];
  activeTabId?: string;
}

export interface ITabSplitBarProps<TTab extends ITab = ITab> {
  pane: ITabSplitPane;
  paneTabs: TTab[];
  paneIndex: number;
  isLastPane: boolean;
  activeTabId?: string;
  tabBarProps: Pick<
    ITabsBarProps,
    'dragDataType' | 'onDraggingTabId' | 'activeTabId' | 'tabs' | 'idTabBar' | 'onActiveTab' | 'onMoveTab'
  >;
}

export interface ITabSplitDropTarget {
  paneId: string;
  side: ITabSplitDropSide;
}

export interface ITabSplitProps<TTab extends ITab = ITab> {
  tabs: TTab[];
  activeTabId?: string | null;
  onActiveTabIdChange(activeTabId?: string): void;
  onMoveTab?(sourceTabId: string, targetTabId: string, placement?: ITabMovePlacement): void;
  /** Renderiza apenas a barra do pane; os conteúdos têm uma árvore independente. */
  renderBar(props: ITabSplitBarProps<TTab>): React.ReactNode;
  renderTabContent(tab: TTab, isActiveTab: boolean): React.ReactNode;
  emptyPane?: React.ReactNode;
  isTabVisible?(tab: TTab): boolean;
  borderColor?: string;
  backgroundColor?: string;
  contentBackgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
  minPanePercent?: number;
  maxPanePercent?: number;
}
