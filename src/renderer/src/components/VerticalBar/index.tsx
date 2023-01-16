import clsx from 'clsx';
import React from 'react';
import styles from './styles.module.css';

export const VerticalBar = ({ onChange, value, items }: IVerticalBarProps) => {
  return (
    <div className={styles.categoryBar}>
      {items.map((item) => (
        <div
          key={item.id}
          title={item.title}
          onClick={() => onChange?.(item.id)}
          className={clsx(styles.categoryBarButton, item.id === value && styles.active)}
        >
          <item.icon />
        </div>
      ))}
    </div>
  );
};

export interface IItemBar {
  id: string;
  title?: string;
  icon(): JSX.Element;
}

export interface IVerticalBarProps {
  /**
   * @default true
   */
  automaticSelectFirst?: boolean;
  items: IItemBar[];
  value: string;
  onChange?: (idItem: string) => void;
}
