import React from 'react';
import { Button } from '@renderer/components/Button';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes, toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';
import { getBoundaryRect } from '@renderer/utils/DOM';

export interface IContextMenuOption<ActiveContextInfo = any> {
  text: string;
  onClick?(activeContextInfo?: ActiveContextInfo): void;
  children?: IContextMenuOption<ActiveContextInfo>[];
  show?(activeContextInfo?: ActiveContextInfo): boolean;
}

export interface IContextMenuPosition {
  x: number;
  y: number;
}

export type ContextMenuPlacement = 'bottom' | 'top';

export interface IContextMenuProps<ActiveContextInfo = any> {
  activeContextInfo?: ActiveContextInfo;
  options: IContextMenuOption<ActiveContextInfo>[];
  position?: IContextMenuPosition;
  placement?: ContextMenuPlacement;
  onClose?(): void;
}

export function ContextMenu<ActiveContextInfo = any>(props: IContextMenuProps<ActiveContextInfo>) {
  const {
    activeTheme: { contextMenu: theme },
  } = useThemeContext();
  const { position, placement = 'bottom', onClose, options, activeContextInfo } = props;
  const { x: positionX, y: positionY } = position || {};

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = React.useState<{
    style: React.CSSProperties;
    openSubmenusToLeft: boolean;
  }>();

  const isInvalidPosition = typeof positionX !== 'number' || typeof positionY !== 'number';

  React.useEffect(() => {
    if (isInvalidPosition) return;

    const clickCallback = () => onClose?.();

    window.addEventListener('click', clickCallback);

    return () => {
      window.removeEventListener('click', clickCallback);
    };
  }, [isInvalidPosition, onClose]);

  const updateMenuPosition = React.useCallback(() => {
    if (isInvalidPosition) return;

    const container = containerRef.current;
    if (!container) return;

    const VIEWPORT_MARGIN = 8;
    const SUBMENU_MIN_WIDTH = 160;

    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const boundaryRect = getBoundaryRect(positionX, positionY, container);
    const boundaryLeft = Math.max(boundaryRect?.left ?? 0, VIEWPORT_MARGIN);
    const boundaryTop = Math.max(boundaryRect?.top ?? 0, VIEWPORT_MARGIN);
    const boundaryRight = Math.min(
      boundaryRect?.right ?? window.innerWidth,
      window.innerWidth - VIEWPORT_MARGIN,
    );
    const boundaryBottom = Math.min(
      boundaryRect?.bottom ?? window.innerHeight,
      window.innerHeight - VIEWPORT_MARGIN,
    );

    const shouldOpenUp =
      placement === 'top'
        ? positionY - height >= boundaryTop || positionY + height > boundaryBottom
        : positionY + height > boundaryBottom && positionY - height >= boundaryTop;

    const rawTop = shouldOpenUp ? positionY - height : positionY;
    const rawLeft =
      positionX + width > boundaryRight && positionX - width >= boundaryLeft
        ? positionX - width
        : positionX;

    const top = Math.min(
      Math.max(rawTop, boundaryTop),
      Math.max(boundaryTop, boundaryBottom - height),
    );
    const left = Math.min(
      Math.max(rawLeft, boundaryLeft),
      Math.max(boundaryLeft, boundaryRight - width),
    );
    const openSubmenusToLeft =
      left + width + SUBMENU_MIN_WIDTH > boundaryRight && left - SUBMENU_MIN_WIDTH >= boundaryLeft;

    setMenuPosition((currentPosition) => {
      if (
        currentPosition?.style.top === top &&
        currentPosition.style.left === left &&
        currentPosition.openSubmenusToLeft === openSubmenusToLeft
      ) {
        return currentPosition;
      }

      return { style: { top, left }, openSubmenusToLeft };
    });
  }, [isInvalidPosition, placement, positionX, positionY]);

  React.useLayoutEffect(() => {
    updateMenuPosition();
  }, [updateMenuPosition, options, activeContextInfo]);

  React.useEffect(() => {
    if (isInvalidPosition) return;

    window.addEventListener('resize', updateMenuPosition);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isInvalidPosition, updateMenuPosition]);

  if (isInvalidPosition) return null;

  const fallbackPositionStyle = { top: positionY, left: positionX };

  const renderOption = (option: IContextMenuOption<ActiveContextInfo>, index: number) => {
    const children = option.children?.filter((childOption) =>
      childOption.show ? childOption.show(activeContextInfo) : true,
    );
    const hasChildren = !!children?.length;

    if (option.show && !option.show(activeContextInfo)) return null;
    if (option.children?.length && !hasChildren) return null;

    return (
      <div className={styles.option} key={index}>
        <Button
          text
          justifyContent="start"
          color={theme.color}
          onClick={() => {
            if (hasChildren) return;

            option.onClick?.(activeContextInfo);
          }}
        >
          <span className={styles.optionContent}>
            <span>{option.text}</span>
            {hasChildren && <span className={styles.submenuArrow}>›</span>}
          </span>
        </Button>

        {hasChildren && (
          <div className={styles.submenu}>
            {children.map((childOption, childIndex) => renderOption(childOption, childIndex))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={classes(styles.container, menuPosition?.openSubmenusToLeft && styles.openLeft)}
      style={{
        ...toCssProperties(theme),
        ...fallbackPositionStyle,
        ...menuPosition?.style,
        visibility: menuPosition ? 'visible' : 'hidden',
      }}
    >
      {options?.map?.((option, index) => !!option && renderOption(option, index))}
    </div>
  );
}
