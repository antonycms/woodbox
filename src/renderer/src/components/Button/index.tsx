import React from 'react';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { SpinnerLoading } from '@renderer/components/Loaders';
import { useThemeStore } from '@renderer/stores/Theme';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

export const Button = React.memo((props: IButtonProps) => {
  const {
    children,
    title,
    justifyContent,
    backgroundColor,
    color,
    className,
    text,
    width,
    smallIcon,
    onClick,
    onDoubleClick,
    form,
    loading,
    disabled,
    onContextMenu,
    icon: Icon,
    type = 'button',
    ...gridProps
  } = props;
  const { button: theme } = useThemeStore((state) => state.activeTheme);

  const classesButton = classes(
    styles.button,
    className,
    text && styles.text,
    smallIcon && styles.smallIcon,
  );

  const isDisabled = !!(loading || disabled);

  const style = React.useMemo(() => {
    return {
      color,
      backgroundColor,
      width,
      justifyContent,
      '--button-hover-background-color': theme.hoverBackgroundColor,
    } as React.CSSProperties;
  }, [theme.hoverBackgroundColor, color, backgroundColor, width, justifyContent]);

  return (
    <Column {...gridProps}>
      <button
        onContextMenu={onContextMenu}
        title={title}
        type={type}
        onClick={onClick}
        form={form}
        disabled={isDisabled}
        onDoubleClick={onDoubleClick}
        style={style}
        className={classesButton}
      >
        {!loading && (
          <>
            {children}

            {!!Icon && (
              <>
                {!!children && <div className={styles.separatorButton} />}
                <Icon />
              </>
            )}
          </>
        )}

        {!!loading && <SpinnerLoading background="transparent" size={14} color={color} />}
      </button>
    </Column>
  );
});

Button.displayName = 'Button';

export interface IButtonProps extends IGridSystem {
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  icon?: () => React.ReactElement;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  className?: string;
  form?: string;
  disabled?: boolean;
  loading?: boolean;
  onContextMenu?: React.MouseEventHandler<HTMLButtonElement>

  text?: boolean;
  backgroundColor?: string;
  color?: string;
  smallIcon?: boolean;
  width?: string;
  justifyContent?: 'start' | 'center';
}
