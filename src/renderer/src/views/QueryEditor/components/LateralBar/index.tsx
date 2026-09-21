import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { useI18nStore } from '@renderer/stores/I18n';
import {
  ExplainIcon,
  IconFileWrited,
  ListIcon,
  RunFileIcon,
  RunIcon,
  RunSelectionIcon,
} from '@renderer/styles/icons';
import { useThemeStore } from '@renderer/stores/Theme';
import { getPrimaryShortcutKeyLabel } from '@renderer/utils/keyboard';
import styles from './styles.module.css';

interface ILateralBarProps {
  runCurrentSQL(openNewTab?: boolean): void;
  runSelectionsSQL(): void;
  runAllSQL(): void;
  explainCurrentSQL(): void;
  showServerOutput(): void;
  openProcessList?(): void;
  hasUnreadServerOutput?: boolean;
}

export const LateralBar = (props: ILateralBarProps) => {
  const t = useI18nStore((state) => state.t);
  const activeTheme = useThemeStore((state) => state.activeTheme);
  const shortcutKey = getPrimaryShortcutKeyLabel();

  const {
    runAllSQL,
    runSelectionsSQL,
    runCurrentSQL,
    explainCurrentSQL,
    showServerOutput,
    openProcessList,
    hasUnreadServerOutput,
  } = props;

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
        title={t('query.explainSql', { shortcut: shortcutKey })}
        onClick={explainCurrentSQL}
        color={activeTheme.queryEditor.bar.color}
      >
        <ExplainIcon size={16} />
      </Button>

      {!!openProcessList && (
        <Button
          text
          smallIcon
          title={t('context.openProcessList')}
          onClick={openProcessList}
          color={activeTheme.queryEditor.bar.color}
        >
          <ListIcon size={16} />
        </Button>
      )}

      <Button
        text
        smallIcon
        title={t('tooltip.serverOutput')}
        onClick={showServerOutput}
        color={activeTheme.queryEditor.bar.color}
      >
        <span
          className={styles.outputIconWrapper}
          style={
            {
              '--server-output-badge-color': activeTheme.queryEditor.bar.color,
            } as React.CSSProperties
          }
        >
          <IconFileWrited size={16} />
          {!!hasUnreadServerOutput && <span className={styles.outputBadge} />}
        </span>
      </Button>
    </Bar>
  );
};
