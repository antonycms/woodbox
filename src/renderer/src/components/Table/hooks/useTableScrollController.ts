import React from 'react';
import useDebounce from '@renderer/hooks/useDebounce';
import type { TableScrollState } from '../dtos';

interface UseTableScrollControllerParams {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onScrollEnd?: () => void;
}

export const useTableScrollController = ({
  scrollContainerRef,
  onScrollEnd,
}: UseTableScrollControllerParams) => {
  const [scroll, setScroll] = React.useState<TableScrollState>({ left: 0, top: 0 });
  const setScrollDebounced = useDebounce<React.Dispatch<React.SetStateAction<TableScrollState>>>(
    setScroll,
    20,
  );
  const defaultScrollRef = React.useRef<TableScrollState>({ left: 0, top: 0 });

  const checkScrollEnd = React.useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element || !onScrollEnd) return;

    const hasVerticalScroll = element.scrollHeight > element.clientHeight;
    if (!hasVerticalScroll) return;

    const threshold = 8;
    const isEndVerticalScroll =
      Math.ceil(element.clientHeight + element.scrollTop) >= element.scrollHeight - threshold;

    if (isEndVerticalScroll) {
      onScrollEnd();
    }
  }, [onScrollEnd, scrollContainerRef]);

  const captureDefaultScroll = React.useCallback(() => {
    const element = scrollContainerRef.current;
    const nextScroll = element
      ? { left: element.scrollLeft, top: element.scrollTop }
      : defaultScrollRef.current;

    defaultScrollRef.current = nextScroll;
    setScroll(nextScroll);

    return nextScroll;
  }, [scrollContainerRef]);

  const restoreDefaultScroll = React.useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    const nextScroll = defaultScrollRef.current;
    element.scrollLeft = nextScroll.left;
    element.scrollTop = nextScroll.top;
    setScroll(nextScroll);
  }, [scrollContainerRef]);

  const onScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement, UIEvent>) => {
      const nextScroll = {
        left: event.currentTarget.scrollLeft,
        top: event.currentTarget.scrollTop,
      };

      defaultScrollRef.current = nextScroll;
      setScrollDebounced(nextScroll);

      if (nextScroll.top !== scroll.top) {
        checkScrollEnd();
      }
    },
    [checkScrollEnd, scroll.top, setScrollDebounced],
  );

  return {
    scroll,
    setScroll,
    defaultScrollRef,
    captureDefaultScroll,
    restoreDefaultScroll,
    onScroll,
  };
};
