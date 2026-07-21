import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { useI18n } from '@renderer/contexts/I18n';
import { IconFileWrited, RunFileIcon, RunIcon, RunSelectionIcon } from '@renderer/styles/icons';
import { useThemeContext } from '@renderer/contexts/Theme';
import { getPrimaryShortcutKeyLabel } from '@renderer/utils/keyboard';

interface ILateralBarProps {
  runCurrentSQL(openNewTab?: boolean): void;
  runSelectionsSQL(): void;
  runAllSQL(): void;
  showServerOutput(): void;
}

export const LateralBar = (props: ILateralBarProps) => {
  const { t } = useI18n();
  const { activeTheme } = useThemeContext();
  const shortcutKey = getPrimaryShortcutKeyLabel();

  const { runAllSQL, runSelectionsSQL, runCurrentSQL, showServerOutput } = props;

  return (
    <Bar
      vertical
      backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
      borderColor={activeTheme.queryEditor.bar.borderColor}
    >
      <Button
        text
        smallIcon
        title={t('query.runScriptSql', { shortcut: shortcutKey })}
        onClick={runAllSQL}
        color={activeTheme.queryEditor.bar.color}
      >
        <RunFileIcon size={16} />
      </Button>

      <Button
        text
        smallIcon
        title={t('query.runSelectedSql', { shortcut: shortcutKey })}
        onClick={runSelectionsSQL}
        color={activeTheme.queryEditor.bar.color}
      >
        <RunSelectionIcon size={20} />
      </Button>

      <Button
        text
        smallIcon
        title={t('query.runCurrentSql', { shortcut: shortcutKey })}
        onClick={() => runCurrentSQL(true)}
        color={activeTheme.queryEditor.bar.color}
      >
        <RunIcon size={16} />
      </Button>

      <Button
        text
        smallIcon
        title={t('tooltip.serverOutput')}
        onClick={showServerOutput}
        color={activeTheme.queryEditor.bar.color}
      >
        <IconFileWrited size={16} />
      </Button>
    </Bar>
  );
};
