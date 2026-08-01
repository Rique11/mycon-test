import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['gateway/**', 'node_modules/**', 'dist/**'],
  },
});
