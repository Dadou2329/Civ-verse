import { defineConfig } from 'vitest/config';
import { civAliases } from './tools/vite/aliases.ts';

export default defineConfig({
  resolve: { alias: civAliases },
  define: { __CIV_STUDIO_AVAILABLE__: 'false' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'civilizations/**/*.test.ts', 'tests/unit/**/*.test.ts', 'tests/acceptance/**/*.test.ts', 'tools/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
