import { readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import Icons from 'unplugin-icons/vite';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string };

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [
      svgr(),
      react(),
      Icons({
        compiler: 'jsx',
        autoInstall: true, // baixa o ícone se não estiver instalado
      }),
    ],
  },
});
