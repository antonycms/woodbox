import React from 'react';
import { Button } from '@renderer/components/Button';
import { ButtonDropdown, type IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import { Card } from '@renderer/components/Card';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { AddIcon, OptionsIcon, RemoveIcon } from '@renderer/styles/icons';
import AIChat from '@renderer/views/AIChat';
import { AI_CHATS, type IAIChat } from '@renderer/utils/aiChats';
import { ModalAIProviders } from './components/ModalAIProviders';
import styles from './styles.module.css';

const getAIChatTabId = (chatId: string) => `ai_chat_${chatId}`;

const AIMenu = () => {
  const { t } = useI18n();
  const { addTab, getTab, removeTab, setActiveTabId } = useAppTabContext();
  const {
    activeTheme: { __colors, sideBar: colors },
  } = useThemeContext();
  const [filterText, setFilterText] = React.useState('');
  const [showProvidersModal, setShowProvidersModal] = React.useState(false);
  const [chats, setChats] = React.useState(AI_CHATS);
  const [chatToRemove, setChatToRemove] = React.useState<IAIChat>();

  const normalizedFilterText = filterText.trim().toLowerCase();

  const filteredChats = React.useMemo(() => {
    if (!normalizedFilterText) return chats;

    return chats.filter((chat) =>
      [chat.title, chat.summary].join(' ').toLowerCase().includes(normalizedFilterText),
    );
  }, [chats, normalizedFilterText]);

  const openChat = React.useCallback(
    (chat: IAIChat) => {
      const tabId = getAIChatTabId(chat.id);
      const tab = getTab(tabId);

      if (tab) {
        setActiveTabId(tabId);
        return;
      }

      addTab({
        id: tabId,
        title: chat.title,
        data: {
          type: 'ai-chat',
          id_chat: chat.id,
        },
        component: () => <AIChat id_chat={chat.id} />,
      });
    },
    [addTab, getTab, setActiveTabId],
  );

  const handleChatKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, chat: IAIChat) => {
      if (event.key !== 'Enter') return;

      openChat(chat);
    },
    [openChat],
  );

  const optionsMenu = React.useMemo(
    () => [{ id: 'providers', label: t('aiProvider.configureProviders') }],
    [t],
  );

  const handleSelectOption = React.useCallback((option: IButtonDropdownOption) => {
    if (option.id === 'providers') setShowProvidersModal(true);
  }, []);

  const confirmRemoveChat = React.useCallback(() => {
    if (!chatToRemove) return;

    setChats((prevState) => prevState.filter((chat) => chat.id !== chatToRemove.id));
    removeTab(getAIChatTabId(chatToRemove.id), { keepHistory: false });
    setChatToRemove(undefined);
  }, [chatToRemove, removeTab]);

  return (
    <>
      <Modal
        title={t('aiChat.delete')}
        width="420px"
        show={!!chatToRemove}
        closeOutside
        onClose={() => setChatToRemove(undefined)}
      >
        <Text small color={colors.color}>
          {t('aiChat.deleteQuestion', { name: chatToRemove?.title || '' })}
        </Text>

        <Divider size={14} />

        <Row>
          <Button
            xs={12}
            sm={6}
            onClick={() => setChatToRemove(undefined)}
            color={__colors.white}
            backgroundColor={__colors.gray}
          >
            {t('common.cancel')}
          </Button>

          <Button
            xs={12}
            sm={6}
            onClick={confirmRemoveChat}
            color={__colors.white}
            backgroundColor={__colors.red}
          >
            {t('common.delete')}
          </Button>
        </Row>
      </Modal>

      <ModalAIProviders
        show={showProvidersModal}
        onClose={() => setShowProvidersModal(false)}
      />

      <Row>
        <Text bold color={colors.color} userSelect={false}>
          {t('sidebar.ai')}
        </Text>

        <Spacer />

        <Button
          smallIcon
          text
          disabled
          title={t('aiChat.newSoon')}
          color={colors.color}
          icon={() => <AddIcon size={14} />}
        />

        <ButtonDropdown
          smallIcon
          text
          title={t('aiProvider.options')}
          color={colors.color}
          icon={() => <OptionsIcon size={18} />}
          options={optionsMenu}
          onSelect={handleSelectOption}
          align="right"
          dropdownBackground={colors.cardBackgroundColor || colors.fieldBackgroundColor}
          dropdownColor={colors.color}
          dropdownHoverBackground={colors.selectedBackgroundColor}
        />
      </Row>

      <Divider />

      <Input
        placeholder={t('aiChat.filter')}
        value={filterText}
        onChange={(event) => setFilterText(event.target.value)}
        color={colors.fieldColor}
        backgroundColor={colors.fieldBackgroundColor}
        placeholderColor={colors.fieldPlaceholderColor}
      />

      <Divider />

      <div className={styles.list}>
        {!filteredChats.length && (
          <Text userSelect={false} small color={colors.color}>
            {t('aiChat.empty')}
          </Text>
        )}

        {filteredChats.map((chat) => (
          <Card
            key={chat.id}
            role="button"
            tabIndex={0}
            className={styles.card}
            color={colors.color}
            borderColor={__colors.lightGray}
            backgroundColor={colors.cardBackgroundColor || colors.fieldBackgroundColor}
            onClick={() => openChat(chat)}
            onKeyDown={(event) => handleChatKeyDown(event, chat)}
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <strong>{chat.title}</strong>
                <span>{chat.summary}</span>
              </div>

              <Button
                smallIcon
                text
                title={t('common.delete')}
                color={colors.color}
                icon={() => <RemoveIcon size={13} />}
                onClick={(event) => {
                  event.stopPropagation();
                  setChatToRemove(chat);
                }}
              />
            </div>

            <div className={styles.meta}>
              <span>{t('aiChat.messagesCount', { count: chat.messages.length })}</span>
              <span>{new Date(chat.updatedAt).toLocaleDateString()}</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default React.memo(AIMenu);
