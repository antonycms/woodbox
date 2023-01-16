import React from 'react';
import styles from '../../styles.module.css';
import theme, { IColors } from '@renderer/styles/theme2';
import clsx from 'clsx';
import { Text } from '@renderer/components/Text';
import { CgClose } from 'react-icons/cg';

const Tab = ({
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
  ascentColor,
  allowClose,
  height,
  vertical,
  icon: Icon,
}: ITabProps) => {
  return (
    <div
      className={clsx(styles.tab, active && styles.active, vertical && styles.vertical)}
      id={id}
      style={{ '--ascentColor': theme[ascentColor], height } as React.CSSProperties}
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
        color={active ? ascentColor : undefined}
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
          <CgClose
            className={styles.ignoreTabDrag}
            color={active ? theme[ascentColor] : theme.white}
          />
          {/* CgClose */}
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
  ascentColor: keyof IColors;
}

export type TabComponent = (props: ITabProps) => JSX.Element;
