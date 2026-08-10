import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import { useStoreContext } from '@renderer/contexts/Store';
import { AddIcon, IconApproval, IconArrowUp } from '@renderer/styles/icons';
import styles from './styles.module.css';

interface IAIChatComposerProps {
  value: string;
  canSubmit: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  mentionChips?: React.ReactNode;
  mentionDropdown?: React.ReactNode;
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
    onSubmit,
    onChange,
    onPaste,
    onClick,
    onKeyUp,
    onKeyDown,
  }: IAIChatComposerProps) => {
    const { t } = useI18n();
    const { aiProviders } = useStoreContext();

    const activeAIProvider = React.useMemo(
      () => aiProviders.find((provider) => provider.isDefault) || aiProviders[0],
      [aiProviders],
    );

    const activeAIModelLabel = React.useMemo(() => {
      const model = activeAIProvider?.model.trim();

      if (!model) return undefined;

      return model
        .replace(/^(gpt|claude|gemini)[-_]/i, '')
        .replace(/[-_]/g, ' ');
    }, [activeAIProvider?.model]);

    const focusTextarea = React.useCallback(() => {
      textareaRef?.current?.focus();
    }, [textareaRef]);

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
                    <span className={styles.modelBadge} title={activeAIProvider?.model}>
                      {activeAIModelLabel}
                    </span>
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
