import React from 'react';

export const makeOnChangeSetState = (setState: React.Dispatch<React.SetStateAction<any>>) => {
  if (!setState) return;

  return (event: React.ChangeEvent<any>) => {
    if (!event?.target?.name) {
      console.error('[makeOnChangeSetState] element not has "name" property')
      return;
    }

    const { name, value = null, checked, type } = event?.target || {};

    const v = type === 'checkbox' ? !!checked : value;

    setState?.((prevState) => ({ ...(prevState || {}), [name]: v }));
  };
};

export const getScrollbarWidth = () => {
  // Creating invisible container
  const outer = document.createElement('div');

  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll'; // forcing scrollbar to appear
  (outer.style as any).msOverflowStyle = 'scrollbar'; // needed for WinJS apps

  document.body.appendChild(outer);

  // Creating inner element and placing it in the container
  const inner = document.createElement('div');
  outer.appendChild(inner);

  // Calculating difference between container's full width and the child width
  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

  // Removing temporary elements from the DOM
  outer.parentNode.removeChild(outer);

  return scrollbarWidth;
};

export function getCssValueElementByProperty(element: Element, property: string) {
  return window.getComputedStyle(element, null).getPropertyValue(property);
}

export function calculateTextHtmlWidth(
  text: string,
  options: {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string | number;
  } = {},
) {
  const w = window as any;

  let { fontWeight, fontSize, fontFamily } = options;

  fontFamily = fontFamily || getCssValueElementByProperty(window?.document?.body, 'font-family');
  fontWeight = fontWeight || getCssValueElementByProperty(window?.document?.body, 'font-weight');
  fontSize = fontSize || getCssValueElementByProperty(window?.document?.body, 'font-size');

  if (!w.canvas) w.canvasCalculateText = document.createElement('canvas');

  const canvas: HTMLCanvasElement = w.canvasCalculateText;
  const font = `${fontWeight} ${fontSize} ${fontFamily}`;

  const context = canvas.getContext('2d');
  context.font = font;

  const metrics = context.measureText(text);

  return metrics.width;
}

export function copyToClipboard(value: any) {
  let v = value;

  try {
    if (value instanceof Date) v = value.toISOString();
    else if (typeof value === 'object') v = JSON.stringify(value);

    navigator.clipboard.writeText(String(v));
  } catch (error) {
    console.error(error);
  }
}

export function isElement(o: any) {
  return typeof HTMLElement === 'object'
    ? o instanceof HTMLElement //DOM2
    : o &&
        typeof o === 'object' &&
        o !== null &&
        o.nodeType === 1 &&
        typeof o.nodeName === 'string';
}

export function toCssVar(cssVars: any = {}): React.CSSProperties {
  return Object.keys(cssVars).reduce((acc, key) => ({ ...acc, [`--${key}`]: cssVars[key] }), {});
}
