import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

import { AvalailableTreeViewIcon } from './IconItemTreeView';
import ItemTreeView, { IItemTreeViewProps } from './ItemTreeView';
import { useThemeContext } from '@renderer/contexts/Theme';

const getVisibleItemIds = (items: IItemTreeView[] = [], openedItemsIdSet: Set<string>) => {
  const ids: string[] = [];

  const addItems = (itemsToAdd: IItemTreeView[] = []) => {
    for (const item of itemsToAdd) {
      if (!item) continue;

      ids.push(item.id);

      if (openedItemsIdSet.has(item.id)) {
        addItems(item.childs);
      }
    }
  };

  addItems(items);

  return ids;
};

const TreeView = (props: ITreeViewProps) => {
  const { activeTheme } = useThemeContext();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [openedItemsId, setOpenedItemsId] = React.useState<string[]>([]);
  const [revealedItemId, setRevealedItemId] = React.useState<string>();
  const openedItemsIdSet = React.useMemo(() => new Set(openedItemsId), [openedItemsId]);
  const defaultColor = activeTheme.sideBar.color;
  const focusBackgroundColor =
    activeTheme.sideBar.selectedBackgroundColor;

  const itemsById = React.useMemo(() => {
    const map = new Map<string, IItemTreeView>();

    const addItems = (items: IItemTreeView[] = []) => {
      for (const item of items) {
        if (!item) continue;

        map.set(item.id, item);
        addItems(item.childs);
      }
    };

    addItems(props.items);

    return map;
  }, [props.items]);

  const visibleItemIds = React.useMemo(
    () => getVisibleItemIds(props.items, openedItemsIdSet),
    [openedItemsIdSet, props.items],
  );

  const getItem = React.useCallback((id?: string) => {
    return id ? itemsById.get(id) : undefined;
  }, [itemsById]);

  const getItemFromElement = React.useCallback((target: HTMLDivElement): IItemTreeView => {
    const idItem = target?.id?.replace?.('item_treeview_id_', '');
    const item = getItem(idItem);

    return item;
  }, [getItem]);

  const getItemElement = (id?: string) => {
    if (!id) return null;

    return document.getElementById(`item_treeview_id_${id}`) as HTMLDivElement | null;
  };

  const getActiveItemId = () =>
    (document.activeElement as HTMLDivElement)?.id?.replace?.('item_treeview_id_', '');

  const getSurroundingElements = () => {
    const index = visibleItemIds.indexOf(getActiveItemId());

    if (index === -1) return { prevItem: null, nextItem: null };

    return {
      prevItem: getItemElement(visibleItemIds[index - 1]),
      nextItem: getItemElement(visibleItemIds[index + 1]),
    };
  };

  const handleSelectItem = (element: HTMLDivElement) => {
    if (!element) return;

    const item = getItemFromElement(element);

    if (!item) return;

    element?.focus();
    props.onClick?.({ id: item.id, label: item.label, data: item.data, type: item.type });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isNavigationKey = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key);

    if (isNavigationKey) e.preventDefault();

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      handleSwitchItem(getItemFromElement(e.target as HTMLDivElement));
    } //
    else if (e.key === 'ArrowUp') {
      handleSelectItem(getSurroundingElements()?.prevItem);
    } //
    else if (e.key === 'ArrowDown') {
      handleSelectItem(getSurroundingElements()?.nextItem);
    } //
    else if (e.key === 'Enter') {
      handleDoubleClick(e);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    handleSelectItem(e.target as HTMLDivElement);
  };

  const handleDoubleClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (typeof props.onDoubleClick !== 'function') return;

    const element = e.target as HTMLDivElement;
    const item = getItemFromElement(element);

    if (!item) return;

    element?.focus();
    props.onDoubleClick?.({ id: item.id, label: item.label, data: item.data, type: item.type });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const element = e.target as HTMLDivElement;
    const item = getItemFromElement(element);

    if (!item) return;

    element?.focus();
    props.onClick?.({ id: item.id, label: item.label, data: item.data, type: item.type });
    props.onContextMenu?.({ id: item.id, label: item.label, data: item.data, type: item.type }, e);
  };

  const handleSwitchItem = async (item: IItemTreeView, open?: boolean) => {
    const itemIsOpen = openedItemsId.some((id) => id === item.id);

    if (typeof open === 'boolean' && itemIsOpen === open) return;

    const succes = await props.onSwitchItem?.(item, itemIsOpen);

    if (succes === false) return;

    if (open === false || itemIsOpen) {
      setOpenedItemsId((prevState) => prevState.filter((id) => id !== item.id));
    } else {
      setOpenedItemsId((prevState) => [...prevState, item.id]);
    }
  };

  React.useImperativeHandle(props.ref, () => ({
    switch: async (id: string, open?: boolean) => {
      const item = getItem(id);

      if (!item) return;

      await handleSwitchItem(item, open);
    },
    reveal: async (id: string, parentIds: string[] = [], options?: ITreeViewRevealOptions) => {
      for (const parentId of parentIds) {
        const parent = getItem(parentId);

        if (parent) await handleSwitchItem(parent, true);
      }

      return new Promise<boolean>((resolve) => {
        requestAnimationFrame(() => {
          const element = document.getElementById(`item_treeview_id_${id}`);

          setRevealedItemId(id);
          if (options?.focus !== false) element?.focus();
          element?.scrollIntoView({ block: 'center' });
          resolve(!!element);
        });
      });
    },
  }));

  return (
    <div
      ref={containerRef}
      className={classes(styles.container)}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={onKeyDown}
    >
      {props.items.map((item) => {
        if (!item) return null;

        return (
          <ItemTreeView
            {...item}
            isFirst
            key={item.id}
            color={item.color || defaultColor}
            iconColor={item.iconColor || item.color || defaultColor}
            focusBackgroundColor={focusBackgroundColor}
            openedItemsIdSet={openedItemsIdSet}
            revealedItemId={revealedItemId}
            onSwitch={handleSwitchItem}
          />
        );
      })}
    </div>
  );
};

export default TreeView;

export interface IItemTreeViewData {
  id: string;
  label: string;
  data?: any;
  type?: string;
}

export interface IItemTreeView extends IItemTreeViewData {
  labelInfo?: string;
  childs?: IItemTreeViewProps[];
  icon?: AvalailableTreeViewIcon;
  color?: string;
  iconColor?: string;
  renderIcon?(): React.ReactElement;
  loading?: boolean;
}

export interface ITreeViewRef {
  switch(id: string, open?: boolean): Promise<void>;
  reveal(id: string, parentIds?: string[], options?: ITreeViewRevealOptions): Promise<boolean>;
}

interface ITreeViewRevealOptions {
  focus?: boolean;
}

interface ITreeViewProps {
  ref?: React.Ref<ITreeViewRef>;
  items: IItemTreeView[];
  onClick?(itemData: IItemTreeViewData): void;
  onDoubleClick?(itemData: IItemTreeViewData): void;
  onSwitchItem?(
    item: IItemTreeViewData,
    isOpen: boolean,
  ): boolean | void | Promise<boolean> | Promise<void>;
  onContextMenu?(
    item: IItemTreeViewData,
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ): void;
}
