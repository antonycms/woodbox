import React from 'react';
import { useDropdownPlacement } from '@renderer/components/Autocomplete/hooks/useDropdownPlacement';
import { useDropdownOutsideClick } from '@renderer/components/Autocomplete/hooks/useDropdownOutsideClick';
import { SpinnerLoading } from '@renderer/components/Loaders';
import { VirtualizeList } from '@renderer/components/VirtualizeList';
import { IGridSystem } from '@renderer/components/Grid';
import { useThemeContext } from '@renderer/contexts/Theme';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { classes, toCssProperties } from '@renderer/styles/theme';
import { generateHash } from '@renderer/utils/string';

import styles from './styles.module.css';

const defaultExtractLabel = (item: any) => (typeof item === 'string' ? item : item?.label);
const defaultExtractValue = (item: any) => (typeof item === 'string' ? item : item?.value);

export interface IAutoCompleteRef {
  clear: () => void;
  open: () => void;
}

export function Autocomplete<T = any>(props: IAutocompleteProps<T>) {
  const {
    ref,
    data,
    required,
    name,
    value,
    onChange,
    color,
    backgroundColor,
    title,
    placeholder,
    className,
    containerClassName,
    containerStyle,
    autoFocus,
    loading,
    id,
    extractLabel = defaultExtractLabel,
    extractValue = defaultExtractValue,
    emptyMessage = 'Não há opções disponíveis',
  } = props;
  const {
    activeTheme: { __colors },
  } = useThemeContext();

  const itemSize = 41;

  const refScrollElement = React.useRef<HTMLDivElement>(null);
  const refInput = React.useRef<HTMLInputElement>(null);
  const [idContainer] = React.useState(generateHash(10));
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [textInput, setTextInput] = useStateWithDebounce('');

  const extractLabelRef = React.useRef(extractLabel);
  extractLabelRef.current = extractLabel;

  const extractValueRef = React.useRef(extractValue);
  extractValueRef.current = extractValue;

  const onBlurWithoutChangeRef = React.useRef(props.onBlurWithoutChange);
  onBlurWithoutChangeRef.current = props.onBlurWithoutChange;

  const inputStyle = React.useMemo(() => {
    return { ...toCssProperties({ placeholderColor: color }), color };
  }, [color]);

  const dataFiltered = React.useMemo(() => {
    if (!textInput) return [...data.entries()];

    const normalizedTextInput = textInput.toLowerCase();
    const array: [number, T][] = [];
    const labels = new Map<number, string>();

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const normalizedLabel = extractLabelRef.current(item).toLowerCase();
      const textContains = normalizedLabel.includes(normalizedTextInput);

      if (textContains) {
        array.push([i, item]);
        labels.set(i, normalizedLabel);
      }
    }

    return array.sort(([indexA], [indexB]) => {
      const itemAStartsWithTextInput = labels.get(indexA).startsWith(normalizedTextInput);
      const itemBStartsWithTextInput = labels.get(indexB).startsWith(normalizedTextInput);

      if (itemAStartsWithTextInput === itemBStartsWithTextInput) return indexA - indexB;

      return itemAStartsWithTextInput ? -1 : 1;
    });
  }, [textInput, data]);

  const selected = React.useMemo(() => {
    if (value === null || value === undefined || !data) return null;

    return data.find((item) => extractValueRef.current(item) === value);
  }, [value, data]);

  const selectedLabel = selected ? extractLabelRef.current(selected) : undefined;

  const closeDropdown = (notifyBlurWithoutChange = false) => {
    refInput.current?.blur();
    setIsDropdownOpen(false);

    if (refInput.current) refInput.current.value = '';
    setTextInput('');
    if (notifyBlurWithoutChange) onBlurWithoutChangeRef.current?.();
  };

  const onSelect = (item: T | null, index: number) => {
    closeDropdown();
    setActiveIndex(index);
    onChange?.({ index, name, item, value: item && extractValueRef.current(item) });
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInput(e.target.value);
    props.onInput?.(e);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    props.onKeyDown?.(e);
    if (e.defaultPrevented) return;

    const isEnter = e.key === 'Enter';
    const isUp = e.key === 'ArrowUp';
    const isDown = e.key === 'ArrowDown';

    if (!isEnter && !isUp && !isDown) return;

    e.preventDefault();

    if (!dataFiltered.length) return;

    if (!isDropdownOpen) {
      setIsDropdownOpen(true);
    }

    if (isDown) {
      setActiveIndex((current) => Math.min(current + 1, dataFiltered.length - 1));
      return;
    }

    if (isUp) {
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (isEnter && activeIndex >= 0) {
      const [realIndex, item] = dataFiltered[activeIndex];
      onSelect(item, realIndex);
    }
  };

  const dropdownHeight = (dataFiltered.length || 1) * (itemSize + 2);
  const dropdownPlacement = useDropdownPlacement({
    anchorRef: refInput,
    dropdownHeight,
    isOpen: isDropdownOpen && !!dataFiltered.length,
  });
  const dropdownStyle = React.useMemo(
    () =>
      ({
        backgroundColor,
        color,
        maxHeight: dropdownPlacement?.maxHeight,
        ...toCssProperties({ height: `${dropdownHeight}px` }),
        '--autocomplete-hover-background-color': __colors.darkLight,
        '--autocomplete-selected-background-color': __colors.darkLightDeep,
        '--autocomplete-active-background-color': __colors.darkLightDeep,
        '--autocomplete-border-color': __colors.lightGray,
        '--autocomplete-shadow-color': __colors.shadow,
      }) as React.CSSProperties,
    [
      __colors.darkLight,
      __colors.darkLightDeep,
      __colors.lightGray,
      __colors.shadow,
      backgroundColor,
      color,
      dropdownHeight,
      dropdownPlacement?.maxHeight,
    ],
  );

  // value ref
  React.useImperativeHandle(
    ref,
    () => ({
      clear: () => closeDropdown(),
      open: () => refInput.current?.focus(),
    }),
    [],
  );

  // Clique fora para fechar
  useDropdownOutsideClick({
    idContainer,
    isOpen: isDropdownOpen,
    onClose: () => closeDropdown(true),
  });

  // Scrolla para o item selecionado ao abrir o dropdown
  React.useEffect(() => {
    if (!isDropdownOpen || activeIndex < 0 || !refScrollElement.current) return;

    refScrollElement.current.scrollTop = activeIndex * itemSize;
  }, [activeIndex, isDropdownOpen]);

  return (
    <div
      style={{ ...containerStyle, backgroundColor }}
      className={classes(styles.container, containerClassName)}
      id={idContainer}
    >
      <input
        autoComplete="off"
        autoFocus={autoFocus}
        spellCheck="false"
        id={id}
        name={name}
        className={className}
        required={required}
        title={title}
        data-value={value}
        placeholder={selected ? selectedLabel : placeholder}
        ref={refInput}
        onChange={onInput}
        onKeyDown={onKeyDown}
        style={inputStyle}
        onFocus={() => setIsDropdownOpen(true)}
      />

      {!!(isDropdownOpen && dataFiltered.length) && (
        <div
          className={classes(
            styles.dropdownContainer,
            dropdownPlacement?.placement === 'top' && styles.openUp,
          )}
          style={dropdownStyle}
        >
          <VirtualizeList
            itemSize={itemSize}
            itemCount={dataFiltered.length}
            refScrollElement={refScrollElement}
            childrenStickySize={20}
            childrenSticky={
              !dataFiltered.length && <p className={styles.emptyMessage}>{emptyMessage}</p>
            }
          >
            {({ index }) => {
              const [real_index, item] = dataFiltered[index];

              const label = extractLabelRef.current(item);
              const isSelected =
                selected && extractValueRef.current(selected) === extractValueRef.current(item);
              const isActive = activeIndex === index;

              return (
                <div
                  key={real_index}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect(item, real_index);
                  }}
                  title={label}
                  className={classes(
                    styles.row,
                    isSelected && styles.selected,
                    isActive && styles.active,
                  )}
                >
                  {label}
                </div>
              );
            }}
          </VirtualizeList>
        </div>
      )}

      {!!loading && (
        <div className={styles.iconContainer}>
          <SpinnerLoading
            background="transparent"
            color={color}
            size={12}
            thickness={2}
            padding="0"
          />
        </div>
      )}
    </div>
  );
}

export interface IAutocompleteProps<T> extends IGridSystem {
  value?: string | number | boolean | null;
  name?: string;
  id?: string;
  maxWidth?: string;
  className?: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  centerText?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  title?: string;
  icon?: React.ReactElement;
  color?: string;
  backgroundColor?: string;
  label?: string;
  labelColor?: string;
  extractLabel?: (item: T) => string;
  extractValue?: (item: T) => string | number;
  emptyMessage?: string;
  clearable?: boolean;
  ref?: React.Ref<IAutoCompleteRef>;
  data: T[];
  loading?: boolean;
  placeholder?: string;
  registerable?: boolean;
  onBlurWithoutChange?(): void;
  onInput?(e: React.ChangeEvent<HTMLInputElement>): void;
  onKeyDown?(e: React.KeyboardEvent<HTMLInputElement>): void;
  onChange?(params: {
    index: number;
    name?: string;
    value: string | number | null;
    item: T | null;
  }): void;
}
