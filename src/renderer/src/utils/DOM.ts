export function getBoundaryRect(positionX: number, positionY: number, element?: HTMLElement | null) {
  const MIN_BOUNDARY_WIDTH = 180;
  const MIN_BOUNDARY_HEIGHT = 80;

  const elements = document.elementsFromPoint(positionX, positionY);
  const targetElement = elements.find((el) => !element?.contains(el));
  const hiddenBoundaries: DOMRect[] = [];

  let parentElement = targetElement?.parentElement;

  while (parentElement && parentElement !== document.body) {
    const style = window.getComputedStyle(parentElement);
    const overflowValues = [style.overflow, style.overflowX, style.overflowY];
    const boundaryRect = parentElement.getBoundingClientRect();
    const canBeBoundary =
      boundaryRect.width >= MIN_BOUNDARY_WIDTH && boundaryRect.height >= MIN_BOUNDARY_HEIGHT;

    if (canBeBoundary && overflowValues.some((value) => value === 'auto' || value === 'scroll')) {
      return boundaryRect;
    }

    if (canBeBoundary && overflowValues.some((value) => value === 'hidden' || value === 'clip')) {
      hiddenBoundaries.push(boundaryRect);
    }

    parentElement = parentElement.parentElement;
  }

  return hiddenBoundaries[0];
}
