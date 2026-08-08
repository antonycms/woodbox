import React from 'react';
import { Button } from '@renderer/components/Button';
import { Card } from '@renderer/components/Card';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { AddIcon, RemoveIcon } from '@renderer/styles/icons';
import { generateHash } from '@renderer/utils/string';
import styles from './styles.module.css';

interface IAIProvider {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
}

interface IModalAIProvidersProps {
  show?: boolean;
  onClose?: () => void;
}

const INITIAL_PROVIDERS: IAIProvider[] = [
  {
    id: 'openai-main',
    name: 'OpenAI principal',
    provider: 'OpenAI',
    model: 'gpt-5-mini',
    apiKey: '',
  },
  {
    id: 'local-agent',
    name: 'Agente local',
    provider: 'Local',
    model: 'woodbox-agent',
    apiKey: '',
  },
];

const emptyProvider = (): IAIProvider => ({
  id: generateHash(),
  name: '',
  provider: '',
  model: '',
  apiKey: '',
});

export const ModalAIProviders = React.memo(({ show, onClose }: IModalAIProvidersProps) => {
  const { t } = useI18n();
  const {
    activeTheme: { __colors, modal: colors },
  } = useThemeContext();
  const [providers, setProviders] = React.useState(INITIAL_PROVIDERS);
  const [editingProvider, setEditingProvider] = React.useState<IAIProvider>();
  const [providerToRemove, setProviderToRemove] = React.useState<IAIProvider>();

  const isEditingProvider = !!editingProvider;

  const close = React.useCallback(() => {
    setEditingProvider(undefined);
    onClose?.();
  }, [onClose]);

  const openNewProvider = React.useCallback(() => {
    setEditingProvider(emptyProvider());
  }, []);

  const handleProviderChange = React.useCallback(
    (key: keyof IAIProvider, value: string) => {
      setEditingProvider((prevState) => (prevState ? { ...prevState, [key]: value } : prevState));
    },
    [],
  );

  const saveProvider = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingProvider) return;

      setProviders((prevState) => {
        const exists = prevState.some((provider) => provider.id === editingProvider.id);

        if (exists) {
          return prevState.map((provider) =>
            provider.id === editingProvider.id ? editingProvider : provider,
          );
        }

        return [...prevState, editingProvider];
      });
      setEditingProvider(undefined);
    },
    [editingProvider],
  );

  const confirmRemoveProvider = React.useCallback(() => {
    if (!providerToRemove) return;

    setProviders((prevState) => prevState.filter((provider) => provider.id !== providerToRemove.id));
    setProviderToRemove(undefined);
  }, [providerToRemove]);

  return (
    <>
      <Modal
        title={t('aiProvider.delete')}
        width="420px"
        show={!!providerToRemove}
        closeOutside
        onClose={() => setProviderToRemove(undefined)}
      >
        <Text small color={colors.color}>
          {t('aiProvider.deleteQuestion', { name: providerToRemove?.name || '' })}
        </Text>

        <Divider size={14} />

        <Row>
          <Button
            xs={12}
            sm={6}
            onClick={() => setProviderToRemove(undefined)}
            color={__colors.white}
            backgroundColor={__colors.gray}
          >
            {t('common.cancel')}
          </Button>

          <Button
            xs={12}
            sm={6}
            onClick={confirmRemoveProvider}
            color={__colors.white}
            backgroundColor={__colors.red}
          >
            {t('common.delete')}
          </Button>
        </Row>
      </Modal>

      <Modal
        show={show}
        closeOutside
        width="620px"
        title={t(isEditingProvider ? 'aiProvider.editTitle' : 'aiProvider.title')}
        onClose={close}
      >
        {!isEditingProvider && (
          <>
            <Row>
              <Text small color={colors.color} userSelect={false}>
                {t('aiProvider.configuredProviders')}
              </Text>

              <Spacer />

              <Button
                smallIcon
                text
                title={t('aiProvider.addProvider')}
                color={colors.color}
                icon={() => <AddIcon size={14} />}
                onClick={openNewProvider}
              />
            </Row>

            <Divider size={8} />

            <div className={styles.providerList}>
              {!providers.length && (
                <Text small color={colors.color} userSelect={false}>
                  {t('aiProvider.empty')}
                </Text>
              )}

              {providers.map((provider) => (
                <Card
                  key={provider.id}
                  role="button"
                  tabIndex={0}
                  className={styles.providerCard}
                  color={colors.color}
                  borderColor={__colors.lightGray}
                  backgroundColor={__colors.darkLightDeep}
                  onClick={() => setEditingProvider(provider)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setEditingProvider(provider);
                  }}
                >
                  <div className={styles.providerCardHeader}>
                    <div className={styles.providerCardTitle}>
                      <strong>{provider.name}</strong>
                      <span>{[provider.provider, provider.model].filter(Boolean).join(' · ')}</span>
                    </div>

                    <Button
                      smallIcon
                      text
                      title={t('common.delete')}
                      color={colors.color}
                      icon={() => <RemoveIcon size={13} />}
                      onClick={(event) => {
                        event.stopPropagation();
                        setProviderToRemove(provider);
                      }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {isEditingProvider && (
          <form onSubmit={saveProvider}>
            <Row>
              <Input
                required
                autoFocus
                label={t('field.name')}
                value={editingProvider.name}
                xs={12}
                md={12}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.fieldLabelColor}
                onChange={(event) => handleProviderChange('name', event.target.value)}
              />

              <Input
                required
                label={t('aiProvider.field.provider')}
                value={editingProvider.provider}
                xs={12}
                sm={6}
                md={6}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.fieldLabelColor}
                onChange={(event) => handleProviderChange('provider', event.target.value)}
              />

              <Input
                required
                label={t('aiProvider.field.model')}
                value={editingProvider.model}
                xs={12}
                sm={6}
                md={6}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.fieldLabelColor}
                onChange={(event) => handleProviderChange('model', event.target.value)}
              />

              <Input
                type="password"
                label={t('aiProvider.field.apiKey')}
                value={editingProvider.apiKey}
                xs={12}
                md={12}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.fieldLabelColor}
                onChange={(event) => handleProviderChange('apiKey', event.target.value)}
              />
            </Row>

            <Divider size={4} />

            <Row>
              <Spacer />

              <Button
                color={colors.cancelButtonColor}
                backgroundColor={colors.cancelButtonBackgroundColor}
                onClick={() => setEditingProvider(undefined)}
                xs={6}
                sm={4}
                md={3}
              >
                {t('common.cancel')}
              </Button>

              <Button
                type="submit"
                color={colors.saveButtonColor}
                backgroundColor={colors.saveButtonBackgroundColor}
                xs={6}
                sm={4}
                md={3}
              >
                {t('common.save')}
              </Button>
            </Row>
          </form>
        )}
      </Modal>
    </>
  );
});

ModalAIProviders.displayName = 'ModalAIProviders';
