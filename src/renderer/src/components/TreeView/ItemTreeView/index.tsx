import React from 'react';
import { IItemTreeView } from '@renderer/components/TreeView';
import styles from './styles.module.css';
import { classes } from '@renderer/styles/theme';
import { SpinnerLoading } from '@renderer/components/Loaders';
import IconItemTreeView from '../IconItemTreeView';

const ItemTreeView = <Data,>(props: IItemTreeViewProps<Data>) => {
  const { icon, loading, childs, openedItemsIdSet } = props;
  const color = props.color;
  const iconColor = props.iconColor || color;
  const focusBackgroundColor = props.focusBackgroundColor;

  const isOpen = !!openedItemsIdSet?.has(props.id);
  const childCount = props.showChildCount ? childs?.filter(Boolean).length || 0 : 0;
  const showConnectionStatus = props.type === 'connection' && props.isConnected && props.labelInfo;

  return (
    <div
      title={`${props.label}${props.labelInfo ? `  [${props.labelInfo}]` : ''}`}
      className={classes(styles.containerItem, props.isFirst && styles.first)}
    >
      <div
        id={`item_treeview_id_${props.id}`}
        tabIndex={0}
        className={classes(
          styles.containerItemInfo,
          props.revealedItemId === props.id && styles.revealed,
        )}
        style={
          {
            '--tree-item-focus-background-color': focusBackgroundColor,
            '--tree-item-connection-status-color': props.connectionStatusColor,
            color,
          } as React.CSSProperties
        }
      >
        {loading ? (
          <SpinnerLoading thickness={2} size={10} color={iconColor} />
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

        {props?.renderIcon?.() || <IconItemTreeView icon={icon} color={iconColor} />}

        <span
          className={classes(styles.containerItemLabel, styles.ignorePointerEvents)}
          style={{ color }}
        >
          {props.label}
        </span>

        {(props.labelInfo || childCount > 0) && (
          <span className={classes(styles.containerItemMeta, styles.ignorePointerEvents)}>
            {showConnectionStatus && <span className={styles.connectionStatus} />}

            {props.labelInfo && (
              <span className={styles.containerItemLabelInfo} style={{ color }}>
                {props.labelInfo}
              </span>
            )}

            {childCount > 0 && (
              <span className={styles.containerItemChildCount} style={{ color }}>
                {childCount}
              </span>
            )}
          </span>
        )}
      </div>

      {!!(isOpen && childs) &&
        childs.map((child) => {
          if (!child) return null;

          return (
            <ItemTreeViewMemo
              {...child}
              key={child.id}
              color={color}
              iconColor={iconColor}
              focusBackgroundColor={focusBackgroundColor}
              connectionStatusColor={props.connectionStatusColor}
              onSwitch={props.onSwitch}
              openedItemsIdSet={openedItemsIdSet}
              revealedItemId={props.revealedItemId}
            />
          );
        })}
    </div>
  );
};

const ItemTreeViewMemo = React.memo(ItemTreeView) as typeof ItemTreeView;

export default ItemTreeViewMemo;

export interface IItemTreeViewProps<Data = unknown> extends IItemTreeView<Data> {
  isFirst?: boolean;
  color?: string;
  focusBackgroundColor?: string;
  connectionStatusColor?: string;
  openedItemsIdSet?: Set<string>;
  revealedItemId?: string;
  onSwitch?(item: IItemTreeView<Data>): void;
}
