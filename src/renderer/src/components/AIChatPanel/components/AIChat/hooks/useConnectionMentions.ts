import React from 'react';
import type { IConnection } from '@renderer/contexts/Store';
import {
  escapeRegExp,
  getActiveMention,
  getConnectionMention,
  getConnectionMentionAliases,
  getMentionedConnectionIdsFromText,
} from '../utils/mentions';

interface IUseConnectionMentionsParams {
  connections: IConnection[];
  draftMessage: string;
  setDraftMessage: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

const sanitizePastedText = (value: string) => value.trim();

export const useConnectionMentions = ({
  connections,
  draftMessage,
  setDraftMessage,
  textareaRef,
}: IUseConnectionMentionsParams) => {
  const [selectedMentionIds, setSelectedMentionIds] = React.useState<string[]>([]);
  const [activeMention, setActiveMention] = React.useState<ReturnType<typeof getActiveMention>>();
  const [highlightedMentionIndex, setHighlightedMentionIndex] = React.useState(0);

  const selectedMentionConnections = React.useMemo(
    () =>
      selectedMentionIds
        .map((id) => connections.find((connection) => connection.id === id))
        .filter((connection): connection is IConnection => !!connection),
    [connections, selectedMentionIds],
  );

  const mentionSuggestions = React.useMemo(() => {
    if (!activeMention) return [];

    const query = activeMention.query;
    const selectedIds = new Set(selectedMentionIds);

    return connections
      .filter((connection) => {
        if (selectedIds.has(connection.id)) return false;

        const searchable = [
          connection.description,
          connection.database,
          connection.host,
          getConnectionMention(connection),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return !query || searchable.includes(query);
      })
      .slice(0, 6);
  }, [activeMention, connections, selectedMentionIds]);

  const selectedMentionSuggestion =
    mentionSuggestions[Math.min(highlightedMentionIndex, mentionSuggestions.length - 1)];

  const mentionedConnectionIds = React.useMemo(() => {
    return [
      ...new Set([
        ...selectedMentionIds,
        ...getMentionedConnectionIdsFromText(draftMessage, connections),
      ]),
    ];
  }, [connections, draftMessage, selectedMentionIds]);

  const selectConnectionMention = React.useCallback(
    (connection: IConnection) => {
      if (!activeMention) return;

      const prefix = draftMessage.slice(0, activeMention.start).replace(/\s+$/, '');
      const suffix = draftMessage.slice(activeMention.end).replace(/^\s+/, '');
      const separator = prefix && suffix ? ' ' : '';
      const nextDraftMessage = `${prefix}${separator}${suffix}`;
      const nextCursor = prefix.length + separator.length;

      setDraftMessage(nextDraftMessage);
      setSelectedMentionIds((prevState) => [...new Set([...prevState, connection.id])]);
      setActiveMention(undefined);
      setHighlightedMentionIndex(0);

      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [activeMention, draftMessage, setDraftMessage, textareaRef],
  );

  const removeSelectedMention = React.useCallback(
    (connectionId: string) => {
      const connection = connections.find((item) => item.id === connectionId);

      setSelectedMentionIds((prevState) => prevState.filter((id) => id !== connectionId));

      if (!connection) return;

      setDraftMessage((prevState) => {
        const aliases = getConnectionMentionAliases(connection);

        return aliases
          .reduce((text, alias) => {
            return text.replace(new RegExp(`(^|\\s)${escapeRegExp(alias)}(?=\\s|$)`, 'gi'), '$1');
          }, prevState)
          .replace(/\s{2,}/g, ' ')
          .trimStart();
      });
    },
    [connections, setDraftMessage],
  );

  const handleComposerChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraftMessage(event.target.value);
      setActiveMention(getActiveMention(event.target.value, event.target.selectionStart));
      setHighlightedMentionIndex(0);
    },
    [setDraftMessage],
  );

  const handleComposerPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData.getData('text');
      const sanitizedText = sanitizePastedText(pastedText);

      if (sanitizedText === pastedText) return;

      event.preventDefault();

      const { selectionStart, selectionEnd, value } = event.currentTarget;
      const nextDraftMessage = `${value.slice(0, selectionStart)}${sanitizedText}${value.slice(selectionEnd)}`;
      const nextCursor = selectionStart + sanitizedText.length;

      setDraftMessage(nextDraftMessage);
      setActiveMention(getActiveMention(nextDraftMessage, nextCursor));
      setHighlightedMentionIndex(0);

      window.requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [setDraftMessage, textareaRef],
  );

  const updateActiveMentionFromTextarea = React.useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      setActiveMention(
        getActiveMention(event.currentTarget.value, event.currentTarget.selectionStart),
      );
    },
    [],
  );

  const handleMentionNavigationKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!activeMention || !mentionSuggestions.length) return false;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedMentionIndex((prevState) => (prevState + 1) % mentionSuggestions.length);
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedMentionIndex(
          (prevState) => (prevState - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (selectedMentionSuggestion) {
          selectConnectionMention(selectedMentionSuggestion);
        }
        return true;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveMention(undefined);
        return true;
      }

      return false;
    },
    [activeMention, mentionSuggestions.length, selectConnectionMention, selectedMentionSuggestion],
  );

  const resetSelectedMentions = React.useCallback(() => {
    setSelectedMentionIds([]);
    setActiveMention(undefined);
    setHighlightedMentionIndex(0);
  }, []);

  React.useEffect(() => {
    setHighlightedMentionIndex(0);
  }, [activeMention?.query]);

  React.useEffect(() => {
    if (highlightedMentionIndex >= mentionSuggestions.length) {
      setHighlightedMentionIndex(0);
    }
  }, [highlightedMentionIndex, mentionSuggestions.length]);

  return {
    activeMention,
    highlightedMentionIndex,
    mentionSuggestions,
    mentionedConnectionIds,
    selectedMentionConnections,
    handleComposerChange,
    handleComposerPaste,
    handleMentionNavigationKeyDown,
    removeSelectedMention,
    resetSelectedMentions,
    selectConnectionMention,
    setHighlightedMentionIndex,
    updateActiveMentionFromTextarea,
  };
};
