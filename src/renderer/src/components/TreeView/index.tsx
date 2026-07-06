import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

import { AvalailableTreeViewIcon } from './IconItemTreeView';
import ItemTreeView, { IItemTreeViewProps } from './ItemTreeView';

const TreeView = (props: ITreeViewProps) => {
  const [openedItemsId, setOpenedItemsId] = React.useState<string[]>([]);

  const getItemRecursive = (items: IItemTreeView[], id: string) => {
    if (!id || !items?.length) return;

    for (const item of items) {
      if (!item) continue;

      if (item.id === id) return item;

      const itemChild = getItemRecursive(item.childs, id);

      if (itemChild) return itemChild;
    }
  };

  const getItemFromElement = (target: HTMLDivElement): IItemTreeView => {
    const idItem = target?.id?.replace?.('item_treeview_id_', '');
    const item = getItemRecursive(props.items, idItem);

    return item;
  };

  const getSurroundingElements = () => {
    const elements = Array.from(
      document.querySelectorAll<HTMLDivElement>(`.${styles.container} *[tabindex="0"]`),
    );

    const index = elements.indexOf(document.activeElement as HTMLDivElement);

    if (index === -1) return { prevItem: null, nextItem: null };

    return {
      prevItem: elements[index - 1] ?? null,
      nextItem: elements[index + 1] ?? null,
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
      const item = getItemRecursive(props.items, id);

      if (!item) return;

      await handleSwitchItem(item, open);
    },
  }));

  return (
    <div
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
            color={item.color}
            iconColor={item.iconColor}
            openedItemsId={openedItemsId}
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
