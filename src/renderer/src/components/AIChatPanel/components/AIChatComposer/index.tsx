import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import { IconArrowUp, IconStop } from '@renderer/styles/icons';
import type {
  IAIChatConnectionOption,
  IAIChatDraftContext,
  IAIChatModelGroup,
  IAIChatReferenceOption,
} from '../../types';
import { getAIModelLabel } from '../../utils/aiModels';
import styles from './styles.module.css';

interface IActiveReference {
  start: number;
  end: number;
  query: string;
}

interface IAIChatComposerProps {
  value: string;
  canSubmit: boolean;
  loading?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  contexts?: IAIChatDraftContext[];
  connectionOptions?: IAIChatConnectionOption[];
  referenceOptions?: IAIChatReferenceOption[];
  modelGroups?: IAIChatModelGroup[];
  selectedConnectionId?: string;
  selectedProviderId?: string;
  selectedModel?: string;
  onConnectionChange?(connectionId: string): void;
  onModelChange?(providerId: string, model: string): void;
  onSubmit(event: React.FormEvent<HTMLFormElement>): void;
  onChange(event: React.ChangeEvent<HTMLTextAreaElement>): void;
  onOpenReference?(option: IAIChatReferenceOption): void;
  onRemoveContext?(contextId: string): void;
  onStop?(): void;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  onClick?: React.MouseEventHandler<HTMLTextAreaElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

const getActiveReference = (
  text: string,
  cursor: number,
): IActiveReference | undefined => {
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

const renderComposerPreview = (
  text: string,
  referenceLabels: Set<string>,
  referenceTitle: string,
) => {
  const parts: React.ReactNode[] = [];
  const mentionPattern = /@[a-zA-Z0-9_.-]+/g;
  let lastIndex = 0;

  for (const match of text.matchAll(mentionPattern)) {
    const mention = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push(<React.Fragment key={`text_${index}`}>{text.slice(lastIndex, index)}</React.Fragment>);
    }

    if (referenceLabels.has(mention.toLowerCase())) {
      parts.push(
        <span
          key={`mention_${index}`}
          className={styles.tableMentionChip}
          data-reference-label={mention.toLowerCase()}
          title={referenceTitle}
        >
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
    contexts = [],
    connectionOptions = [],
    referenceOptions = [],
    modelGroups = [],
    selectedConnectionId,
    selectedProviderId,
    selectedModel,
    onConnectionChange,
    onModelChange,
    onSubmit,
    onChange,
    onOpenReference,
    onRemoveContext,
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
    const [activeContextPreviewId, setActiveContextPreviewId] = React.useState<string>();
    const [activeReference, setActiveReference] =
      React.useState<IActiveReference>();
    const [highlightedReferenceIndex, setHighlightedReferenceIndex] = React.useState(0);
    const localTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const mirrorRef = React.useRef<HTMLDivElement>(null);
    const composerInputWrapRef = React.useRef<HTMLDivElement>(null);
    const contextPreviewRef = React.useRef<HTMLDivElement>(null);
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
    const referenceLabels = React.useMemo(
      () => new Set(referenceOptions.map((option) => option.label.toLowerCase())),
      [referenceOptions],
    );
    const referenceOptionsByLabel = React.useMemo(
      () => new Map(referenceOptions.map((option) => [option.label.toLowerCase(), option])),
      [referenceOptions],
    );
    const shouldRenderComposerPreview = value.length <= 3000 && /@[a-zA-Z0-9_.-]+/.test(value);
    const composerPreview = React.useMemo(
      () =>
        shouldRenderComposerPreview
          ? renderComposerPreview(value, referenceLabels, t('aiChat.openMentionTitle'))
          : value,
      [shouldRenderComposerPreview, referenceLabels, t, value],
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
    const referenceSuggestions = React.useMemo(() => {
      if (!activeReference) return [];

      return referenceOptions
        .filter((option) => {
          const searchable = [option.label, option.meta].filter(Boolean).join(' ').toLowerCase();

          return !activeReference.query || searchable.includes(activeReference.query);
        })
        .slice(0, 8);
    }, [activeReference, referenceOptions]);
    const selectedReferenceSuggestion =
      referenceSuggestions[
        Math.min(highlightedReferenceIndex, referenceSuggestions.length - 1)
      ];
    const activeContextPreview = React.useMemo(
      () => contexts.find((context) => context.id === activeContextPreviewId),
      [activeContextPreviewId, contexts],
    );

    const selectConnection = React.useCallback(
      (connectionId: string) => {
        onConnectionChange?.(connectionId);
        setOpenConnections(false);
        setConnectionFilter('');
      },
      [onConnectionChange],
    );

    const selectReference = React.useCallback(
      (option: IAIChatReferenceOption) => {
        if (!activeReference || !activeTextareaRef.current) return;

        const prefix = value.slice(0, activeReference.start);
        const suffix = value.slice(activeReference.end).replace(/^\s+/, '');
        const separator = suffix ? ' ' : '';
        const nextValue = `${prefix}${option.label}${separator}${suffix}`;
        const nextCursor = prefix.length + option.label.length + separator.length;

        onChange({
          target: { value: nextValue },
          currentTarget: { value: nextValue },
        } as React.ChangeEvent<HTMLTextAreaElement>);
        setActiveReference(undefined);
        setHighlightedReferenceIndex(0);

        window.requestAnimationFrame(() => {
          activeTextareaRef.current?.focus();
          activeTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
      },
      [activeReference, activeTextareaRef, onChange, value],
    );

    const selectModel = React.useCallback(
      (providerId: string, model: string) => {
        onModelChange?.(providerId, model);
        setOpenModels(false);
      },
      [onModelChange],
    );

    React.useEffect(() => {
      if (!activeReference && !openConnections && !openModels) return;

      const closeOnOutsideClick = (event: MouseEvent) => {
        if (connectionMenuRef.current?.contains(event.target as Node)) return;
        if (modelMenuRef.current?.contains(event.target as Node)) return;
        if (activeReference && composerInputWrapRef.current?.contains(event.target as Node)) {
          return;
        }

        setActiveReference(undefined);
        setOpenConnections(false);
        setOpenModels(false);
      };

      window.addEventListener('mousedown', closeOnOutsideClick);
      return () => window.removeEventListener('mousedown', closeOnOutsideClick);
    }, [activeReference, openConnections, openModels]);

    React.useEffect(() => {
      if (!activeContextPreview) return;

      const closeOnOutsideClick = (event: MouseEvent) => {
        if (contextPreviewRef.current?.contains(event.target as Node)) return;

        setActiveContextPreviewId(undefined);
      };

      window.addEventListener('mousedown', closeOnOutsideClick);
      return () => window.removeEventListener('mousedown', closeOnOutsideClick);
    }, [activeContextPreview]);

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
      setHighlightedReferenceIndex(0);
    }, [activeReference?.query]);

    React.useEffect(() => {
      if (highlightedReferenceIndex >= referenceSuggestions.length) {
        setHighlightedReferenceIndex(0);
      }
    }, [highlightedReferenceIndex, referenceSuggestions.length]);

    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(event);
        setActiveReference(
          getActiveReference(event.target.value, event.target.selectionStart),
        );
      },
      [onChange],
    );

    const handlePaste = React.useCallback(
      (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pastedText = event.clipboardData.getData('text');
        const sanitizedText = pastedText.trim();

        if (sanitizedText !== pastedText) {
          event.preventDefault();

          const { selectionStart, selectionEnd, value } = event.currentTarget;
          const nextValue = `${value.slice(0, selectionStart)}${sanitizedText}${value.slice(selectionEnd)}`;
          const nextCursor = selectionStart + sanitizedText.length;

          onChange({
            target: { value: nextValue },
            currentTarget: { value: nextValue },
          } as React.ChangeEvent<HTMLTextAreaElement>);
          setActiveReference(getActiveReference(nextValue, nextCursor));

          window.requestAnimationFrame(() => {
            activeTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
          });
        }

        onPaste?.(event);
      },
      [activeTextareaRef, onChange, onPaste],
    );

    const updateActiveReference = React.useCallback(
      (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setActiveReference(
          getActiveReference(event.currentTarget.value, event.currentTarget.selectionStart),
        );
      },
      [],
    );

    const getReferenceOptionAtPoint = React.useCallback(
      (event: React.MouseEvent<HTMLTextAreaElement>) => {
        const textarea = event.currentTarget;
        const previousPointerEvents = textarea.style.pointerEvents;
        textarea.style.pointerEvents = 'none';
        const element = document.elementFromPoint(event.clientX, event.clientY);
        textarea.style.pointerEvents = previousPointerEvents;

        const label = element
          ?.closest<HTMLElement>('[data-reference-label]')
          ?.dataset.referenceLabel;

        return label ? referenceOptionsByLabel.get(label) : undefined;
      },
      [referenceOptionsByLabel],
    );

    const handleTextareaMouseMove = React.useCallback(
      (event: React.MouseEvent<HTMLTextAreaElement>) => {
        const option = getReferenceOptionAtPoint(event);

        event.currentTarget.style.cursor = option ? 'pointer' : '';
        event.currentTarget.title = option ? t('aiChat.openMentionTitle') : '';
      },
      [getReferenceOptionAtPoint, t],
    );

    const handleTextareaMouseLeave = React.useCallback(
      (event: React.MouseEvent<HTMLTextAreaElement>) => {
        event.currentTarget.style.cursor = '';
        event.currentTarget.title = '';
      },
      [],
    );

    const handleTextareaMouseDown = React.useCallback(
      (event: React.MouseEvent<HTMLTextAreaElement>) => {
        const option = getReferenceOptionAtPoint(event);
        if (!option) return;

        event.preventDefault();
        event.stopPropagation();
        setActiveReference(undefined);
        onOpenReference?.(option);
      },
      [getReferenceOptionAtPoint, onOpenReference],
    );

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (activeReference && referenceSuggestions.length) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedReferenceIndex(
              (prevState) => (prevState + 1) % referenceSuggestions.length,
            );
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedReferenceIndex(
              (prevState) =>
                (prevState - 1 + referenceSuggestions.length) % referenceSuggestions.length,
            );
            return;
          }

          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            if (selectedReferenceSuggestion) selectReference(selectedReferenceSuggestion);
            return;
          }
        }

