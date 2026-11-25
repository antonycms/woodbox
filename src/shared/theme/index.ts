import auraTheme from './aura';
import auraLightTheme from './auraLight';
import graphiteTheme from './graphite';
import amberTheme from './amber';
import draculaTheme from './dracula';
import omniTheme from './omni';
import oneDarkProTheme from './oneDarkPro';
import oneLightProTheme from './oneLightPro';
import githubDarkTheme from './githubDark';
import githubLightTheme from './githubLight';
import catppuccinMochaTheme from './catppuccinMocha';
import catppuccinLatteTheme from './catppuccinLatte';

export const builtinThemes = [
  auraTheme,
  auraLightTheme,
  graphiteTheme,
  amberTheme,
  draculaTheme,
  omniTheme,
  oneDarkProTheme,
  oneLightProTheme,
  githubDarkTheme,
  githubLightTheme,
  catppuccinMochaTheme,
  catppuccinLatteTheme,
];

export const builtinThemeNames = builtinThemes.map((theme) => theme.name);
