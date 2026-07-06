import { defineConfig } from 'vite';

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
});
