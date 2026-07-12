import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

interface IColumnFilterInputProps {
  value: string;
  columnNames: string[];
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  dropdownBackgroundColor?: string;
  dropdownBorderColor?: string;
  dropdownColor?: string;
  onChange(value: string): void;
  onKeyDown?(event: React.KeyboardEvent<HTMLInputElement>): void;
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

export default function ColumnFilterInput({
  value,
  columnNames,
  placeholder,
  disabled,
  inputClassName,
  inputStyle,
  dropdownBackgroundColor,
  dropdownBorderColor,
  dropdownColor,
  onChange,
  onKeyDown,
}: IColumnFilterInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [cursorPosition, setCursorPosition] = React.useState(value.length);
  const [isOpen, setIsOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const tokenInfo = React.useMemo(
    () => getTokenInfo(value, cursorPosition),
    [cursorPosition, value],
  );

  const suggestions = React.useMemo(() => {
    const uniqueColumnNames = Array.from(new Set(columnNames)).filter(Boolean);
    const normalizedText = tokenInfo.text.toLowerCase();

    if (!showAll && !normalizedText) return [];

    return uniqueColumnNames
      .filter((columnName) => columnName.toLowerCase().includes(normalizedText))
      .sort((columnA, columnB) => {
        const aStartsWithText = columnA.toLowerCase().startsWith(normalizedText);
        const bStartsWithText = columnB.toLowerCase().startsWith(normalizedText);

        if (aStartsWithText === bStartsWithText) return columnA.localeCompare(columnB);

        return aStartsWithText ? -1 : 1;
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [columnNames, showAll, tokenInfo.text]);

  const closeSuggestions = React.useCallback(() => {
    setIsOpen(false);
    setShowAll(false);
    setActiveIndex(-1);
  }, []);

  const insertSuggestion = React.useCallback(
    (columnName: string) => {
      const nextValue = `${value.slice(0, tokenInfo.start)}${columnName}${value.slice(
        tokenInfo.end,
      )}`;
      const nextCursorPosition = tokenInfo.start + columnName.length;

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

  const updateCursorPosition = React.useCallback((input: HTMLInputElement) => {
    setCursorPosition(input.selectionStart ?? input.value.length);
  }, []);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      updateCursorPosition(event.target);
      setIsOpen(true);
      setShowAll(false);
      setActiveIndex(-1);
      onChange(event.target.value);
    },
    [onChange, updateCursorPosition],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const hasSuggestions = suggestions.length > 0;

      if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
        event.preventDefault();
        updateCursorPosition(event.currentTarget);
        setShowAll(true);
        setIsOpen(true);
        setActiveIndex(-1);
        return;
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closeSuggestions();
        return;
      }

      if (event.key === 'ArrowDown' && hasSuggestions) {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
        return;
      }

      if (event.key === 'ArrowUp' && isOpen && hasSuggestions) {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (isOpen && hasSuggestions && event.key === 'Tab') {
        event.preventDefault();
        insertSuggestion(suggestions[Math.max(activeIndex, 0)]);
        return;
      }

      if (isOpen && hasSuggestions && activeIndex >= 0 && event.key === 'Enter') {
        event.preventDefault();
        insertSuggestion(suggestions[activeIndex]);
        return;
      }

      onKeyDown?.(event);
    },
    [
      activeIndex,
      closeSuggestions,
      insertSuggestion,
      isOpen,
      onKeyDown,
      suggestions,
      updateCursorPosition,
    ],
  );

  React.useEffect(() => {
    if (!suggestions.length) setActiveIndex(-1);
  }, [suggestions.length]);

  React.useEffect(() => {
    if (!isOpen || activeIndex < 0) return;

    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(event) => updateCursorPosition(event.currentTarget)}
        onKeyUp={(event) => updateCursorPosition(event.currentTarget)}
        onFocus={(event) => {
          updateCursorPosition(event.currentTarget);
          setIsOpen(true);
        }}
        onBlur={closeSuggestions}
        style={inputStyle}
        spellCheck={false}
      />

      {!!(isOpen && suggestions.length) && (
        <div
          className={styles.dropdown}
          style={{
            backgroundColor: dropdownBackgroundColor,
            borderColor: dropdownBorderColor,
            color: dropdownColor,
            '--column-filter-shadow-color': dropdownBorderColor,
            '--column-filter-hover-background-color': dropdownBorderColor,
          } as React.CSSProperties}
        >
          {suggestions.map((columnName, index) => (
            <button
              key={columnName}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              className={classes(styles.option, index === activeIndex && styles.optionActive)}
              title={columnName}
              onMouseDown={(event) => {
                event.preventDefault();
                insertSuggestion(columnName);
              }}
            >
              {columnName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
