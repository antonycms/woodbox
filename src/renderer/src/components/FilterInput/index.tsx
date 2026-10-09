import React from 'react';
import { useI18nStore } from '@renderer/stores/I18n';
import { classes } from '@renderer/styles/theme';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import { HistoryIcon } from '@renderer/styles/icons';
import styles from './styles.module.css';

interface IFilterInputProps {
  value: string;
  suggestions?: string[];
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
  filterBar?: IFilterInputFilterBarProps;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  dropdownBackgroundColor?: string;
  dropdownBorderColor?: string;
  dropdownColor?: string;
  historyItems?: string[];
  historyTitle?: string;
  historyEmptyLabel?: string;
  onChange(value: string): void;
  onHistorySelect?(value: string): void;
  onKeyDown?(event: React.KeyboardEvent<HTMLInputElement>): void;
}

interface IFilterInputFilterBarProps {
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
  fieldBackgroundColor?: string;
  inputOpacity?: number;
}

interface ITokenInfo {
  start: number;
  end: number;
  text: string;
}

const TOKEN_CHAR_REGEX = /[a-zA-Z0-9_.$"]/;
const MAX_SUGGESTIONS = 24;

const getTokenInfo = (value: string, cursorPosition: number): ITokenInfo => {
  const end = Math.min(cursorPosition, value.length);
  let start = end;

  while (start > 0 && TOKEN_CHAR_REGEX.test(value[start - 1])) {
    start -= 1;
  }

  const token = value.slice(start, end);
  const dotIndex = token.lastIndexOf('.');
  const offset = dotIndex >= 0 ? dotIndex + 1 : 0;
  const textStart = start + offset;
  const text = value.slice(textStart, end).replace(/^"/, '');

  return {
    start: textStart + (value[textStart] === '"' ? 1 : 0),
    end,
    text,
  };
};

export default function FilterInput({
  value,
  suggestions = [],
  autoFocus,
  placeholder,
  disabled,
  filterBar,
  inputClassName,
  inputStyle,
  dropdownBackgroundColor,
  dropdownBorderColor,
  dropdownColor,
  historyItems,
  historyTitle,
  historyEmptyLabel,
  onChange,
  onHistorySelect,
  onKeyDown,
}: IFilterInputProps) {
  const t = useI18nStore((state) => state.t);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [cursorPosition, setCursorPosition] = React.useState(value.length);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const historyTitleText = historyTitle ?? t('filterHistory.title');
  const historyEmptyLabelText = historyEmptyLabel ?? t('filterHistory.empty');
  const hasHistoryButton = !!historyItems;
  const hasHistoryItems = !!historyItems?.length;
  const resolvedInputStyle = {
    color: filterBar?.color,
    opacity: filterBar?.inputOpacity,
    ...inputStyle,
  };
  const resolvedDropdownBackgroundColor =
    dropdownBackgroundColor ?? filterBar?.fieldBackgroundColor;
  const resolvedDropdownBorderColor = dropdownBorderColor ?? filterBar?.borderColor;
  const resolvedDropdownColor = dropdownColor ?? filterBar?.color;

  const tokenInfo = React.useMemo(
    () => getTokenInfo(value, cursorPosition),
    [cursorPosition, value],
  );

  const filteredSuggestions = React.useMemo(() => {
    const uniqueSuggestions = Array.from(new Set(suggestions)).filter(Boolean);
    const normalizedText = tokenInfo.text.toLowerCase();

    if (!showAll && !normalizedText) return [];

    return uniqueSuggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(normalizedText))
      .sort((suggestionA, suggestionB) => {
        const aStartsWithText = suggestionA.toLowerCase().startsWith(normalizedText);
        const bStartsWithText = suggestionB.toLowerCase().startsWith(normalizedText);

        if (aStartsWithText === bStartsWithText) return suggestionA.localeCompare(suggestionB);

        return aStartsWithText ? -1 : 1;
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [showAll, suggestions, tokenInfo.text]);

  const closeSuggestions = React.useCallback(() => {
    setIsOpen(false);
    setShowAll(false);
    setActiveIndex(-1);
  }, []);

  const updateCursorPosition = React.useCallback((input: HTMLInputElement) => {
    setCursorPosition(input.selectionStart ?? input.value.length);
  }, []);

  const openInputDropdown = React.useCallback(
    (input: HTMLInputElement) => {
      updateCursorPosition(input);

      if (hasHistoryItems && !input.value.trim()) {
        closeSuggestions();
        setIsHistoryOpen(true);
        return;
      }

      setIsHistoryOpen(false);
      setIsOpen(true);
    },
    [closeSuggestions, hasHistoryItems, updateCursorPosition],
  );

  const toggleHistory = React.useCallback(() => {
    if (disabled) return;

    closeSuggestions();
    setIsHistoryOpen((current) => !current);
  }, [closeSuggestions, disabled]);

  const selectHistory = React.useCallback(
    (filter: string) => {
      setIsHistoryOpen(false);

      if (onHistorySelect) onHistorySelect(filter);
      else onChange(filter);
    },
    [onChange, onHistorySelect],
  );

  const insertSuggestion = React.useCallback(
    (suggestion: string) => {
      const nextValue = `${value.slice(0, tokenInfo.start)}${suggestion}${value.slice(
        tokenInfo.end,
      )}`;
      const nextCursorPosition = tokenInfo.start + suggestion.length;

      onChange(nextValue);
      setCursorPosition(nextCursorPosition);
      closeSuggestions();

      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    },
    [closeSuggestions, onChange, tokenInfo.end, tokenInfo.start, value],
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;

      updateCursorPosition(event.target);
      setIsHistoryOpen(hasHistoryItems && !nextValue.trim());
      setIsOpen(!!nextValue.trim());
      setShowAll(false);
      setActiveIndex(-1);
      onChange(nextValue);
    },
    [hasHistoryItems, onChange, updateCursorPosition],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const hasSuggestions = filteredSuggestions.length > 0;

      if (isPrimaryShortcutPressed(event) && event.code === 'Space') {
        event.preventDefault();
        updateCursorPosition(event.currentTarget);
        setShowAll(true);
        setIsOpen(true);
        setIsHistoryOpen(false);
        setActiveIndex(-1);
        return;
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closeSuggestions();
        return;
      }

      if (event.key === 'Escape' && isHistoryOpen) {
        event.preventDefault();
        setIsHistoryOpen(false);
        return;
      }

      if (event.key === 'ArrowDown' && hasSuggestions) {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((current) => Math.min(current + 1, filteredSuggestions.length - 1));
        return;
      }

      if (event.key === 'ArrowUp' && isOpen && hasSuggestions) {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (isOpen && hasSuggestions && event.key === 'Tab') {
        event.preventDefault();
        insertSuggestion(filteredSuggestions[Math.max(activeIndex, 0)]);
        return;
      }

      if (isOpen && hasSuggestions && activeIndex >= 0 && event.key === 'Enter') {
        event.preventDefault();
        insertSuggestion(filteredSuggestions[activeIndex]);
        return;
      }

      onKeyDown?.(event);
    },
    [
      activeIndex,
      closeSuggestions,
      insertSuggestion,
      isOpen,
      isHistoryOpen,
      onKeyDown,
      filteredSuggestions,
      updateCursorPosition,
    ],
  );

  React.useEffect(() => {
    if (!isOpen || !filteredSuggestions.length) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((current) => Math.min(Math.max(current, 0), filteredSuggestions.length - 1));
  }, [filteredSuggestions, isOpen]);

  React.useEffect(() => {
    if (!isOpen || activeIndex < 0) return;

    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  React.useEffect(() => {
    if (!isHistoryOpen) return;

    const closeHistoryOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;

      setIsHistoryOpen(false);
    };

    document.addEventListener('mousedown', closeHistoryOnOutsideClick);

    return () => {
      document.removeEventListener('mousedown', closeHistoryOnOutsideClick);
    };
  }, [isHistoryOpen]);

  const input = (
    <div ref={containerRef} className={styles.container}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className={classes(styles.input, filterBar && styles.filterBarInput, inputClassName)}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(event) => {
          openInputDropdown(event.currentTarget);
        }}
        onKeyUp={(event) => updateCursorPosition(event.currentTarget)}
        onFocus={(event) => {
          openInputDropdown(event.currentTarget);
        }}
        onBlur={() => {
          closeSuggestions();
          setIsHistoryOpen(false);
        }}
        style={resolvedInputStyle}
        spellCheck={false}
      />

      {hasHistoryButton && (
        <button
          type="button"
          className={classes(styles.historyButton, isHistoryOpen && styles.historyButtonActive)}
          title={historyTitleText}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleHistory}
          style={
            {
              color: resolvedDropdownColor ?? resolvedInputStyle.color,
              '--filter-input-hover-background-color': resolvedDropdownBorderColor,
            } as React.CSSProperties
          }
        >
          <HistoryIcon size={16} />
        </button>
      )}

      {!!(isOpen && filteredSuggestions.length) && (
        <div
          className={styles.dropdown}
          style={
            {
              backgroundColor: resolvedDropdownBackgroundColor,
              borderColor: resolvedDropdownBorderColor,
              color: resolvedDropdownColor,
              '--filter-input-shadow-color': resolvedDropdownBorderColor,
              '--filter-input-hover-background-color': resolvedDropdownBorderColor,
            } as React.CSSProperties
          }
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              className={classes(styles.option, index === activeIndex && styles.optionActive)}
              title={suggestion}
              onMouseDown={(event) => {
                event.preventDefault();
                insertSuggestion(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {!!(hasHistoryButton && isHistoryOpen) && (
        <div
          className={styles.dropdown}
          style={
            {
              backgroundColor: resolvedDropdownBackgroundColor,
              borderColor: resolvedDropdownBorderColor,
              color: resolvedDropdownColor,
              '--filter-input-shadow-color': resolvedDropdownBorderColor,
              '--filter-input-hover-background-color': resolvedDropdownBorderColor,
            } as React.CSSProperties
          }
        >
          {historyItems?.length ? (
            historyItems.map((filter) => (
              <button
                key={filter}
                type="button"
                className={styles.option}
                title={filter}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectHistory(filter)}
              >
                {filter}
              </button>
            ))
          ) : (
            <div className={styles.emptyHistory}>{historyEmptyLabelText}</div>
          )}
        </div>
      )}
    </div>
  );

  if (!filterBar) return input;

  return (
    <div
      className={styles.filterBar}
      style={{
        backgroundColor: filterBar.backgroundColor,
        borderColor: filterBar.borderColor,
      }}
    >
      {input}
    </div>
  );
}
