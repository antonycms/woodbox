import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
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
