import React from 'react';
import { IItemTreeView } from '@renderer/components/TreeView';
import styles from './styles.module.css';
import { classes } from '@renderer/styles/theme';
import { SpinnerLoading } from '@renderer/components/Loaders';
import { useThemeContext } from '@renderer/contexts/Theme';
import IconItemTreeView from '../IconItemTreeView';

const ItemTreeView = (props: IItemTreeViewProps) => {
  const { icon, loading, childs, openedItemsId = [] } = props;
  const { activeTheme } = useThemeContext();
  const color = props.color || activeTheme.sideBar.color;
  const iconColor = props.iconColor || color;
  const focusBackgroundColor =
    activeTheme.sideBar.selectedBackgroundColor || activeTheme.__colors.darkLightDeep;

  const isOpen = openedItemsId.some((id) => id === props.id);

  return (
    <div
      title={`${props.label}${props.labelInfo ? `  [${props.labelInfo}]` : ''}`}
      className={classes(styles.containerItem, props.isFirst && styles.first)}
    >
      <div
        id={`item_treeview_id_${props.id}`}
        tabIndex={0}
        className={classes(styles.containerItemInfo)}
        style={
          {
            '--tree-item-focus-background-color': focusBackgroundColor,
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
              iconColor={iconColor}
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
