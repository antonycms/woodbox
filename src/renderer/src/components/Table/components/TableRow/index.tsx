import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from '../../styles.module.css';

interface ITableRowProps {
  isSelected?: boolean;
  isHeader?: boolean;
  onClick?(row, isSelected: boolean): void;
  children: React.ReactNode;
  row?: any;
}

const TableRow = ({ children, isSelected, isHeader, onClick, row }: ITableRowProps) => {
  const handleClick = React.useCallback(() => {
    if (!onClick) return;
    onClick?.(row, isSelected);
  }, [onClick, row, isSelected]);

  return (
    <div
      className={classes(
        styles.table_row,
        isSelected && styles.selected,
        isHeader && styles.header,
      )}
      onClick={handleClick}
    >
      {children}
    </div>
  );
};

export default React.memo(TableRow);
