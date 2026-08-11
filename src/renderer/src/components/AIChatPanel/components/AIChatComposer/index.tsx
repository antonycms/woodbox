import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import { AddIcon, IconApproval, IconArrowUp } from '@renderer/styles/icons';
import type { IAIChatModelGroup } from '../../types';
import { getAIModelLabel } from '../../utils/aiModels';
import styles from './styles.module.css';

interface IAIChatComposerProps {
  value: string;
  canSubmit: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  mentionChips?: React.ReactNode;
  mentionDropdown?: React.ReactNode;
  modelGroups?: IAIChatModelGroup[];
  selectedProviderId?: string;
  selectedModel?: string;
  onModelChange?(providerId: string, model: string): void;
  onSubmit(event: React.FormEvent<HTMLFormElement>): void;
  onChange(event: React.ChangeEvent<HTMLTextAreaElement>): void;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  onClick?: React.MouseEventHandler<HTMLTextAreaElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export const AIChatComposer = React.memo(
  ({
    value,
    canSubmit,
    textareaRef,
    mentionChips,
    mentionDropdown,
    modelGroups = [],
    selectedProviderId,
    selectedModel,
    onModelChange,
    onSubmit,
    onChange,
    onPaste,
    onClick,
    onKeyUp,
    onKeyDown,
  }: IAIChatComposerProps) => {
    const { t } = useI18n();
    const [openModels, setOpenModels] = React.useState(false);
    const modelMenuRef = React.useRef<HTMLDivElement>(null);

    const activeAIModelLabel = React.useMemo(() => getAIModelLabel(selectedModel), [selectedModel]);

    const hasModelOptions = modelGroups.some((group) => group.models.length);

    const focusTextarea = React.useCallback(() => {
      textareaRef?.current?.focus();
    }, [textareaRef]);

    const selectModel = React.useCallback(
      (providerId: string, model: string) => {
        onModelChange?.(providerId, model);
        setOpenModels(false);
      },
      [onModelChange],
    );

    React.useEffect(() => {
      if (!openModels) return;

      const closeOnOutsideClick = (event: MouseEvent) => {
        if (!modelMenuRef.current?.contains(event.target as Node)) {
          setOpenModels(false);
        }
      };

      window.addEventListener('mousedown', closeOnOutsideClick);
      return () => window.removeEventListener('mousedown', closeOnOutsideClick);
    }, [openModels]);

    return (
      <div className={styles.composer}>
        <form className={styles.composerForm} onSubmit={onSubmit}>
          <div className={styles.composerInputWrap}>
            <div className={styles.composerField}>
              <textarea
                autoFocus
                ref={textareaRef}
                value={value}
                placeholder={t('aiChat.composerPlaceholder')}
                aria-label={t('aiChat.composerPlaceholder')}
                onChange={onChange}
                onPaste={onPaste}
                onClick={onClick}
                onKeyUp={onKeyUp}
                onKeyDown={onKeyDown}
              />

              {mentionChips}

              <div className={styles.composerToolbar}>
                <div className={styles.composerActions}>
                  <button
                    className={styles.composerIconButton}
                    type="button"
                    title={t('aiChat.addContext')}
                    aria-label={t('aiChat.addContext')}
                    onClick={focusTextarea}
                  >
                    <AddIcon size={13} />
                  </button>

                  <span className={styles.approvalHint}>
                    <IconApproval size={14} />
                    <span>{t('aiChat.requestApproval')}</span>
                  </span>
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
                    className={styles.sendButton}
                    type="submit"
                    disabled={!canSubmit}
                    title={t('aiChat.send')}
                    aria-label={t('aiChat.send')}
                  >
                    <IconArrowUp size={19} />
                  </button>
                </div>
              </div>
            </div>

            {mentionDropdown}
          </div>
        </form>
      </div>
    );
  },
);

AIChatComposer.displayName = 'AIChatComposer';
