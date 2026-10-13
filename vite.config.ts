import { defineConfig } from 'vite';
import pkg from './package.json';

// base: './' — CrazyGames o'yinni o'z CDN papkasidan ochadi, shuning uchun nisbiy yo'llar kerak
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    // editor.html opens the model editor (the dev server also serves it at /editor)
    rollupOptions: { input: { main: 'index.html', editor: 'editor.html' } },
  },
  server: { port: 5173 },
});
