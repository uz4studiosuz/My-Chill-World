import { defineConfig } from 'vite';

// base: './' — CrazyGames o'yinni o'z CDN papkasidan ochadi, shuning uchun nisbiy yo'llar kerak
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
