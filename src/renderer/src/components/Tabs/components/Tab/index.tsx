import React from 'react';
import { CgClose } from 'react-icons/cg';
import { classes, toCssProperties } from '@renderer/styles/theme';
import { Text } from '@renderer/components/Text';
import styles from '@renderer/components/Tabs/styles.module.css';

const Tab = (props: ITabProps) => {
  const {
    id,
    active,
    title,
    isDraging,
    onDragStart,
    onDragEnter,
    onDragEnd,
    onClick,
    onRemove,
    unsaved,
    draggable,
    allowClose,
    height,
    vertical,
    color,
    ascentColor,
    backgroundColor,
    onContextMenu,
    icon: Icon,
  } = props;

  const stylesVar = toCssProperties({ color, ascentColor, backgroundColor });

  return (
    <div
      className={classes(styles.tab, active && styles.active, vertical && styles.vertical)}
      id={id}
      style={{ ...stylesVar, height } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      title={`${title}${unsaved ? ' - Modificado' : ''}`}
    >
      {!!Icon && <Icon />}
      <Text
        userSelect={false}
        color={active ? ascentColor : color}
        className={classes(styles.ignoreTabDrag, styles.title)}
      >
        {title}
      </Text>

      {!!allowClose && (
        <button
          title="Fechar"
          className={classes(
            styles.tabCloseBtn,
            unsaved && styles.unsaved,
            isDraging && styles.ignoreTabDrag,
          )}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(e);
          }}
        >
          <CgClose className={styles.ignoreTabDrag} color={active ? ascentColor : color} />
        </button>
      )}
    </div>
  );
};

export default Tab;

export interface ITabProps {
  id?: string;
  unsaved?: boolean;
  title: string;
  isDraging?: boolean;
  draggable?: 'true' | 'false';
  allowClose?: boolean;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onRemove?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
  height?: string;
  vertical?: boolean;
  icon?(): JSX.Element;
  active?: boolean;
  color: string;
  ascentColor: string;
  backgroundColor: string;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}

export type TabComponent = (props: ITabProps) => JSX.Element;
