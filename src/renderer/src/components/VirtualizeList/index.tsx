import React from 'react';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';

interface IVirtualizeListProps {
  height?: number | string;
  minHeight?: number | string;
  width?: number | string;
  minWidth?: number | string;
  itemCount: number;
  itemSize: number | ((index: number) => number);
  direction?: 'vertical' | 'horizontal';
  style?: React.CSSProperties;
  refScrollElement?: React.RefObject<HTMLDivElement | null>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  onEndReached?: () => void;
  children: (props: { index: number }) => React.ReactNode;
  childrenStickySize?: number;
  childrenSticky?: React.ReactNode;
}

const emptyObject = Object.freeze({});

export const VirtualizeList = (props: IVirtualizeListProps) => {
  const {
    refScrollElement,
    minHeight,
    height,
    minWidth,
    width,
    itemCount,
    itemSize,
    onScroll,
    onEndReached,
    direction = 'vertical',
    style = emptyObject,
    childrenSticky,
    childrenStickySize = 0,
  } = props;

  const containerRef = React.useRef<HTMLDivElement>(null);

  const [scrollTop, setScrollTop] = useStateWithDebounce(0);
  const [containerSize, setContainerSize] = useStateWithDebounce(0);
  const viewScrollEnd = scrollTop + containerSize;

  const childrens = [];
  const stickyOffset = childrenSticky ? childrenStickySize : 0;
  let totalHeight = stickyOffset;
  let indexStart = -1;
  let indexEnd = -1;

  const renderChildren = (index: number, position: number) => {
    childrens.push(
      <div
        key={index}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform:
            direction === 'horizontal' ? `translateX(${position}px)` : `translateY(${position}px)`,
          willChange: 'transform',
          overflow: 'hidden',
          width: direction === 'vertical' ? '100%' : 'auto',
          height: direction === 'horizontal' ? '100%' : 'auto',
        }}
      >
        {props.children({ index })}
      </div>,
    );
  };

  if (typeof itemSize === 'number' && itemSize > 0) {
    totalHeight = stickyOffset + itemCount * itemSize;
    indexStart = Math.max(0, Math.floor((scrollTop - stickyOffset) / itemSize) - 1);
    indexEnd = Math.min(itemCount - 1, Math.ceil((viewScrollEnd - stickyOffset) / itemSize));

    for (let index = indexStart; index <= indexEnd; index++) {
      renderChildren(index, stickyOffset + index * itemSize);
    }
  } else {
    for (let index = 0; index < itemCount; index++) {
      const position = totalHeight;
      const size = itemSize instanceof Function ? itemSize(index) : itemSize;

      totalHeight += size;

      if (indexStart === -1 && totalHeight >= scrollTop) {
        const prevIndex = index - 1;
        indexStart = prevIndex >= 0 ? prevIndex : index;
      }

      if (indexStart !== -1 && totalHeight <= viewScrollEnd) {
        const nextIndex = index + 1;
        indexEnd = nextIndex >= itemCount ? index : nextIndex;
      }

      if (index >= indexStart && index <= indexEnd) {
        renderChildren(index, position);
      }
    }
  }

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
    onScroll?.(event);

    const isEnd =
      event.currentTarget.scrollTop + event.currentTarget.clientHeight >=
      event.currentTarget.scrollHeight - 1;

    if (isEnd) onEndReached?.();
  };

  React.useEffect(() => {
    if (!containerRef?.current) return;

    const observer = new ResizeObserver(([{ contentRect }]) =>
      setContainerSize(contentRect.height),
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{ minHeight, height, minWidth, width, display: 'flex', flex: 1, position: 'relative' }}
    >
      <div
        onScroll={handleScroll}
        style={{
          ...style,
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'auto',
        }}
        ref={(ref) => {
          if (containerRef) containerRef.current = ref;
          if (refScrollElement) (refScrollElement as any).current = ref;
        }}
      >
        <div style={{ position: 'relative', minHeight: totalHeight }}>
          {!!childrenSticky && (
            <div
              style={{
                zIndex: 1,
                position: 'sticky',
                left: 0,
                top: 0,
                willChange: 'transform',
                overflow: 'hidden',
                width: direction === 'vertical' ? '100%' : 'auto',
                height: direction === 'horizontal' ? '100%' : 'auto',
              }}
            >
              {childrenSticky}
            </div>
          )}
          {childrens}
        </div>
      </div>
    </div>
  );
};
