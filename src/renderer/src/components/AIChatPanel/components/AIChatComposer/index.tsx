import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import { IconArrowUp } from '@renderer/styles/icons';
import type { IAIChatConnectionOption, IAIChatModelGroup } from '../../types';
import { getAIModelLabel } from '../../utils/aiModels';
import styles from './styles.module.css';

interface IAIChatComposerProps {
  value: string;
  canSubmit: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  connectionOptions?: IAIChatConnectionOption[];
  modelGroups?: IAIChatModelGroup[];
  selectedConnectionId?: string;
  selectedProviderId?: string;
  selectedModel?: string;
  onConnectionChange?(connectionId: string): void;
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
    connectionOptions = [],
    modelGroups = [],
    selectedConnectionId,
    selectedProviderId,
    selectedModel,
    onConnectionChange,
    onModelChange,
    onSubmit,
    onChange,
    onPaste,
    onClick,
    onKeyUp,
    onKeyDown,
  }: IAIChatComposerProps) => {
    const { t } = useI18n();
    const [openConnections, setOpenConnections] = React.useState(false);
    const [openModels, setOpenModels] = React.useState(false);
    const connectionMenuRef = React.useRef<HTMLDivElement>(null);
    const modelMenuRef = React.useRef<HTMLDivElement>(null);
    const selectedConnectionOptionRef = React.useRef<HTMLButtonElement>(null);
    const selectedModelOptionRef = React.useRef<HTMLButtonElement>(null);

    const activeAIModelLabel = React.useMemo(() => getAIModelLabel(selectedModel), [selectedModel]);
    const activeConnection = React.useMemo(
      () => connectionOptions.find((connection) => connection.id === selectedConnectionId),
      [connectionOptions, selectedConnectionId],
    );

    const hasModelOptions = modelGroups.some((group) => group.models.length);
    const hasConnectionOptions = !!connectionOptions.length;

    const selectConnection = React.useCallback(
      (connectionId: string) => {
        onConnectionChange?.(connectionId);
        setOpenConnections(false);
      },
      [onConnectionChange],
    );

    const selectModel = React.useCallback(
      (providerId: string, model: string) => {
        onModelChange?.(providerId, model);
        setOpenModels(false);
      },
      [onModelChange],
    );

    React.useEffect(() => {
      if (!openConnections && !openModels) return;

      const closeOnOutsideClick = (event: MouseEvent) => {
        if (connectionMenuRef.current?.contains(event.target as Node)) return;
        if (modelMenuRef.current?.contains(event.target as Node)) return;

        setOpenConnections(false);
        setOpenModels(false);
      };

      window.addEventListener('mousedown', closeOnOutsideClick);
      return () => window.removeEventListener('mousedown', closeOnOutsideClick);
    }, [openConnections, openModels]);

    React.useEffect(() => {
      if (openConnections) {
        selectedConnectionOptionRef.current?.scrollIntoView({ block: 'nearest' });
      }

      if (openModels) {
        selectedModelOptionRef.current?.scrollIntoView({ block: 'nearest' });
      }
    }, [openConnections, openModels, selectedConnectionId, selectedModel, selectedProviderId]);

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
                        {connectionOptions.map((connection) => {
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
          </div>
        </form>
      </div>
    );
  },
);

AIChatComposer.displayName = 'AIChatComposer';
