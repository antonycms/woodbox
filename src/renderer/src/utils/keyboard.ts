type ShortcutEvent = {
  ctrlKey?: boolean;
  metaKey?: boolean;
};

export const isMacOs = () => /Mac/i.test(window.navigator.platform);

export const getPrimaryShortcutKeyLabel = () => (isMacOs() ? 'Command' : 'Ctrl');

export const isPrimaryShortcutPressed = (event?: ShortcutEvent) => {
  if (isMacOs()) return event ? !!event.metaKey : !!window.metaPressed;

  return event ? !!event.ctrlKey : !!window.ctrlPressed;
};
