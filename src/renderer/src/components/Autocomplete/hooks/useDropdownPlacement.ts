import React from 'react';
import { getBoundaryRect } from '@renderer/utils/DOM';

export type DropdownPlacement = 'bottom' | 'top';

export interface IDropdownPlacement {
  placement: DropdownPlacement;
  maxHeight: number;
  boundaryTop: number;
  boundaryRight: number;
  boundaryBottom: number;
  boundaryLeft: number;
}

interface IUseDropdownPlacementParams {
  anchorRef: React.RefObject<HTMLElement | null>;
  dropdownHeight: number;
  isOpen: boolean;
  offset?: number;
  maxHeight?: number;
}

const VIEWPORT_MARGIN = 8;
const MIN_DROPDOWN_HEIGHT = 80;

const isSamePlacement = (
  currentPlacement: IDropdownPlacement | null,
  nextPlacement: IDropdownPlacement,
) => {
  return (
    currentPlacement?.placement === nextPlacement.placement &&
    currentPlacement.maxHeight === nextPlacement.maxHeight &&
    currentPlacement.boundaryTop === nextPlacement.boundaryTop &&
    currentPlacement.boundaryRight === nextPlacement.boundaryRight &&
    currentPlacement.boundaryBottom === nextPlacement.boundaryBottom &&
    currentPlacement.boundaryLeft === nextPlacement.boundaryLeft
  );
};

export function getDropdownPlacement(
  anchor: HTMLElement,
  dropdownHeight: number,
  offset = 8,
  maxHeight = 200,
): IDropdownPlacement {
  const rect = anchor.getBoundingClientRect();
  const boundaryRect = getBoundaryRect(rect.left, rect.bottom, anchor);
  const boundaryTop = Math.max(boundaryRect?.top ?? 0, VIEWPORT_MARGIN);
  const boundaryLeft = Math.max(boundaryRect?.left ?? 0, VIEWPORT_MARGIN);
  const boundaryRight = Math.min(
    boundaryRect?.right ?? window.innerWidth,
    window.innerWidth - VIEWPORT_MARGIN,
  );
  const boundaryBottom = Math.min(
    boundaryRect?.bottom ?? window.innerHeight,
    window.innerHeight - VIEWPORT_MARGIN,
  );
  const desiredHeight = Math.min(dropdownHeight, maxHeight);
  const availableBelow = boundaryBottom - rect.bottom - offset;
  const availableAbove = rect.top - boundaryTop - offset;
  const shouldOpenAbove = availableBelow < desiredHeight && availableAbove > availableBelow;
  const availableHeight = shouldOpenAbove ? availableAbove : availableBelow;
  const finalMaxHeight = Math.max(
    MIN_DROPDOWN_HEIGHT,
    Math.min(maxHeight, Math.max(0, availableHeight)),
  );

  return {
    placement: shouldOpenAbove ? 'top' : 'bottom',
    maxHeight: finalMaxHeight,
    boundaryTop,
    boundaryRight,
    boundaryBottom,
    boundaryLeft,
  };
}

export function useDropdownPlacement({
  anchorRef,
  dropdownHeight,
  isOpen,
  offset,
  maxHeight,
}: IUseDropdownPlacementParams) {
  const [placement, setPlacement] = React.useState<IDropdownPlacement | null>(null);

  React.useLayoutEffect(() => {
    if (!isOpen) {
      setPlacement(null);
      return;
    }

    let animationFrameId: number;

    const updatePlacement = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const nextPlacement = getDropdownPlacement(anchor, dropdownHeight, offset, maxHeight);

      setPlacement((currentPlacement) =>
        isSamePlacement(currentPlacement, nextPlacement) ? currentPlacement : nextPlacement,
      );
    };

    const requestPlacementUpdate = () => {
      animationFrameId = window.requestAnimationFrame(() => {
        updatePlacement();
        requestPlacementUpdate();
      });
    };

    updatePlacement();
    requestPlacementUpdate();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [anchorRef, dropdownHeight, isOpen, maxHeight, offset]);

  return placement;
}
