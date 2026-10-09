import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['tests/e2e/**', 'tests/demo-e2e/**', 'node_modules/**', 'dist/**'],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 15_000,
  },
})
