import { serializeToSnakeCase } from '../utils/methods';

const defaultColors = {
  purple: '#a277ff',
  purpleDark: '#3d375e7f',
  blueTransparent: '#72a1ff59',
  green: '#61ffca',
  greenDark: '#54C59F',
  orange: '#ffca85',
  orange2: '#E79E3F',
  greenTransparent: '#aafe661a',
  pink: '#f694ff',
  blue: '#82e2ff',
  red: '#ff6767',
  red2: '#E73C3C',
  white: '#edecee',
  gray: '#6d6d6d',
  lightGray: '#3838387f',
  background: '#21202e',
  dark: '#1c1b22',
  darkLight: '#44475a3d',
  darkLight2: '#242329',
  backgroundContextMenu: '#1b1727',
  border: '#191622',
  transparent: 'transparent',
};

export type IColors = typeof defaultColors;

const serializeCssVarName = (colorName: string) => {
  return `--color-${serializeToSnakeCase(colorName, '-')}`;
};

export const applyCssColors = (colors: IColors = defaultColors) => {
  Object.keys(colors).forEach((colorName) => {
    const serializedCssVarName = serializeCssVarName(colorName);
    const hexColor = colors[colorName];

    document.documentElement.style.setProperty(serializedCssVarName, hexColor);
  });
};

export const getHexadecimalColors = () => {
  const colors = Object.keys(theme).reduce((acc, colorName) => {
    let colorCssVar = theme[colorName] as string;
    colorCssVar = colorCssVar.replace(/var|\(|\)/g, '');

    const hexColor = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(colorCssVar)
      .trim();

    return { ...acc, [colorName]: hexColor };
  }, {} as IColors);

  return colors;
};

const theme = Object.keys(defaultColors).reduce((acc, colorName) => {
  const serializedCssVarName = `var(${serializeCssVarName(colorName)})`;

  return { ...acc, [colorName]: serializedCssVarName };
}, {} as IColors);

applyCssColors(defaultColors);

export default theme;
