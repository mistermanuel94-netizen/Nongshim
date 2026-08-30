import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The build tests read dist/ from the project root.
    root: '.',
  },
});
