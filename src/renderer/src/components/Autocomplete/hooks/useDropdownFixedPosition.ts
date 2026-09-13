import React from 'react';
import { getDropdownPlacement } from '@renderer/components/Autocomplete/hooks/useDropdownPlacement';

interface IUseDropdownFixedPositionParams {
  anchorRef: React.RefObject<HTMLElement | null>;
  dropdownHeight: number;
  isOpen: boolean;
  offset?: number;
  maxHeight?: number;
}

const isSamePosition = (
  currentPosition: React.CSSProperties | null,
  nextPosition: React.CSSProperties,
) => {
  return (
    currentPosition?.left === nextPosition.left &&
    currentPosition.top === nextPosition.top &&
    currentPosition.width === nextPosition.width &&
    currentPosition.maxHeight === nextPosition.maxHeight
  );
};

export function useDropdownFixedPosition({
  anchorRef,
  dropdownHeight,
  isOpen,
  offset = 8,
  maxHeight = 200,
}: IUseDropdownFixedPositionParams) {
  const [position, setPosition] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    let animationFrameId: number | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const dropdownPlacement = getDropdownPlacement(anchor, dropdownHeight, offset, maxHeight);
      const visualHeight = Math.min(dropdownHeight, dropdownPlacement.maxHeight);
      const width = Math.min(
        rect.width,
        dropdownPlacement.boundaryRight - dropdownPlacement.boundaryLeft,
      );
      const left = Math.min(
        Math.max(rect.left, dropdownPlacement.boundaryLeft),
        Math.max(dropdownPlacement.boundaryLeft, dropdownPlacement.boundaryRight - width),
      );
      const top =
        dropdownPlacement.placement === 'top'
          ? Math.max(dropdownPlacement.boundaryTop, rect.top - offset - visualHeight)
          : Math.min(
              rect.bottom + offset,
              Math.max(
                dropdownPlacement.boundaryTop,
                dropdownPlacement.boundaryBottom - visualHeight,
              ),
            );

      const nextPosition: React.CSSProperties = {
        left,
        top,
        width,
        maxHeight: dropdownPlacement.maxHeight,
      };

      setPosition((currentPosition) =>
        isSamePosition(currentPosition, nextPosition) ? currentPosition : nextPosition,
      );
    };

    const requestPositionUpdate = () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    requestPositionUpdate();
    window.addEventListener('resize', requestPositionUpdate);
    window.addEventListener('scroll', requestPositionUpdate, true);

    if (window.ResizeObserver && anchorRef.current) {
      resizeObserver = new ResizeObserver(requestPositionUpdate);
      resizeObserver.observe(anchorRef.current);
    }

    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', requestPositionUpdate);
      window.removeEventListener('scroll', requestPositionUpdate, true);
    };
  }, [anchorRef, dropdownHeight, isOpen, maxHeight, offset]);

  return position;
}
