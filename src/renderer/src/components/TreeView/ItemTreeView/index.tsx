import React from 'react';
import { IItemTreeView } from '@renderer/components/TreeView';
import styles from './styles.module.css';
import { classes } from '@renderer/styles/theme';
import { SpinnerLoading } from '@renderer/components/Loaders';
import IconItemTreeView from '../IconItemTreeView';

const ItemTreeView = (props: IItemTreeViewProps) => {
  const { icon, loading, color = 'white', childs, openedItemsId = [] } = props;

  const isOpen = openedItemsId.some((id) => id === props.id);

  return (
    <div
      title={props.label}
      className={classes(styles.containerItem, props.isFirst && styles.first)}
    >
      <div
        id={`item_treeview_id_${props.id}`}
        tabIndex={0}
        className={classes(styles.containerItemInfo)}
      >
        {loading ? (
          <SpinnerLoading thickness={2} size={10} color="white" />
        ) : childs ? (
          <IconItemTreeView
            no_margin
            color={color}
            onClick={() => props.onSwitch(props)}
            icon={isOpen ? 'arrowDown' : 'arrowRight'}
          />
        ) : (
          <IconItemTreeView
            no_margin
            color="transparent"
            icon={isOpen ? 'arrowDown' : 'arrowRight'}
          />
        )}

        {props?.renderIcon?.() || <IconItemTreeView icon={icon} color={color} />}

        <span
          className={classes(styles.containerItemLabel, styles.ignorePointerEvents)}
          style={{ color }}
        >
          {props.label}
        </span>

        {props.labelInfo && (
          <span
            className={classes(styles.containerItemLabelInfo, styles.ignorePointerEvents)}
            style={{ color }}
          >
            {props.labelInfo}
          </span>
        )}
      </div>

      {!!(isOpen && childs) &&
        childs.map((child) => {
          if (!child) return null;

          return (
            <ItemTreeView
              {...child}
              key={child.id}
              color={color}
              onSwitch={props.onSwitch}
              openedItemsId={openedItemsId}
            />
          );
        })}
    </div>
  );
};

export default ItemTreeView;

export interface IItemTreeViewProps extends IItemTreeView {
  isFirst?: boolean;
  color?: string;
  openedItemsId?: string[];
  onSwitch?(item: IItemTreeView): void;
}
