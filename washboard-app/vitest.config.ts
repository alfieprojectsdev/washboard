// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/**',
        '*.config.*',
        'dist/',
        '.next/'
      ]
    },
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // PGlite boots a WASM Postgres per test file; the first query can take a few seconds.
    testTimeout: 20000,
    hookTimeout: 30000,
    // Each worker boots its own WASM Postgres; two at a time is plenty.
    maxWorkers: 2,
  },
  resolve: {
    alias: [
      // Every import of the DB pool gets the PGlite-backed stand-in.
      { find: /^@\/lib\/db$/, replacement: path.resolve(__dirname, './src/__tests__/helpers/test-db.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
