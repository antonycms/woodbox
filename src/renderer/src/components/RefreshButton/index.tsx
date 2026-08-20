import React from 'react';
import { Button } from '@renderer/components/Button';
import {
  ContextMenu,
  type ContextMenuPlacement,
  type IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useLatestFunc } from '@renderer/hooks/useLatestFunc';
import { IconRefresh } from '@renderer/styles/icons';

const AUTO_REFRESH_OPTIONS = [
  { label: '1s', value: 1000 },
  { label: '5s', value: 5000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
  { label: 'Nenhum', value: null },
];

interface IRefreshButtonProps {
  color?: string;
  disabled?: boolean;
  title?: string;
  menuPlacement?: ContextMenuPlacement;
  onRefresh(): void | Promise<void>;
}

export const RefreshButton = ({
  color,
  disabled,
  title = 'Atualizar dados',
  menuPlacement,
  onRefresh,
}: IRefreshButtonProps) => {
  const { activeTheme } = useThemeContext();
  const [menuPosition, setMenuPosition] = React.useState<IContextMenuPosition>();
  const [autoRefreshMs, setAutoRefreshMs] = React.useState<number | null>(null);
  const refreshingRef = React.useRef(false);
  const latestRefresh = useLatestFunc(onRefresh);

  const selectedOption = React.useMemo(
    () => AUTO_REFRESH_OPTIONS.find((option) => option.value === autoRefreshMs),
    [autoRefreshMs],
  );

  const refreshTitle = autoRefreshMs ? `Cancelar auto-refresh (${selectedOption?.label})` : title;
  const buttonColor = autoRefreshMs ? activeTheme.button.activeColor : color;
  const buttonDisabled = disabled && !autoRefreshMs;

  const runRefresh = React.useCallback(async () => {
    if (disabled || refreshingRef.current) return;

    refreshingRef.current = true;

    try {
      await latestRefresh();
    } finally {
      refreshingRef.current = false;
    }
  }, [disabled, latestRefresh]);

  const handleClick = React.useCallback(async () => {
    if (autoRefreshMs) {
      setAutoRefreshMs(null);
      return;
    }

    await runRefresh();
  }, [autoRefreshMs, runRefresh]);

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (buttonDisabled) return;

      setMenuPosition({ x: event.clientX, y: event.clientY });
    },
    [buttonDisabled],
  );

  React.useEffect(() => {
    if (!autoRefreshMs || disabled) return;

    const interval = window.setInterval(runRefresh, autoRefreshMs);

    return () => window.clearInterval(interval);
  }, [autoRefreshMs, disabled, runRefresh]);

  return (
    <>
      <span style={{ display: 'inline-flex' }} onContextMenu={handleContextMenu}>
        <Button
          title={refreshTitle}
          text
          smallIcon
          color={buttonColor}
          disabled={buttonDisabled}
          onClick={handleClick}
        >
          <IconRefresh size={18} />
        </Button>
      </span>

      <ContextMenu
        position={menuPosition}
        placement={menuPlacement}
        onClose={() => setMenuPosition(undefined)}
        options={AUTO_REFRESH_OPTIONS.map((option) => ({
          text: `${option.value === autoRefreshMs ? '✓ ' : ''}${option.label}`,
          onClick: () => setAutoRefreshMs(option.value),
        }))}
      />
    </>
  );
};
