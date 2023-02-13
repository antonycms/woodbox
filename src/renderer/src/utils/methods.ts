import React from 'react';

export const generateHash = (len = 5) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < len; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
};

export const checkOnlyNumberInString = (text: string) => /^[0-9]*$/.test(text);

export const makeOnChangeSetState = (setState: React.Dispatch<React.SetStateAction<any>>) => {
  if (!setState) return;

  return (event: React.ChangeEvent<any>) => {
    if (!event?.target?.name) return;

    const { target } = event;
    const { name, value = null } = target;

    setState((prevState) => ({
      ...(prevState || {}),
      [name]: value,
    }));
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

export function serializeToSnakeCase(text: string, replaceString = '_', prefix?: string) {
  if (typeof text !== 'string') return text;

  const serializedTextArr = text
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map((s) => s.toLowerCase().trim());

  prefix && serializedTextArr.unshift(prefix);

  return serializedTextArr.join(replaceString);
}
