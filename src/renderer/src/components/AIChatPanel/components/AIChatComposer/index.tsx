import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import { IconArrowUp, IconStop } from '@renderer/styles/icons';
import type {
  IAIChatConnectionOption,
  IAIChatModelGroup,
  IAIChatTableMentionOption,
} from '../../types';
import { getAIModelLabel } from '../../utils/aiModels';
import styles from './styles.module.css';

interface IActiveTableMention {
  start: number;
  end: number;
  query: string;
}

interface IAIChatComposerProps {
  value: string;
  canSubmit: boolean;
  loading?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  connectionOptions?: IAIChatConnectionOption[];
  tableMentionOptions?: IAIChatTableMentionOption[];
  modelGroups?: IAIChatModelGroup[];
  selectedConnectionId?: string;
  selectedProviderId?: string;
  selectedModel?: string;
  onConnectionChange?(connectionId: string): void;
  onModelChange?(providerId: string, model: string): void;
  onSubmit(event: React.FormEvent<HTMLFormElement>): void;
  onChange(event: React.ChangeEvent<HTMLTextAreaElement>): void;
  onStop?(): void;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  onClick?: React.MouseEventHandler<HTMLTextAreaElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

const getActiveTableMention = (
  text: string,
  cursor: number,
): IActiveTableMention | undefined => {
  const prefix = text.slice(0, cursor);
  const match = /(?:^|\s)(@[a-zA-Z0-9_.-]*)$/.exec(prefix);

  if (!match) return undefined;

  const suffix = text.slice(cursor);
  const suffixToken = /^[a-zA-Z0-9_.-]*/.exec(suffix)?.[0] || '';
  const mention = match[1];

  return {
    start: cursor - mention.length,
    end: cursor + suffixToken.length,
    query: mention.slice(1).toLowerCase(),
  };
};

const renderComposerPreview = (text: string, tableMentionLabels: Set<string>) => {
  const parts: React.ReactNode[] = [];
  const mentionPattern = /@[a-zA-Z0-9_.-]+/g;
  let lastIndex = 0;

  for (const match of text.matchAll(mentionPattern)) {
    const mention = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push(<React.Fragment key={`text_${index}`}>{text.slice(lastIndex, index)}</React.Fragment>);
    }

    if (tableMentionLabels.has(mention.toLowerCase())) {
      parts.push(
        <span key={`mention_${index}`} className={styles.tableMentionChip}>
          {mention}
        </span>,
      );
    } else {
      parts.push(<React.Fragment key={`mention_${index}`}>{mention}</React.Fragment>);
    }

    lastIndex = index + mention.length;
  }

  if (lastIndex < text.length) {
    parts.push(<React.Fragment key="text_end">{text.slice(lastIndex)}</React.Fragment>);
  }

  return parts;
};

