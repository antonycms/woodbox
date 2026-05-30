import React from 'react';
import { Button } from '@renderer/components/Button';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

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
      className={styles.container}
      style={{ ...toCssProperties(theme), top: positionY, left: positionX }}
    >
      {options?.map?.((option, index) => !!option && renderOption(option, index))}
    </div>
  );
}
