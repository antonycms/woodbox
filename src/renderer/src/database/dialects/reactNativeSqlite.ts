import sqlite from './sqlite';
import type { RendererDialect } from './types';

const reactNativeSqlite: RendererDialect = {
  ...sqlite,
  id: 'react-native-sqlite',
  label: 'RN Sqlite Storage',
  editorDialect: 'sqlite',
  connectionMode: 'react-native-bridge',
};

export default reactNativeSqlite;