export const AIChatComposer = React.memo(
  ({
    value,
    canSubmit,
    loading,
    textareaRef,
    connectionOptions = [],
    tableMentionOptions = [],
    modelGroups = [],
    selectedConnectionId,
    selectedProviderId,
    selectedModel,
    onConnectionChange,
    onModelChange,
    onSubmit,
    onChange,
    onStop,
    onPaste,
    onClick,
    onKeyUp,
    onKeyDown,
  }: IAIChatComposerProps) => {
    const { t } = useI18n();
    const [openConnections, setOpenConnections] = React.useState(false);
    const [openModels, setOpenModels] = React.useState(false);
    const [connectionFilter, setConnectionFilter] = React.useState('');
    const [activeTableMention, setActiveTableMention] =
      React.useState<IActiveTableMention>();
    const [highlightedTableMentionIndex, setHighlightedTableMentionIndex] = React.useState(0);
    const localTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const mirrorRef = React.useRef<HTMLDivElement>(null);
    const composerInputWrapRef = React.useRef<HTMLDivElement>(null);
    const connectionMenuRef = React.useRef<HTMLDivElement>(null);
    const connectionFilterRef = React.useRef<HTMLInputElement>(null);
    const modelMenuRef = React.useRef<HTMLDivElement>(null);
    const selectedConnectionOptionRef = React.useRef<HTMLButtonElement>(null);
    const selectedModelOptionRef = React.useRef<HTMLButtonElement>(null);
    const activeTextareaRef = textareaRef || localTextareaRef;

    const activeAIModelLabel = React.useMemo(() => getAIModelLabel(selectedModel), [selectedModel]);
    const activeConnection = React.useMemo(
      () => connectionOptions.find((connection) => connection.id === selectedConnectionId),
      [connectionOptions, selectedConnectionId],
    );
    const tableMentionLabels = React.useMemo(
      () => new Set(tableMentionOptions.map((option) => option.label.toLowerCase())),
      [tableMentionOptions],
    );
    const shouldRenderComposerPreview = value.length <= 3000 && /@[a-zA-Z0-9_.-]+/.test(value);
    const composerPreview = React.useMemo(
      () =>
        shouldRenderComposerPreview
          ? renderComposerPreview(value, tableMentionLabels)
          : value,
      [shouldRenderComposerPreview, tableMentionLabels, value],
    );

    const hasModelOptions = modelGroups.some((group) => group.models.length);
    const hasConnectionOptions = !!connectionOptions.length;
    const filteredConnectionOptions = React.useMemo(() => {
      const filter = connectionFilter.trim().toLowerCase();

      if (!filter) return connectionOptions;

      return connectionOptions.filter((connection) => {
        const searchable = [connection.label, connection.meta].filter(Boolean).join(' ').toLowerCase();

        return searchable.includes(filter);
      });
    }, [connectionFilter, connectionOptions]);
    const tableMentionSuggestions = React.useMemo(() => {
      if (!activeTableMention) return [];

      return tableMentionOptions
        .filter((option) => {
          const searchable = [option.label, option.meta].filter(Boolean).join(' ').toLowerCase();

          return !activeTableMention.query || searchable.includes(activeTableMention.query);
        })
        .slice(0, 8);
    }, [activeTableMention, tableMentionOptions]);
    const selectedTableMentionSuggestion =
      tableMentionSuggestions[
        Math.min(highlightedTableMentionIndex, tableMentionSuggestions.length - 1)
      ];

    const selectConnection = React.useCallback(
      (connectionId: string) => {
        onConnectionChange?.(connectionId);
        setOpenConnections(false);
        setConnectionFilter('');
      },
      [onConnectionChange],
    );

    const selectTableMention = React.useCallback(
      (option: IAIChatTableMentionOption) => {
        if (!activeTableMention || !activeTextareaRef.current) return;

        const prefix = value.slice(0, activeTableMention.start);
        const suffix = value.slice(activeTableMention.end).replace(/^\s+/, '');
        const separator = suffix ? ' ' : '';
        const nextValue = `${prefix}${option.label}${separator}${suffix}`;
        const nextCursor = prefix.length + option.label.length + separator.length;

        onChange({
          target: { value: nextValue },
          currentTarget: { value: nextValue },
        } as React.ChangeEvent<HTMLTextAreaElement>);
        setActiveTableMention(undefined);
        setHighlightedTableMentionIndex(0);

        window.requestAnimationFrame(() => {
          activeTextareaRef.current?.focus();
          activeTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
      },
      [activeTableMention, activeTextareaRef, onChange, value],
    );

    const selectModel = React.useCallback(
      (providerId: string, model: string) => {
        onModelChange?.(providerId, model);
        setOpenModels(false);
      },
      [onModelChange],
    );

    React.useEffect(() => {
      if (!activeTableMention && !openConnections && !openModels) return;

      const closeOnOutsideClick = (event: MouseEvent) => {
        if (connectionMenuRef.current?.contains(event.target as Node)) return;
        if (modelMenuRef.current?.contains(event.target as Node)) return;
        if (activeTableMention && composerInputWrapRef.current?.contains(event.target as Node)) {
          return;
        }

        setActiveTableMention(undefined);
        setOpenConnections(false);
        setOpenModels(false);
      };

      window.addEventListener('mousedown', closeOnOutsideClick);
      return () => window.removeEventListener('mousedown', closeOnOutsideClick);
    }, [activeTableMention, openConnections, openModels]);

    React.useEffect(() => {
      if (openConnections) {
        connectionFilterRef.current?.focus();
        selectedConnectionOptionRef.current?.scrollIntoView({ block: 'nearest' });
      }

      if (openModels) {
        selectedModelOptionRef.current?.scrollIntoView({ block: 'nearest' });
      }
    }, [openConnections, openModels, selectedConnectionId, selectedModel, selectedProviderId]);

    React.useEffect(() => {
      if (!openConnections) setConnectionFilter('');
    }, [openConnections]);

    React.useEffect(() => {
      setHighlightedTableMentionIndex(0);
    }, [activeTableMention?.query]);

    React.useEffect(() => {
      if (highlightedTableMentionIndex >= tableMentionSuggestions.length) {
        setHighlightedTableMentionIndex(0);
      }
    }, [highlightedTableMentionIndex, tableMentionSuggestions.length]);

    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(event);
        setActiveTableMention(
          getActiveTableMention(event.target.value, event.target.selectionStart),
        );
      },
      [onChange],
    );

    const updateActiveTableMention = React.useCallback(
      (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setActiveTableMention(
          getActiveTableMention(event.currentTarget.value, event.currentTarget.selectionStart),
        );
      },
      [],
    );

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (activeTableMention && tableMentionSuggestions.length) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedTableMentionIndex(
              (prevState) => (prevState + 1) % tableMentionSuggestions.length,
            );
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedTableMentionIndex(
              (prevState) =>
                (prevState - 1 + tableMentionSuggestions.length) % tableMentionSuggestions.length,
            );
            return;
          }

          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            if (selectedTableMentionSuggestion) selectTableMention(selectedTableMentionSuggestion);
            return;
          }
        }

        if (event.key === 'Escape' && activeTableMention) {
          event.preventDefault();
          setActiveTableMention(undefined);
          return;
        }

        onKeyDown?.(event);
      },
      [
        activeTableMention,
        onKeyDown,
        selectTableMention,
        selectedTableMentionSuggestion,
        tableMentionSuggestions.length,
      ],
    );

    const syncMirrorScroll = React.useCallback(() => {
      if (!mirrorRef.current || !activeTextareaRef.current) return;

      mirrorRef.current.scrollTop = activeTextareaRef.current.scrollTop;
      mirrorRef.current.scrollLeft = activeTextareaRef.current.scrollLeft;
    }, [activeTextareaRef]);

    React.useEffect(() => {
      syncMirrorScroll();
    }, [syncMirrorScroll, value]);

    return (
      <div className={styles.composer}>
        <form className={styles.composerForm} onSubmit={onSubmit}>
          <div ref={composerInputWrapRef} className={styles.composerInputWrap}>
            <div className={styles.composerField}>
              <div className={styles.composerTextareaWrap}>
                <div ref={mirrorRef} className={styles.composerTextareaMirror} aria-hidden="true">
                  <div className={styles.composerTextareaMirrorInner}>{composerPreview}</div>
                </div>

                <textarea
                  autoFocus
                  ref={activeTextareaRef}
                  value={value}
                  placeholder={t('aiChat.composerPlaceholder')}
                  aria-label={t('aiChat.composerPlaceholder')}
                  onChange={handleChange}
                  onPaste={onPaste}
                  onClick={(event) => {
                    onClick?.(event);
                    updateActiveTableMention(event);
                  }}
                  onKeyUp={(event) => {
                    onKeyUp?.(event);
                    updateActiveTableMention(event);
                  }}
                  onKeyDown={handleKeyDown}
                  onScroll={syncMirrorScroll}
                />
              </div>

              <div className={styles.composerToolbar}>
                <div className={styles.composerActions}>
                  <div ref={connectionMenuRef} className={styles.connectionMenuWrap}>
                    <button
                      className={styles.connectionBadgeButton}
                      type="button"
                      title={t('aiChat.selectConnection')}
                      disabled={!hasConnectionOptions}
                      onClick={() => setOpenConnections((prevState) => !prevState)}
                    >
                      {activeConnection?.label || t('aiChat.selectConnection')}
                    </button>

                    {openConnections && (
                      <div className={styles.connectionDropdown}>
                        <input
                          ref={connectionFilterRef}
                          className={styles.connectionFilterInput}
                          value={connectionFilter}
                          placeholder={t('aiChat.filterConnections')}
                          aria-label={t('aiChat.filterConnections')}
                          onChange={(event) => setConnectionFilter(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setOpenConnections(false);
                          }}
                        />

                        <div className={styles.connectionOptionsList}>
                          {filteredConnectionOptions.map((connection) => {
                            const active = connection.id === selectedConnectionId;

                            return (
                              <button
                                key={connection.id}
                                ref={active ? selectedConnectionOptionRef : undefined}
                                type="button"
                                className={
                                  active ? styles.connectionOptionActive : styles.connectionOption
                                }
                                onClick={() => selectConnection(connection.id)}
                              >
                                <strong>{connection.label}</strong>
                                {!!connection.meta && <span>{connection.meta}</span>}
                              </button>
                            );
                          })}

                          {!filteredConnectionOptions.length && (
                            <div className={styles.connectionEmpty}>
                              {t('aiChat.noConnectionsFound')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.composerMeta}>
                  {!!activeAIModelLabel && (
                    <div ref={modelMenuRef} className={styles.modelMenuWrap}>
                      <button
                        className={styles.modelBadgeButton}
                        type="button"
                        title={t('aiProvider.selectModel')}
                        disabled={!hasModelOptions}
                        onClick={() => setOpenModels((prevState) => !prevState)}
                      >
                        {activeAIModelLabel}
                      </button>

                      {openModels && (
                        <div className={styles.modelDropdown}>
                          {modelGroups.map((group) => (
                            <div key={group.providerId} className={styles.modelGroup}>
                              <span className={styles.modelProviderName}>{group.providerName}</span>

                              {group.models.map((model) => {
                                const active = group.providerId === selectedProviderId && model === selectedModel;

                                return (
                                  <button
                                    key={`${group.providerId}:${model}`}
                                    ref={active ? selectedModelOptionRef : undefined}
                                    type="button"
                                    className={active ? styles.modelOptionActive : styles.modelOption}
                                    onClick={() => selectModel(group.providerId, model)}
                                  >
                                    {getAIModelLabel(model)}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className={loading ? styles.stopButton : styles.sendButton}
                    type={loading ? 'button' : 'submit'}
                    disabled={!loading && !canSubmit}
                    title={loading ? t('aiChat.stopGenerating') : t('aiChat.send')}
                    aria-label={loading ? t('aiChat.stopGenerating') : t('aiChat.send')}
                    onClick={loading ? onStop : undefined}
                  >
                    {loading ? <IconStop size={14} /> : <IconArrowUp size={19} />}
                  </button>
                </div>
              </div>
            </div>

            {!!tableMentionSuggestions.length && (
              <div className={styles.tableMentionDropdown} role="listbox">
                {tableMentionSuggestions.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={index === highlightedTableMentionIndex}
                    className={
                      index === highlightedTableMentionIndex
                        ? styles.tableMentionOptionActive
                        : styles.tableMentionOption
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedTableMentionIndex(index)}
                    onClick={() => selectTableMention(option)}
                  >
                    <strong>{option.label}</strong>
                    {!!option.meta && <span>{option.meta}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>
    );
  },
);

AIChatComposer.displayName = 'AIChatComposer';
