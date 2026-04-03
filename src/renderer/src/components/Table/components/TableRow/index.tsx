import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from '../../styles.module.css';

interface ITableRowProps {
  isSelected?: boolean;
  isHeader?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

const TableRow = ({ isSelected, isHeader, onClick, children }: ITableRowProps) => {
  return (
    <div
      className={classes(
        styles.table_row,
        isSelected && styles.selected,
        isHeader && styles.header,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default React.memo(TableRow);
