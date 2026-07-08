import '@renderer/components/Editor/monacoWorkers';
import { applyMonacoTheme } from './styles/theme';

applyMonacoTheme();

const setShiftOrControlIsPressed = (e: KeyboardEvent) => {
  window.shiftPressed = e.shiftKey;
  window.ctrlPressed = e.ctrlKey;
  window.metaPressed = e.metaKey;
};

document.addEventListener('keyup', setShiftOrControlIsPressed);
document.addEventListener('keydown', setShiftOrControlIsPressed);
