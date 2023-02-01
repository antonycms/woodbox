import '@renderer/components/Editor/monacoWorkers';
import '@renderer/components/Editor/monacoTheme';
import '@renderer/components/Editor/autocompleteDefault';
import { initDefaultTheme } from './styles/theme2';

initDefaultTheme();

const setShiftOrControlIsPressed = (e: KeyboardEvent) => {
  window.shiftPressed = e.shiftKey;
  window.ctrlPressed = e.ctrlKey;
};

document.addEventListener('keyup', setShiftOrControlIsPressed);
document.addEventListener('keydown', setShiftOrControlIsPressed);
