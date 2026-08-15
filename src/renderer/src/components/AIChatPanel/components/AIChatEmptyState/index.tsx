import React from 'react';
import { ButtonDropdown, type IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import { useI18n } from '@renderer/contexts/I18n';
import { type IAIChat, useStoreContext } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { IconAI, OptionsIcon, RemoveIcon } from '@renderer/styles/icons';
import { AIChatComposer } from '../AIChatComposer';
import type {
  IAIChatConnectionOption,
  IAIChatDraftContext,
  IAIChatModelSelectionProps,
  IAIChatReferenceOption,
} from '../../types';
import styles from '../../styles.module.css';

interface IAIChatEmptyStateProps {
  value: string;
  contexts?: IAIChatDraftContext[];
  connectionOptions: IAIChatConnectionOption[];
  referenceOptions: IAIChatReferenceOption[];
  menuOptions: IButtonDropdownOption[];
  modelSelection: IAIChatModelSelectionProps;
  selectedConnectionId?: string;
  onChange(value: string): void;
  onClose(): void;
  onConnectionChange(connectionId: string): void;
  onDeleteChat(chat: IAIChat): void;
  onOpenReference(option: IAIChatReferenceOption): void;
  onRemoveContext(contextId: string): void;
  onSelectChat(chat: IAIChat): void;
  onSelectMenuOption(option: IButtonDropdownOption): void;
  onSubmit(event: React.SubmitEvent<HTMLFormElement>): void;
}

export const AIChatEmptyState = React.memo(
  ({
    value,
    contexts = [],
    connectionOptions,
    referenceOptions,
    menuOptions,
    modelSelection,
    selectedConnectionId,
    onChange,
    onClose,
    onConnectionChange,
    onDeleteChat,
    onOpenReference,
    onRemoveContext,
    onSelectChat,
    onSelectMenuOption,
    onSubmit,
  }: IAIChatEmptyStateProps) => {
    const { t } = useI18n();
    const { aiChats } = useStoreContext();
    const {
      activeTheme: { __colors, mainTab: theme },
    } = useThemeContext();

    const recentChats = React.useMemo(() => aiChats.slice(0, 4), [aiChats]);

    const formatChatAge = React.useCallback((date: string) => {
      const diffInMinutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000));

      if (diffInMinutes < 60) return `${diffInMinutes} min`;

      const diffInHours = Math.round(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours} h`;

      return `${Math.round(diffInHours / 24)} d`;
    }, []);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      },
      [],
    );

    return (
      <div className={styles.emptyState}>
        <div className={styles.recentHeader}>
          <ButtonDropdown
            smallIcon
            text
            title={t('aiProvider.options')}
            color={theme.color}
            icon={() => <OptionsIcon size={18} />}
            options={menuOptions}
            onSelect={onSelectMenuOption}
            align="right"
            dropdownBackground={__colors.darkLightDeep}
            dropdownColor={theme.color}
            dropdownHoverBackground={theme.backgroundColor}
          />

          <button
            className={[styles.iconButton, styles.closePanelButton].join(' ')}
            type="button"
            title={t('aiChat.closePanel')}
            aria-label={t('aiChat.closePanel')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.recentList}>
          {recentChats.map((chat) => (
            <div key={chat.id} className={styles.recentItem}>
              <button type="button" className={styles.chatItemMain} onClick={() => onSelectChat(chat)}>
                <span>{chat.title}</span>
                <time>{formatChatAge(chat.updated_at)}</time>
              </button>

              <button
                type="button"
                className={styles.deleteChatButton}
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => onDeleteChat(chat)}
              >
                <RemoveIcon size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.emptyMark}>
          <IconAI size={44} />
        </div>

        <AIChatComposer
          value={value}
          canSubmit={
            (!!value.trim() || !!contexts.length) &&
            !!modelSelection.selectedProviderId &&
            !!modelSelection.selectedModel &&
            !!selectedConnectionId
          }
          contexts={contexts}
          connectionOptions={connectionOptions}
          referenceOptions={referenceOptions}
          modelGroups={modelSelection.modelGroups}
          selectedConnectionId={selectedConnectionId}
          selectedProviderId={modelSelection.selectedProviderId}
          selectedModel={modelSelection.selectedModel}
          onConnectionChange={onConnectionChange}
          onModelChange={modelSelection.onModelChange}
          onSubmit={onSubmit}
          onChange={(event) => onChange(event.target.value)}
          onOpenReference={onOpenReference}
          onRemoveContext={onRemoveContext}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  },
);

AIChatEmptyState.displayName = 'AIChatEmptyState';
