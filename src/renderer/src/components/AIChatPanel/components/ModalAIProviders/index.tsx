import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Card } from '@renderer/components/Card';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import {
  type AIProviderType,
  type IAIProvider,
  type IAIProviderCreate,
  type ICodexChatGPTAccount,
  type ICodexChatGPTLoginStart,
  useStoreContext,
} from '@renderer/contexts/Store';
import { useI18n, type TranslationKey } from '@renderer/contexts/I18n';
import { useToast } from '@renderer/contexts/Toast';
import { useThemeContext } from '@renderer/contexts/Theme';
import { AddIcon, RemoveIcon } from '@renderer/styles/icons';
import styles from './styles.module.css';

type ProviderForm = IAIProviderCreate & {
  hasApiKey?: boolean;
};

const providerOptions: { labelKey: TranslationKey; value: AIProviderType; suggestedModel: string }[] = [
  { labelKey: 'aiProvider.type.openai', value: 'openai', suggestedModel: 'gpt-5-mini' },
  { labelKey: 'aiProvider.type.anthropic', value: 'anthropic', suggestedModel: 'claude-sonnet-4-6' },
  { labelKey: 'aiProvider.type.google', value: 'google', suggestedModel: 'gemini-2.5-flash' },
  { labelKey: 'aiProvider.type.openrouter', value: 'openrouter', suggestedModel: 'openai/gpt-4o' },
  { labelKey: 'aiProvider.type.openaiCompatible', value: 'openai-compatible', suggestedModel: '' },
  { labelKey: 'aiProvider.type.codexChatGPT', value: 'codex-chatgpt', suggestedModel: 'gpt-5.6' },
];

const emptyProvider = (): ProviderForm => ({
  name: '',
  type: 'openai',
  models: ['gpt-5-mini'],
  apiKey: '',
  baseURL: '',
});

const toProviderForm = (provider: IAIProvider): ProviderForm => ({
  id: provider.id,
  name: provider.name,
  type: provider.type,
  models: provider.models,
  apiKey: '',
  baseURL: provider.baseURL || '',
  hasApiKey: provider.hasApiKey,
});

interface IModalAIProvidersProps {
  show?: boolean;
  onClose?: () => void;
}

