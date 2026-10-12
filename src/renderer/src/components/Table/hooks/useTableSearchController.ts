import React from 'react';
import type { TableSearchOverlayPosition, TableSearchState } from '../dtos';

export const useTableSearchController = () => {
  const [searchClosing, setSearchClosing] = React.useState(false);
  const [searchState, setSearchState] = React.useState<TableSearchState>({
    open: false,
    replaceOpen: false,
    query: '',
    replace: '',
    matchCase: false,
    wholeWord: false,
    activeIndex: 0,
  });
  const [searchOverlayPosition, setSearchOverlayPosition] =
    React.useState<TableSearchOverlayPosition>({
      top: 8,
      right: 8,
    });
  const searchCloseTimeoutRef = React.useRef<number | undefined>(undefined);

  return {
    searchClosing,
    setSearchClosing,
    searchState,
    setSearchState,
    searchOverlayPosition,
    setSearchOverlayPosition,
    searchCloseTimeoutRef,
  };
};
