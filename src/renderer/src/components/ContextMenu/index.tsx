import React from 'react';
import { Button } from '@renderer/components/Button';
import styles from './styles.module.css';

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

export const ContextMenu = ({ position, onClose, options }: IContextMenuProps) => {
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
    <div className={styles.container} style={{ top: positionY, left: positionX }}>
      {options?.map?.((option, index) => (
        <Button key={index} onClick={() => option.onClick?.()} alignContent="start" text>
          {option.text}
        </Button>
      ))}
    </div>
  );
};
