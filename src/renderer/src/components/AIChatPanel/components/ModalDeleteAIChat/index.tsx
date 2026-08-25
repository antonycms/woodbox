import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import type { IAIChat } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';

interface IModalDeleteAIChatProps {
  chat?: IAIChat;
  onClose(): void;
  onConfirm(): void;
}

export const ModalDeleteAIChat = React.memo(
  ({ chat, onClose, onConfirm }: IModalDeleteAIChatProps) => {
    const { t } = useI18n();
    const {
      activeTheme: { aiChat: aiChatTheme, mainTab: theme },
    } = useThemeContext();

    return (
      <Modal title={t('aiChat.delete')} width="420px" show={!!chat} closeOutside onClose={onClose}>
        <Text userSelect={false} small color={theme.color}>
          {t('aiChat.deleteQuestion', { name: chat?.title || '' })}
        </Text>

        <Divider size={14} />

        <Row>
          <Button
            xs={12}
            sm={6}
            onClick={onClose}
            color={aiChatTheme.neutralButtonColor}
            backgroundColor={aiChatTheme.neutralButtonBackgroundColor}
          >
            {t('common.cancel')}
          </Button>

          <Button
            xs={12}
            sm={6}
            onClick={onConfirm}
            color={aiChatTheme.neutralButtonColor}
            backgroundColor={aiChatTheme.dangerButtonBackgroundColor}
          >
            {t('common.delete')}
          </Button>
        </Row>
      </Modal>
    );
  },
);

ModalDeleteAIChat.displayName = 'ModalDeleteAIChat';
