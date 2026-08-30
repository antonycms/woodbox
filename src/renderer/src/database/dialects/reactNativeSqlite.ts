import sqlite from './sqlite';
import type { RendererDialect } from './types';

const reactNativeSqlite: RendererDialect = {
  ...sqlite,
  id: 'react-native-sqlite',
  label: 'React Native SQLite',
  editorDialect: 'sqlite',
  connectionMode: 'react-native-bridge',
};

export default reactNativeSqlite;
