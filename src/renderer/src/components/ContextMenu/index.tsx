import React from 'react';
import { Button } from '@renderer/components/Button';
import styles from './styles.module.css';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toCssProperties } from '@renderer/styles/theme';

export interface IContextMenuOption {
  text: string;
  onClick?(): void;
}

export interface IContextMenuPosition {
  x: number;
  y: number;
}

export interface IContextMenuProps {
  options: IContextMenuOption[];
  position?: IContextMenuPosition;
  onClose?(): void;
}

export const ContextMenu = (props: IContextMenuProps) => {
  const { activeTheme } = useThemeContext();
  const { position, onClose, options } = props;
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
      style={{ ...toCssProperties(activeTheme.contextMenu), top: positionY, left: positionX }}
    >
      {options?.map?.((option, index) => (
        <Button text key={index} onClick={() => option.onClick?.()} alignContent="start">
          {option.text}
        </Button>
      ))}
    </div>
  );
};
