import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      output: { compact: true },
    },
  },
});
