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

    let animationFrameId: number;

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
      animationFrameId = window.requestAnimationFrame(() => {
        updatePosition();
        requestPositionUpdate();
      });
    };

    updatePosition();
    requestPositionUpdate();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, dropdownHeight, isOpen, maxHeight, offset]);

  return position;
}
