import React from 'react';
import type { TableCellPosition, TableMutableRef, TableSearchState } from '../dtos';

interface UseTableSearchEffectsParams {
  activeIndex: number;
  activeOccurrence?: TableCellPosition;
  heightBodyContainer: number;
  occurrencesLength: number;
  open: boolean;
  searchCloseTimeoutRef: TableMutableRef<number | undefined>;
  widthBodyContainer: number;
  scrollCellIntoView(rowIndex: number, colIndex: number): void;
  setSearchState: React.Dispatch<React.SetStateAction<TableSearchState>>;
  updateSearchOverlayPosition(): void;
}

export const useTableSearchEffects = ({
  activeIndex,
  activeOccurrence,
  heightBodyContainer,
  occurrencesLength,
  open,
  searchCloseTimeoutRef,
  widthBodyContainer,
  scrollCellIntoView,
  setSearchState,
  updateSearchOverlayPosition,
}: UseTableSearchEffectsParams) => {
  React.useEffect(() => {
    const nextActiveIndex = occurrencesLength ? Math.min(activeIndex, occurrencesLength - 1) : 0;

    if (nextActiveIndex === activeIndex) return;

    setSearchState((prevState) => ({ ...prevState, activeIndex: nextActiveIndex }));
  }, [activeIndex, occurrencesLength, setSearchState]);

  React.useEffect(() => {
    if (!open) return;

    updateSearchOverlayPosition();
    window.addEventListener('resize', updateSearchOverlayPosition);

    return () => {
      window.removeEventListener('resize', updateSearchOverlayPosition);
    };
  }, [heightBodyContainer, open, updateSearchOverlayPosition, widthBodyContainer]);

  React.useEffect(() => {
    if (!open || !activeOccurrence) return;

    scrollCellIntoView(activeOccurrence.rowIndex, activeOccurrence.colIndex);
  }, [activeOccurrence, open, scrollCellIntoView]);

  React.useEffect(() => {
    return () => {
      if (searchCloseTimeoutRef.current) {
        window.clearTimeout(searchCloseTimeoutRef.current);
      }
    };
  }, [searchCloseTimeoutRef]);
};
