import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/demo-e2e', timeout: 60_000, expect: { timeout: 15_000 }, workers: 1,
  reporter: 'list', outputDir: './test-results/demo',
  use: { browserName: 'chromium', headless: true, baseURL: 'http://127.0.0.1:4175', screenshot: 'only-on-failure', trace: 'retain-on-failure', serviceWorkers: 'block' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false, timeout: 60_000 },
})
