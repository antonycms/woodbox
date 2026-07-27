import React from 'react';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';

interface IUsePropertiesKeyboardShortcutsParams {
  onRemove(): void;
  onSave(): void;
  onUndo?(): void;
}

const editableTargetTags = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

export function usePropertiesKeyboardShortcuts({
  onRemove,
  onSave,
  onUndo,
}: IUsePropertiesKeyboardShortcutsParams) {
  return React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isEditableTarget = editableTargetTags.has(target?.tagName);

      if (isEditableTarget || target?.isContentEditable) return;

      if (event.key === 'Delete') {
        event.preventDefault();
        onRemove();
        return;
      }

      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onUndo?.();
      }
    },
    [onRemove, onSave, onUndo],
  );
}
