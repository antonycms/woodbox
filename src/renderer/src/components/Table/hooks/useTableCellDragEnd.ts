import React from 'react';
import styles from '../styles.module.css';
import type { TableDragSelectionState, TableMutableRef } from '../dtos';

interface UseTableCellDragEndParams {
  dragSelectionRef: TableMutableRef<TableDragSelectionState | null>;
  ignoreNextClickRef: TableMutableRef<boolean>;
}

export const useTableCellDragEnd = ({
  dragSelectionRef,
  ignoreNextClickRef,
}: UseTableCellDragEndParams) => {
  const handleEndCellDrag = React.useCallback(
    (event?: MouseEvent) => {
      const targetElement = event?.target instanceof HTMLElement ? event.target : null;
      const endedOverCell = !!targetElement?.closest(
        `.${styles.table_column}, .${styles.analysis_value}`,
      );

      if (dragSelectionRef.current?.hasMoved && endedOverCell) {
        ignoreNextClickRef.current = true;
      }

      dragSelectionRef.current = null;
    },
    [dragSelectionRef, ignoreNextClickRef],
  );

  React.useEffect(() => {
    window.addEventListener('mouseup', handleEndCellDrag);

    return () => {
      window.removeEventListener('mouseup', handleEndCellDrag);
    };
  }, [handleEndCellDrag]);
};
