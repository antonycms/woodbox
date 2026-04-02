import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

import { AvalailableTreeViewIcon } from './IconItemTreeView';
import ItemTreeView, { IItemTreeViewProps } from './ItemTreeView';

const TreeView = (props: ITreeViewProps) => {
  const [openedItemsId, setOpenedItemsId] = React.useState<string[]>([]);

  const getItemRecursive = (items: IItem[], id: string) => {
    if (!id || !items?.length) return;

    for (const item of items) {
      if (item.id === id) return item;

      const itemChild = getItemRecursive(item.childs, id);

      if (itemChild) return itemChild;
    }
  };

  const getItemFromElement = (target: HTMLDivElement): IItem => {
    const idItem = target?.id?.replace?.('item_treeview_id_', '');
    const item = getItemRecursive(props.items, idItem);

    return item;
  };

  const getSurroundingElements = () => {
    const elements = document.querySelectorAll<HTMLDivElement>(
      `.${styles.container} *[tabindex="0"]`,
    );

    let prevItem = null;
    let nextItem = null;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      prevItem = elements[i - 1];
      nextItem = elements[i + 1];

      if (document.activeElement === element) break;
    }

    return { prevItem, nextItem };
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const element = e.target as HTMLDivElement;
    const item = getItemFromElement(element);

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') handleSwitchItem(item);
    if (e.key === 'ArrowUp') getSurroundingElements()?.prevItem?.focus();
    if (e.key === 'ArrowDown') getSurroundingElements()?.nextItem?.focus();
    if (e.key === 'Enter') handleDoubleClick(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const element = e.target as HTMLDivElement;
    const item = getItemFromElement(element);

    if (!item) return;

    element?.focus();
    props.onClick?.({ id: item.id, data: item.data, type: item.type });
  };

  const handleDoubleClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (typeof props.onDoubleClick !== 'function') return;

    const element = e.target as HTMLDivElement;
    const item = getItemFromElement(element);

    if (!item) return;

    element?.focus();
    props.onDoubleClick?.({ id: item.id, data: item.data, type: item.type });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const element = e.target as HTMLDivElement;
    const item = getItemFromElement(element);

    if (!item) return;

    element?.focus();
    props.onContextMenu?.({ id: item.id, data: item.data, type: item.type }, e);
  };

  const handleSwitchItem = async (item: IItem) => {
    const itemIsOpen = openedItemsId.some((id) => id === item.id);

    const succes = await props.onSwitchItem?.(item, itemIsOpen);

    if (succes === false) return;

    if (itemIsOpen) {
      setOpenedItemsId((prevState) => prevState.filter((id) => id !== item.id));
    } else {
      setOpenedItemsId((prevState) => [...prevState, item.id]);
    }
  };

  return (
    <div
      className={classes(styles.container)}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={onKeyDown}
    >
      {props.items.map((item) => (
        <ItemTreeView
          {...item}
          isFirst
          key={item.id}
          color={props.color}
          openedItemsId={openedItemsId}
          onSwitch={handleSwitchItem}
        />
      ))}
    </div>
  );
};

export default TreeView;

export interface IItemTreeViewData {
  id: string;
  data?: any;
  type?: string;
}

export interface IItem extends IItemTreeViewData {
  label: string;
  childs?: IItemTreeViewProps[];
  icon?: AvalailableTreeViewIcon;
  renderIcon?(): JSX.Element;
  loading?: boolean;
}

interface ITreeViewProps {
  items: IItem[];
  color?: string;
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
