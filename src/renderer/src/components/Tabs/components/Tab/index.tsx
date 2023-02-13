import React from 'react';
import { CgClose } from 'react-icons/cg';
import clsx from 'clsx';
import { Text } from '@renderer/components/Text';
import { toCssProperties } from '@renderer/styles/theme';
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
    icon: Icon,
  } = props;

  const stylesVar = toCssProperties({ color, ascentColor, backgroundColor });

  return (
    <div
      className={clsx(styles.tab, active && styles.active, vertical && styles.vertical)}
      id={id}
      style={{ ...stylesVar, height } as React.CSSProperties}
      onClick={onClick}
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
        className={clsx(styles.ignoreTabDrag, styles.title)}
      >
        {title}
      </Text>

      {!!allowClose && (
        <button
          title="Fechar"
          className={clsx(
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
}

export type TabComponent = (props: ITabProps) => JSX.Element;
