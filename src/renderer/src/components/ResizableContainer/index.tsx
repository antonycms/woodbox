import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

export type OnResizeCallback = (size: { width?: number; height?: number }) => void;

export interface IResizableDivProps {
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  children?: React.ReactNode;
  onResize?: OnResizeCallback;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  direction?: 'horizontal' | 'vertical';
  horizontalResizeSide?: 'left' | 'right';
}

const ResizableContainer = ({
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  width = minWidth,
  height = minHeight,
  onResize,
  children,
  onClick,
  onDoubleClick,
  title,
  className,
  style,
  direction = 'horizontal',
  horizontalResizeSide = 'right',
}: IResizableDivProps) => {
  const refContentDiv = React.useRef<HTMLDivElement>(null);

  function clampSize(width: number, min: number, max: number): number {
    if (width > max) return max;
    if (width < min) return min;

    return width;
  }

  function handleResizeHorizontal(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.buttons !== 1) {
      return;
    }

    const { currentTarget, pointerId } = event;
    const startX = event.clientX;
    const startWidth = width || currentTarget.parentElement?.getBoundingClientRect().width || 0;

    function onPointerMove(event: PointerEvent) {
      const width =
        horizontalResizeSide === 'left'
          ? startWidth + startX - event.clientX
          : startWidth + event.clientX - startX;

      if (width > 0) {
        onResize?.({ width: clampSize(width, minWidth, maxWidth) });
      }
    }

    function onLostPointerCapture() {
      currentTarget.removeEventListener('pointermove', onPointerMove);
      currentTarget.removeEventListener('lostpointercapture', onLostPointerCapture);
    }

    currentTarget.setPointerCapture(pointerId);
    currentTarget.addEventListener('pointermove', onPointerMove);
    currentTarget.addEventListener('lostpointercapture', onLostPointerCapture);
  }

  function handleResizeVertical(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.buttons !== 1) {
      return;
    }

    const { currentTarget, pointerId } = event;
    const { top } = currentTarget.getBoundingClientRect();
    const offset = top - event.clientY;

    function onPointerMove(event: PointerEvent) {
      const { bottom } = currentTarget.getBoundingClientRect();
      const height = refContentDiv.current.offsetHeight - event.clientY + bottom - offset;

      if (height > 0) {
        onResize({ height: clampSize(height, minHeight, maxHeight) });
      }
    }

    function onLostPointerCapture() {
      currentTarget.removeEventListener('pointermove', onPointerMove);
      currentTarget.removeEventListener('lostpointercapture', onLostPointerCapture);
    }

    currentTarget.setPointerCapture(pointerId);
    currentTarget.addEventListener('pointermove', onPointerMove);
    currentTarget.addEventListener('lostpointercapture', onLostPointerCapture);
  }

  return (
    <div
      draggable="false"
      title={title}
      className={classes(styles.container, className, direction === 'vertical' && styles.vertical)}
      style={style}
      onClick={onClick}
    >
      {direction === 'vertical' && (
        <div
          draggable="false"
          className={classes(styles.resizeBar, styles.vertical)}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={onDoubleClick}
          onPointerDown={handleResizeVertical}
        />
      )}

      <div
        draggable="false"
        className={classes(styles.content, direction === 'vertical' && styles.vertical)}
        ref={refContentDiv}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
        }}
      >
        {children}
      </div>

      {direction === 'horizontal' && (
        <div
          draggable="false"
          className={classes(
            styles.resizeBar,
            styles.horizontal,
            horizontalResizeSide === 'left' && styles.left,
          )}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={onDoubleClick}
          onPointerDown={handleResizeHorizontal}
        />
      )}
    </div>
  );
};

export default ResizableContainer;
