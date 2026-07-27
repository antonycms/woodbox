import React from 'react';
import styles from '../../styles.module.css';

interface ITableRowNumberProps {
  indexRow?: number;
  isHeader?: boolean;
}

const TableRowNumber = ({ indexRow, isHeader }: ITableRowNumberProps) => {
  const style = React.useMemo(() => {
    if (isHeader) return undefined;

    return { '--rowIndex': indexRow } as React.CSSProperties;
  }, [indexRow, isHeader]);

  return (
    <div className={styles.table_row_number} style={style}>
      {isHeader ? '#' : Number(indexRow) + 1}
    </div>
  );
};

export default React.memo(TableRowNumber);