        if (event.key === 'Escape' && activeReference) {
          event.preventDefault();
          setActiveReference(undefined);
          return;
        }

        onKeyDown?.(event);
      },
      [
        activeReference,
        onKeyDown,
        selectReference,
        selectedReferenceSuggestion,
        referenceSuggestions.length,
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
              {!!contexts.length && (
                <div className={styles.contextChips}>
                  {contexts.map((context) => (
                    <div
                      key={context.id}
                      className={styles.contextChip}
                      title={context.title}
                    >
                      <button
                        type="button"
                        className={styles.contextChipMain}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={() =>
                          setActiveContextPreviewId((currentId) =>
                            currentId === context.id ? undefined : context.id,
                          )
                        }
                      >
                        <span>{context.title}</span>
                      </button>

                      <button
                        type="button"
                        className={styles.contextChipRemove}
                        title={t('aiChat.removeContext')}
                        aria-label={t('aiChat.removeContext')}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveContextPreviewId((currentId) =>
                            currentId === context.id ? undefined : currentId,
                          );
                          onRemoveContext?.(context.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                  onPaste={handlePaste}
                  onMouseMove={handleTextareaMouseMove}
                  onMouseLeave={handleTextareaMouseLeave}
                  onMouseDown={handleTextareaMouseDown}
                  onClick={(event) => {
                    onClick?.(event);
                    updateActiveReference(event);
                  }}
                  onKeyUp={(event) => {
                    onKeyUp?.(event);
                    updateActiveReference(event);
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

            {!!activeContextPreview && (
              <div ref={contextPreviewRef} className={styles.contextPreviewBubble}>
                <header>
                  <strong>{activeContextPreview.title}</strong>
                  {!!activeContextPreview.language && (
                    <span>{activeContextPreview.language.toUpperCase()}</span>
                  )}
                </header>
                <pre>{activeContextPreview.content}</pre>
              </div>
            )}

            {!!referenceSuggestions.length && (
              <div className={styles.tableMentionDropdown} role="listbox">
                {referenceSuggestions.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={index === highlightedReferenceIndex}
                    className={
                      index === highlightedReferenceIndex
                        ? styles.tableMentionOptionActive
                        : styles.tableMentionOption
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedReferenceIndex(index)}
                    onClick={() => selectReference(option)}
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
