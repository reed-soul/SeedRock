import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5390,
    strictPort: true,
  },
  preview: {
    port: 5390,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        examples: path.resolve(__dirname, 'examples.html'),
      },
    },
  },
});
