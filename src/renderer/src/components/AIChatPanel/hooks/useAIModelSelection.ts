import React from 'react';
import type { IAIChat, IAIProvider } from '@renderer/contexts/Store';
import type { IAIChatModelSelection, IAIChatModelSelectionProps } from '../types';
import { normalizeAIModelList } from '../utils/aiModels';

interface IUseAIModelSelectionParams {
  aiProviders: IAIProvider[];
  chat?: IAIChat;
  chats?: IAIChat[];
  selection?: IAIChatModelSelection;
  onModelChange(providerId: string, model: string): void;
}

const resolveSelection = (
  modelGroups: IAIChatModelSelectionProps['modelGroups'],
  selection?: IAIChatModelSelection,
): IAIChatModelSelection | undefined => {
  if (!selection?.providerId && !selection?.model) return undefined;

  const group =
    modelGroups.find((item) => item.providerId === selection.providerId) ||
    modelGroups.find((item) => item.models.includes(selection.model || ''));

  if (!group) return undefined;

  return {
    providerId: group.providerId,
    model:
      selection.model && group.models.includes(selection.model)
        ? selection.model
        : group.models[0],
  };
};

const resolvePreviousChatSelection = (
  modelGroups: IAIChatModelSelectionProps['modelGroups'],
  chats?: IAIChat[],
) => {
  for (const chat of chats || []) {
    const selection = resolveSelection(modelGroups, {
      providerId: chat.providerId,
      model: chat.model,
    });

    if (selection) return selection;
  }

  return undefined;
};

export const useAIModelSelection = ({
  aiProviders,
  chat,
  chats,
  selection,
  onModelChange,
}: IUseAIModelSelectionParams): IAIChatModelSelectionProps => {
  const modelGroups = React.useMemo(
    () =>
      aiProviders
        .map((provider) => ({
          providerId: provider.id,
          providerName: provider.name,
          models: normalizeAIModelList(provider.models),
        }))
        .filter((group) => group.models.length),
    [aiProviders],
  );

  const resolvedSelection = React.useMemo(() => {
    return (
      resolveSelection(modelGroups, selection) ||
      resolveSelection(modelGroups, chat) ||
      resolvePreviousChatSelection(modelGroups, chats) ||
      resolveSelection(modelGroups, {
        providerId: modelGroups[0]?.providerId,
        model: modelGroups[0]?.models[0],
      })
    );
  }, [chat, chats, modelGroups, selection]);

  return React.useMemo(
    () => ({
      modelGroups,
      selectedProviderId: resolvedSelection?.providerId,
      selectedModel: resolvedSelection?.model,
      onModelChange,
    }),
    [modelGroups, onModelChange, resolvedSelection?.model, resolvedSelection?.providerId],
  );
};
