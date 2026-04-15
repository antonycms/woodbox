import React from 'react';
import { Button } from '@renderer/components/Button';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

export interface IContextMenuOption<ActiveContextInfo = any> {
  text: string;
  onClick?(activeContextInfo?: ActiveContextInfo): void;
}

export interface IContextMenuPosition {
  x: number;
  y: number;
}

export interface IContextMenuProps<ActiveContextInfo = any> {
  activeContextInfo?: ActiveContextInfo;
  options: IContextMenuOption<ActiveContextInfo>[];
  position?: IContextMenuPosition;
  onClose?(): void;
}

export function ContextMenu<ActiveContextInfo = any>(props: IContextMenuProps<ActiveContextInfo>) {
  const {
    activeTheme: { contextMenu: theme },
  } = useThemeContext();
  const { position, onClose, options, activeContextInfo } = props;
  const { x: positionX, y: positionY } = position || {};

  const isInvalidPosition = typeof positionX !== 'number' || typeof positionY !== 'number';

  React.useEffect(() => {
    if (isInvalidPosition) return;

    const clickCallback = () => onClose?.();

    window.addEventListener('click', clickCallback);

    return () => {
      window.removeEventListener('click', clickCallback);
    };
  }, [position]);

  if (isInvalidPosition) return null;

  return (
    <div
      className={styles.container}
      style={{ ...toCssProperties(theme), top: positionY, left: positionX }}
    >
      {options?.map?.(
        (option, index) =>
          !!option && (
            <Button
              text
              justifyContent="start"
              key={index}
              color={theme.color}
              onClick={() => option.onClick?.(activeContextInfo)}
            >
              {option.text}
            </Button>
          ),
      )}
    </div>
  );
}
