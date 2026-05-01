import React from 'react';
import styles from './styles.module.css';
import { toCssProperties } from '@renderer/styles/theme';

const calculateSizeCol = (size: number) => {
  if (!size) return;

  const sizePercentage = (100 / 12) * size;
  return `calc(${sizePercentage}% - 8px)`;
};

export const Column = React.memo((props: IColumnProps) => {
  const { children, ...gridProps } = props;
  const { xs, sm, md, lg, xl } = gridProps;

  const gridIsActive = !!(xs || sm || md || lg || xl);

  const widths = React.useMemo(() => {
    const xlWidth = calculateSizeCol(xl || lg || md || sm || xs);
    const lgWidth = calculateSizeCol(lg || xl || md || sm || xs);
    const mdWidth = calculateSizeCol(md || lg || xl || sm || xs);
    const smWidth = calculateSizeCol(sm || md || lg || xl || xs);
    const xsWidth = calculateSizeCol(xs || sm || md || lg || xl);

    return toCssProperties({ xlWidth, lgWidth, mdWidth, smWidth, xsWidth });
  }, [xs, sm, md, lg, xl]);

  if (!gridIsActive) return <>{children}</>;

  return (
    <div className={styles.column} style={widths}>
      {children}
    </div>
  );
});

Column.displayName = 'Column';

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
