import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { IconFileWrited, RunFileIcon, RunIcon, RunSelectionIcon } from '@renderer/styles/icons';
import { useThemeContext } from '@renderer/contexts/Theme';

interface ILateralBarProps {
  runCurrentSQL(openNewTab?: boolean): void;
  runSelectionsSQL(): void;
  runAllSQL(): void;
}

export const LateralBar = (props: ILateralBarProps) => {
  const { activeTheme } = useThemeContext();

  const { runAllSQL, runSelectionsSQL, runCurrentSQL } = props;

  return (
    <Bar
      vertical
      backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
      borderColor={activeTheme.queryEditor.bar.borderColor}
    >
      <Button
        text
        smallIcon
        title="Executar script SQL (Ctrl + Shift + Alt + Enter)"
        onClick={runAllSQL}
        color={activeTheme.queryEditor.bar.color}
      >
        <RunFileIcon size={16} />
      </Button>

      <Button
        text
        smallIcon
        title="Executar SQL selecionado (Ctrl + Alt + Enter)"
        onClick={runSelectionsSQL}
        color={activeTheme.queryEditor.bar.color}
      >
        <RunSelectionIcon size={20} />
      </Button>

      <Button
        text
        smallIcon
        title="Executar SQL atual (Ctrl + Shift + Enter)"
        onClick={() => runCurrentSQL(true)}
        color={activeTheme.queryEditor.bar.color}
      >
        <RunIcon size={16} />
      </Button>

      <Button
        text
        smallIcon
        title="Mostrar saída do servidor"
        color={activeTheme.queryEditor.bar.color}
      >
        <IconFileWrited size={16} />
      </Button>
    </Bar>
  );
};
