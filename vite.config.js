import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5390,
    strictPort: true,
  },
  preview: {
    port: 5390,
    strictPort: true,
  },
});
