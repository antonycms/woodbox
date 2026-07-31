import React from 'react';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import ArrowDownIcon from '@renderer/assets/icons/arrow-down.svg?react';
import ChevronDownIcon from '@renderer/assets/icons/chevron-down-compact.svg?react';
import ChevronRightIcon from '@renderer/assets/icons/chevron-right-compact.svg?react';
import ArrowRightIcon from '@renderer/assets/icons/arrow-right.svg?react';
import ArrowUpIcon from '@renderer/assets/icons/arrow-up.svg?react';
import CaseSensitiveIcon from '@renderer/assets/icons/case-sensitive.svg?react';
import CloseIcon from '@renderer/assets/icons/close.svg?react';
import ReplaceIcon from '@renderer/assets/icons/replace.svg?react';
import ReplaceAllIcon from '@renderer/assets/icons/replace-all.svg?react';
import WholeWordIcon from '@renderer/assets/icons/whole-word.svg?react';
import styles from '../../styles.module.css';



interface ITableSearchBarProps {
  query: string;
  replace: string;
  replaceOpen: boolean;
  matchCase: boolean;
  wholeWord: boolean;
  activeIndex: number;
  total: number;
  canReplaceCurrent: boolean;
  canReplaceAll: boolean;
  onQueryChange(query: string): void;
  onReplaceChange(replace: string): void;
  onReplaceOpenChange(open: boolean): void;
  onToggleMatchCase(): void;
  onToggleWholeWord(): void;
  onReplaceCurrent(): void;
  onReplaceAll(): void;
  onNext(): void;
  onPrevious(): void;
  onClose(): void;
}

const TableSearchBar = ({
  query,
  replace,
  replaceOpen,
  matchCase,
  wholeWord,
  activeIndex,
  total,
  canReplaceCurrent,
  canReplaceAll,
  onQueryChange,
  onReplaceChange,
  onReplaceOpenChange,
  onToggleMatchCase,
  onToggleWholeWord,
  onReplaceCurrent,
  onReplaceAll,
  onNext,
  onPrevious,
  onClose,
}: ITableSearchBarProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const counter = total ? `${activeIndex + 1} de ${total}` : '0 de 0';
  const barClassName = replaceOpen
    ? `${styles.table_search_bar} ${styles.table_search_bar_expanded}`
    : styles.table_search_bar;
  const matchCaseClassName = matchCase
    ? `${styles.table_search_button} ${styles.table_search_toggle_active}`
    : styles.table_search_button;
  const wholeWordClassName = wholeWord
    ? `${styles.table_search_button} ${styles.table_search_toggle_active}`
    : styles.table_search_button;

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onQueryChange(event.target.value);
    },
    [onQueryChange],
  );

  const handleReplaceChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onReplaceChange(event.target.value);
    },
    [onReplaceChange],
  );

  const handleToggleReplace = React.useCallback(() => {
    onReplaceOpenChange(!replaceOpen);
  }, [onReplaceOpenChange, replaceOpen]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation();

      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        inputRef.current?.select();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        event.shiftKey ? onPrevious() : onNext();
      }
    },
    [onClose, onNext, onPrevious],
  );

  return (
    <div className={barClassName} onKeyDown={handleKeyDown}>
      <div className={styles.table_search_row}>
        <button
          type="button"
          className={styles.table_search_button}
          title={replaceOpen ? 'Ocultar substituir' : 'Mostrar substituir'}
          onClick={handleToggleReplace}
        >
          {replaceOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>
        <input
          ref={inputRef}
          className={styles.table_search_input}
          value={query}
          placeholder="Buscar na tabela"
          spellCheck={false}
          onChange={handleChange}
        />
        <button
          type="button"
          className={matchCaseClassName}
          title="Diferenciar maiúsculas/minúsculas"
          onClick={onToggleMatchCase}
        >
          <CaseSensitiveIcon />
        </button>
        <button
          type="button"
          className={wholeWordClassName}
          title="Buscar palavra inteira"
          onClick={onToggleWholeWord}
        >
          <WholeWordIcon />
        </button>
        <span className={styles.table_search_counter}>{counter}</span>
        <button
          type="button"
          className={styles.table_search_button}
          disabled={!total}
          title="Ocorrência anterior"
          onClick={onPrevious}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          className={styles.table_search_button}
          disabled={!total}
          title="Próxima ocorrência"
          onClick={onNext}
        >
          <ArrowDownIcon />
        </button>
        <button
          type="button"
          className={styles.table_search_button}
          title="Fechar busca"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      {replaceOpen && (
        <div className={styles.table_search_row}>
          <span className={styles.table_search_replace_spacer} />
          <input
            className={styles.table_search_input}
            value={replace}
            placeholder="Substituir"
            spellCheck={false}
            onChange={handleReplaceChange}
          />
          <button
            type="button"
            className={styles.table_search_replace_button}
            disabled={!canReplaceCurrent}
            title="Substituir ocorrência atual"
            onClick={onReplaceCurrent}
          >
            <ReplaceIcon />
          </button>
          <button
            type="button"
            className={styles.table_search_replace_button}
            disabled={!canReplaceAll}
            title="Substituir todas as ocorrências editáveis"
            onClick={onReplaceAll}
          >
            <ReplaceAllIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(TableSearchBar);
