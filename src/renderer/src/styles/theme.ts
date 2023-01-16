import { DefaultTheme } from 'styled-components';

export interface IThemes {
  dark: DefaultTheme;
}

const themes: IThemes = {
  dark: {
    colors: {
      Purple: '#a277ff',
      PurpleDark: '#3d375e7f',
      BlueTransparent: '#72a1ff59',
      Green: '#61ffca',
      GreenDark: '#54C59F',
      Orange: '#ffca85',
      GreenTransparent: '#aafe661a',
      Pink: '#f694ff',
      Blue: '#82e2ff',
      Red: '#F03C3C',
      White: '#edecee',
      Gray: '#6d6d6d',
      LightGray: '#3838387f',
      Background: '#21202e',
      Dark: '#1C1B22',
      DarkLight: '#44475a3d',
      DarkLight2: '#242329',
      BackgroundContextMenu: '#1B1727',
      border: '#191622',
    },
  },
};

export default themes;

export type ITheme = keyof IThemes;
