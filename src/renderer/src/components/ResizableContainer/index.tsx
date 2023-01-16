import clsx from 'clsx';
import React from 'react';
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
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  direction?: 'horizontal' | 'vertical';
}

const ResizableContainer = ({
  width = 0,
  height = 0,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  onResize,
  children,
  onDoubleClick,
  title,
  className,
  style,
  direction = 'horizontal',
}: IResizableDivProps) => {
  const refContentDiv = React.useRef<HTMLDivElement>();

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
    const { right } = currentTarget.getBoundingClientRect();
    const offset = right - event.clientX;

    function onPointerMove(event: PointerEvent) {
      const { left } = currentTarget.getBoundingClientRect();
      const width = refContentDiv.current.offsetWidth + event.clientX + offset - left;

      if (width > 0) {
        onResize({ width: clampSize(width, minWidth, maxWidth) });
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
      className={clsx(styles.container, className, direction === 'vertical' && styles.vertical)}
      style={style}
    >
      {direction === 'vertical' && (
        <div
          draggable="false"
          className={clsx(styles.resizeBar, styles.vertical)}
          onDoubleClick={onDoubleClick}
          onPointerDown={handleResizeVertical}
        />
      )}

      <div
        draggable="false"
        className={clsx(styles.content, direction === 'vertical' && styles.vertical)}
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
          className={clsx(styles.resizeBar, styles.horizontal)}
          onDoubleClick={onDoubleClick}
          onPointerDown={handleResizeHorizontal}
        />
      )}
    </div>
  );
};

export default ResizableContainer;
