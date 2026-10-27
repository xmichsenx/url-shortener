import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Starting the Postgres container can take a while, especially when the
    // image has to be pulled first.
    hookTimeout: 120_000,
  },
});
