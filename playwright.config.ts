import os from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const localHosts = new Set(['127.0.0.1', 'localhost', '::1'])

function localUrl(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required for the local Supabase E2E suite.`)
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} must be a valid URL.`)
  }

  if (parsed.protocol !== 'http:' || !localHosts.has(parsed.hostname)) {
    throw new Error(`${label} must point to a local HTTP service; refusing remote Supabase targets.`)
  }

  return parsed.toString().replace(/\/$/, '')
}

function localWebUrl(value: string | undefined) {
  const candidate = value?.trim() || 'http://127.0.0.1:4173'
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('PLAYWRIGHT_BASE_URL must be a valid URL.')
  }

  if (parsed.protocol !== 'http:' || !localHosts.has(parsed.hostname)) {
    throw new Error('PLAYWRIGHT_BASE_URL must point to a local HTTP service.')
  }

  return parsed.toString().replace(/\/$/, '')
}

const supabaseUrl = localUrl(
  process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  'E2E_SUPABASE_URL (or VITE_SUPABASE_URL)',
)
const supabasePublishableKey = (
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY
  || process.env.E2E_SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || ''
).trim()
if (!supabasePublishableKey) {
  throw new Error('E2E_SUPABASE_ANON_KEY (or E2E_SUPABASE_PUBLISHABLE_KEY) is required for the local Supabase E2E suite.')
}

process.env.E2E_EMAIL = process.env.E2E_EMAIL?.trim() || 'phase55-e2e-teacher@example.test'
process.env.E2E_PASSWORD = process.env.E2E_PASSWORD?.trim() || 'Phase55-local-e2e-password-9!'

const baseURL = localWebUrl(process.env.PLAYWRIGHT_BASE_URL)
const webHost = new URL(baseURL).hostname
const webPort = new URL(baseURL).port || '4173'
const authFile = process.env.E2E_AUTH_STATE_FILE?.trim()
  || path.join(os.tmpdir(), 'gurodesk-playwright-auth.json')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  outputDir: path.join(os.tmpdir(), 'gurodesk-playwright-results'),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: `npm run dev -- --host ${webHost} --port ${webPort}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
    env: {
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
    },
  ],
})
