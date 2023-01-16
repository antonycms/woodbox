import React from 'react';
import styles from './styles.module.css';

const calculateSizeCol = (size: number) => {
  const sizePercentage = (100 / 12) * size;
  return `calc(${sizePercentage}% - 8px)`;
};

export const Column = ({ children, ...gridProps }: IColumnProps) => {
  const { xs, sm, md, lg, xl } = gridProps;
  const gridIsActive = React.useMemo(() => xs || sm || md || lg || xl, [xs, sm, md, lg, xl]);

  if (!gridIsActive) return <>{children}</>;

  const widths = React.useMemo(() => {
    const xlWidth = calculateSizeCol(xl || lg || md || sm || xs);
    const lgWidth = calculateSizeCol(lg || xl || md || sm || xs);
    const mdWidth = calculateSizeCol(md || lg || xl || sm || xs);
    const smWidth = calculateSizeCol(sm || md || lg || xl || xs);
    const xsWidth = calculateSizeCol(xs || sm || md || lg || xl);

    return {
      '--xlWidth': xlWidth,
      '--lgWidth': lgWidth,
      '--mdWidth': mdWidth,
      '--smWidth': smWidth,
      '--xsWidth': xsWidth,
    } as React.CSSProperties;
  }, [xs, sm, md, lg, xl]);

  return (
    <div className={styles.column} style={widths}>
      {children}
    </div>
  );
};

export interface IGridSystem {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface IColumnProps extends IGridSystem {
  children?: React.ReactNode;
}
