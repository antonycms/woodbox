import React from 'react';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import { FaFolder, FaDatabase, FaTable } from 'react-icons/fa';
import { CgFileDocument } from 'react-icons/cg';
import { classes } from '@renderer/styles/theme';
import { SpinnerLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';

const Icon = ({ icon, ...props }: IIcon) => {
  const availableIcons = {
    defalt: FaFolder,
    folder: FaFolder,
    file: CgFileDocument,
    database: FaDatabase,
    table: FaTable,
  };

  const Cp = availableIcons[icon] || availableIcons.defalt;

  return (
    <Cp
      {...props}
      className={classes(styles.icon, icon === 'file' && styles.icon2)}
      style={{ pointerEvents: 'none' }}
    />
  );
};

const ItemTreeView = (props: IItemTreeViewProps) => {
  const { icon, loading, color = 'white', childs = [], openedItemsId = [] } = props;

  const isOpen = () => openedItemsId.some((id) => id === props.id);

  return (
    <div
      title={props.label}
      className={classes(styles.containerItem, props.isFirst && styles.first)}
    >
      <div
        id={`item_treeview_id_${props.id}`}
        className={classes(
          styles.containerItemInfo,
          props.focusedItemId === props.id && styles.focused,
        )}
      >
        {loading ? (
          <SpinnerLoading thickness={2} size={10} color="white" />
        ) : isOpen() ? (
          <MdKeyboardArrowDown
            className={classes(styles.icon, styles.arrow)}
            color={color}
            onClick={() => props.onSwitch(props)}
          />
        ) : (
          <MdKeyboardArrowRight
            className={classes(styles.icon, styles.arrow)}
            color={color}
            onClick={() => props.onSwitch(props)}
          />
        )}

        {props?.renderIcon?.() || (
          <Icon className={styles.ignorePointerEvents} icon={icon} color={color} />
        )}

        <span
          className={classes(styles.containerItemLabel, styles.ignorePointerEvents)}
          style={{ color }}
        >
          {props.label}
        </span>
      </div>

      {isOpen() &&
        childs.map((child) => (
          <ItemTreeView
            {...child}
            key={child.id}
            color={color}
            onSwitch={props.onSwitch}
            openedItemsId={openedItemsId}
            focusedItemId={props.focusedItemId}
          />
        ))}
    </div>
  );
};

const TreeView = (props: ITreeViewProps) => {
  const [openedItemsId, setOpenedItemsId] = React.useState<string[]>([]);
  const [focusedItemId, setFocusedItemId] = React.useState<string>(null);

  const getItemRecursive = (items: IItem[], id: string) => {
    if (!id) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.id === id) return item;

      const itemChild = getItemRecursive(Array.isArray(item.childs) ? item.childs : [], id);
      if (itemChild) return itemChild;
    }
  };

  const getItemFromMouseEvent = (e: React.MouseEvent<HTMLDivElement, MouseEvent>): IItem => {
    const target = e?.target as HTMLElement;

    const idItem = target?.id?.replace?.('item_treeview_id_', '');
    const item = getItemRecursive(props.items, idItem);

    return item;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const item = getItemFromMouseEvent(e);

    if (!item) return;

    setFocusedItemId(item.id);
    props.onClick?.({ id: item.id, data: item.data, type: item.type });
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (typeof props.onDoubleClick !== 'function') return;

    const item = getItemFromMouseEvent(e);
    if (!item) return;

    props.onDoubleClick?.({ id: item.id, data: item.data, type: item.type });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const item = getItemFromMouseEvent(e);

    if (!item) return;

    setFocusedItemId(item.id);
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
    >
      {props.items.map((item) => (
        <ItemTreeView
          {...item}
          isFirst
          key={item.id}
          color={props.color}
          openedItemsId={openedItemsId}
          focusedItemId={focusedItemId}
          onSwitch={handleSwitchItem}
        />
      ))}
    </div>
  );
};

export default TreeView;

interface IIcon {
  icon: string;
  color?: string;
  className?: string;
}

export interface IItemTreeViewData {
  id: string;
  data?: any;
  type?: string;
}

export interface IItem extends IItemTreeViewData {
  label: string;
  childs?: IItemTreeViewProps[];
  icon?: 'folder' | 'file' | 'file2' | 'database' | 'table';
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

interface IItemTreeViewProps extends IItem {
  isFirst?: boolean;
  color?: string;
  openedItemsId?: string[];
  focusedItemId?: string;
  onSwitch?(item: IItem): void;
}