export const ModalAIProviders = React.memo(({ show, onClose }: IModalAIProvidersProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const {
    aiProviders,
    addAIProvider,
    editAIProvider,
    removeAIProvider,
    testAIProvider,
    getCodexChatGPTAccount,
    startCodexChatGPTLogin,
    logoutCodexChatGPT,
  } = useStoreContext();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();
  const [editingProvider, setEditingProvider] = React.useState<ProviderForm>();
  const [providerToRemove, setProviderToRemove] = React.useState<IAIProvider>();
  const [codexAccount, setCodexAccount] = React.useState<ICodexChatGPTAccount>();
  const [codexLogin, setCodexLogin] = React.useState<ICodexChatGPTLoginStart>();
  const [loadingTest, setLoadingTest] = React.useState(false);
  const [loadingSave, setLoadingSave] = React.useState(false);
  const [loadingCodexAccount, setLoadingCodexAccount] = React.useState(false);
  const [loadingCodexLogin, setLoadingCodexLogin] = React.useState(false);

  const isEditingProvider = !!editingProvider;
  const selectedProviderOption = providerOptions.find((item) => item.value === editingProvider?.type);
  const showBaseURL = editingProvider?.type === 'openai-compatible';
  const isCodexProvider = editingProvider?.type === 'codex-chatgpt';
  const apiKeyHelp = editingProvider?.hasApiKey ? t('aiProvider.apiKeyKeepHelp') : undefined;
  const editingProviderModels = editingProvider?.models?.length ? editingProvider.models : [''];

  const close = React.useCallback(() => {
    setEditingProvider(undefined);
    onClose?.();
  }, [onClose]);

  const openNewProvider = React.useCallback(() => {
    setEditingProvider(emptyProvider());
  }, []);

  const handleProviderChange = React.useCallback(
    <Key extends keyof ProviderForm>(key: Key, value: ProviderForm[Key]) => {
      setEditingProvider((prevState) => (prevState ? { ...prevState, [key]: value } : prevState));
    },
    [],
  );

  const handleTypeChange = React.useCallback(
    (event: { value: string | number | null }) => {
      const type = event.value as AIProviderType;
      const option = providerOptions.find((item) => item.value === type);

      setEditingProvider((prevState) =>
        prevState
          ? {
              ...prevState,
              type,
              models: [option?.suggestedModel || ''],
              baseURL: type === 'openai-compatible' ? prevState.baseURL : '',
              apiKey: type === 'codex-chatgpt' ? '' : prevState.apiKey,
            }
          : prevState,
      );
    },
    [],
  );

  const updateProviderModels = React.useCallback((models: string[]) => {
    const nextModels = models.length ? models : [''];

    setEditingProvider((prevState) =>
      prevState
        ? {
            ...prevState,
            models: nextModels,
          }
        : prevState,
    );
  }, []);

  const handleModelChange = React.useCallback(
    (index: number, value: string) => {
      updateProviderModels(
        editingProviderModels.map((model, modelIndex) => (modelIndex === index ? value : model)),
      );
    },
    [editingProviderModels, updateProviderModels],
  );

  const addModel = React.useCallback(() => {
    updateProviderModels([...editingProviderModels, '']);
  }, [editingProviderModels, updateProviderModels]);

  const removeModel = React.useCallback(
    (index: number) => {
      updateProviderModels(editingProviderModels.filter((_, modelIndex) => modelIndex !== index));
    },
    [editingProviderModels, updateProviderModels],
  );

  const getProviderTypeLabel = React.useCallback(
    (type: AIProviderType) => {
      const option = providerOptions.find((item) => item.value === type);

      return option ? t(option.labelKey) : type;
    },
    [t],
  );

  const getModelCountLabel = React.useCallback(
    (count: number) => t(count === 1 ? 'aiProvider.modelCountOne' : 'aiProvider.modelCountMany', { count }),
    [t],
  );

  const saveProvider = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingProvider) return;

      try {
        setLoadingSave(true);

        if (editingProvider.id) {
          await editAIProvider(editingProvider.id, editingProvider);
        } else {
          await addAIProvider(editingProvider);
        }

        showToast({ type: 'success', title: t('aiProvider.saved') });
        setEditingProvider(undefined);
      } catch (error) {
        showToast({
          type: 'error',
          title: t('aiProvider.saveFailed'),
          description: error.message,
        });
      } finally {
        setLoadingSave(false);
      }
    },
    [addAIProvider, editAIProvider, editingProvider, showToast, t],
  );

  const checkProvider = React.useCallback(async () => {
    if (!editingProvider) return;

    try {
      setLoadingTest(true);
      await testAIProvider(editingProvider);
      showToast({ type: 'success', title: t('aiProvider.testSuccess') });
    } catch (error) {
      showToast({
        type: 'error',
        title: t('aiProvider.testFailed'),
        description: error.message,
      });
    } finally {
      setLoadingTest(false);
    }
  }, [editingProvider, showToast, t, testAIProvider]);

  const loadCodexAccount = React.useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingCodexAccount(true);

      const account = await getCodexChatGPTAccount();

      setCodexAccount(account);
      if (account.authenticated) setCodexLogin(undefined);
    } catch (error) {
      if (!silent) {
        showToast({
          type: 'error',
          title: t('aiProvider.codexStatusFailed'),
          description: error.message,
        });
      }
    } finally {
      if (!silent) setLoadingCodexAccount(false);
    }
  }, [getCodexChatGPTAccount, showToast, t]);

  const startCodexLogin = React.useCallback(async () => {
    try {
      setLoadingCodexLogin(true);
      const login = await startCodexChatGPTLogin();

      setCodexLogin(login);
      window.open(login.verificationUrl, '_blank');
    } catch (error) {
      showToast({
        type: 'error',
        title: t('aiProvider.codexLoginFailed'),
        description: error.message,
      });
    } finally {
      setLoadingCodexLogin(false);
    }
  }, [showToast, startCodexChatGPTLogin, t]);

  const logoutCodex = React.useCallback(async () => {
    try {
      setLoadingCodexAccount(true);
      await logoutCodexChatGPT();
      setCodexLogin(undefined);
      await loadCodexAccount();
    } catch (error) {
      showToast({
        type: 'error',
        title: t('aiProvider.codexLogoutFailed'),
        description: error.message,
      });
    } finally {
      setLoadingCodexAccount(false);
    }
  }, [loadCodexAccount, logoutCodexChatGPT, showToast, t]);

  const confirmRemoveProvider = React.useCallback(async () => {
    if (!providerToRemove) return;

    try {
      await removeAIProvider(providerToRemove.id);
      showToast({ type: 'success', title: t('aiProvider.removed') });
    } catch (error) {
      showToast({
        type: 'error',
        title: t('aiProvider.removeFailed'),
        description: error.message,
      });
    } finally {
      setProviderToRemove(undefined);
    }
  }, [providerToRemove, removeAIProvider, showToast, t]);

  React.useEffect(() => {
    if (show && editingProvider?.type === 'codex-chatgpt') {
      loadCodexAccount();
    }
  }, [editingProvider?.type, loadCodexAccount, show]);

  React.useEffect(() => {
    if (!show || !isCodexProvider || !codexLogin || codexAccount?.authenticated) return;

    const interval = setInterval(() => loadCodexAccount(true), 3000);

    return () => clearInterval(interval);
  }, [codexAccount?.authenticated, codexLogin, isCodexProvider, loadCodexAccount, show]);

  return (
    <>
      <Modal
        title={t('aiProvider.delete')}
        width="420px"
        show={!!providerToRemove}
        closeOutside
        onClose={() => setProviderToRemove(undefined)}
      >
        <Text small color={colors.color} userSelect={false}>
          {t('aiProvider.deleteQuestion', { name: providerToRemove?.name || '' })}
        </Text>

        <Divider size={14} />

        <Row>
          <Button
            xs={12}
            sm={6}
            onClick={() => setProviderToRemove(undefined)}
            color={colors.neutralButtonColor}
            backgroundColor={colors.neutralButtonBackgroundColor}
          >
            {t('common.cancel')}
          </Button>

          <Button
            xs={12}
            sm={6}
            onClick={confirmRemoveProvider}
            color={colors.neutralButtonColor}
            backgroundColor={colors.dangerButtonBackgroundColor}
          >
            {t('common.delete')}
          </Button>
        </Row>
      </Modal>

      <Modal
        show={show}
        closeOutside
        width="440px"
        maxHeight="500px"
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
              {!aiProviders.length && (
                <Text small color={colors.color} userSelect={false}>
                  {t('aiProvider.empty')}
                </Text>
              )}

              {aiProviders.map((provider) => (
                <Card
                  key={provider.id}
                  role="button"
                  tabIndex={0}
                  className={styles.providerCard}
                  color={colors.color}
                  borderColor={colors.borderColor}
                  backgroundColor={colors.panelBackgroundColor}
                  onClick={() => setEditingProvider(toProviderForm(provider))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setEditingProvider(toProviderForm(provider));
                  }}
                >
                  <div className={styles.providerCardHeader}>
                    <div className={styles.providerCardTitle}>
                      <strong>{provider.name}</strong>
                      <span>
                        {[
                          getProviderTypeLabel(provider.type),
                          getModelCountLabel(provider.models.length),
                          provider.baseURL,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
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
                md={6}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.fieldLabelColor}
                onChange={(event) => handleProviderChange('name', event.target.value)}
              />

              <Autocomplete
                required
                clearable={false}
                data={providerOptions}
                label={t('aiProvider.field.provider')}
                value={editingProvider.type}
                extractLabel={(item) => t(item.labelKey)}
                extractValue={(item) => item.value}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                md={6}
                onChange={handleTypeChange}
              />

              {isCodexProvider && (
                <Card
                  color={colors.color}
                  borderColor="transparent"
                  style={{ padding: '0 0 0 8px' }}
                  backgroundColor={colors.panelBackgroundColor}
                  className={styles.codexCard}
                >
                  <div className={styles.codexStatusRow}>
                    <Text small color={colors.color} userSelect={false}>
                      {codexAccount?.authenticated
                        ? t('aiProvider.codexConnected', {
                            email: codexAccount.email || t('aiProvider.codexUnknownEmail'),
                          })
                        : t('aiProvider.codexDisconnected')}
                    </Text>

                    {codexAccount?.authenticated && (
                      <Button
                        text
                        width="52px"
                        loading={loadingCodexAccount}
                        color={colors.cancelButtonBackgroundColor}
                        onClick={logoutCodex}
                      >
                        {t('aiProvider.codexLogout')}
                      </Button>
                    )}

                    {!codexAccount?.authenticated && !codexLogin && (
                      <Button
                        text
                        width="64px"
                        loading={loadingCodexLogin}
                        color={colors.testButtonBackgroundColor}
                        onClick={startCodexLogin}
                      >
                        {t('aiProvider.codexLogin')}
                      </Button>
                    )}
                  </div>

                  {!!codexLogin && !codexAccount?.authenticated && (
                    <div className={styles.codexLoginInfo}>
                      <Text small color={colors.color} userSelect={false}>
                        {t('aiProvider.codexDeviceCode')}
                      </Text>
                      <strong>{codexLogin.userCode}</strong>
                      <button type="button" onClick={() => window.open(codexLogin.verificationUrl, '_blank')}>
                        {codexLogin.verificationUrl}
                      </button>
                    </div>
                  )}

                </Card>
              )}

              {showBaseURL && (
                <Input
                  required
                  label={t('aiProvider.field.baseURL')}
                  value={editingProvider.baseURL}
                  placeholder="http://localhost:11434/v1"
                  md={12}
                  color={colors.fieldColor}
                  backgroundColor={colors.fieldBackgroundColor}
                  labelColor={colors.fieldLabelColor}
                  onChange={(event) => handleProviderChange('baseURL', event.target.value)}
                />
              )}

              {!isCodexProvider && (
                <Input
                  type="password"
                  label={t('aiProvider.field.apiKey')}
                  value={editingProvider.apiKey}
                  placeholder={apiKeyHelp}
                  required={!editingProvider.hasApiKey && editingProvider.type !== 'openai-compatible'}
                  md={12}
                  color={colors.fieldColor}
                  backgroundColor={colors.fieldBackgroundColor}
                  labelColor={colors.fieldLabelColor}
                  onChange={(event) => handleProviderChange('apiKey', event.target.value)}
                />
              )}

                {/* <Text small color={colors.color} userSelect={false}>
                  {t('aiProvider.field.models')}
                </Text> */}

                {editingProviderModels.map((model, index) => (
                  <Row key={index}>
                    <Input
                      required
                      label={t('aiProvider.field.model') + (index ? ` ${index + 1}` : '')}
                      value={model}
                      md={12}
                      color={colors.fieldColor}
                      backgroundColor={colors.fieldBackgroundColor}
                      labelColor={colors.fieldLabelColor}
                      onChange={(event) => handleModelChange(index, event.target.value)}
                      icon={
                        index > 0
                          ? () => (
                              <RemoveIcon
                                size={13}
                                cursor="pointer"
                                color={colors.color}
                                title={t('aiProvider.removeModel')}
                                onClick={() => removeModel(index)}
                              />
                            )
                          : undefined
                      }
                    />

                  </Row>
                ))}

                <Button
                  text
                  color={colors.color}
                  width="fit-content"
                  icon={() => <AddIcon size={13} />}
                  onClick={addModel}
                >
                  {t('aiProvider.addModel')}
                </Button>
            </Row>

            <Divider size={4} />

            <Row>
              <Button
                color={colors.testButtonColor}
                backgroundColor={colors.testButtonBackgroundColor}
                loading={loadingTest}
                onClick={checkProvider}
                xs={6}
                sm={4}
                md={3}
              >
                {t('common.test')}
              </Button>

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
                loading={loadingSave}
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
