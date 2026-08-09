import os from 'node:os'
import path from 'node:path'
import { expect, test as base, type Page } from '@playwright/test'

const localSupabaseHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
const blockedAiHosts = ['generativelanguage.googleapis.com', 'aiplatform.googleapis.com']

export const authStateFile = process.env.E2E_AUTH_STATE_FILE?.trim()
  || path.join(os.tmpdir(), 'gurodesk-playwright-auth.json')

const mockedAiStatus = {
  configured: true,
  keyLast4: 'e2e!',
  verifiedAt: '2026-01-01T00:00:00.000Z',
  preferredModel: 'gemini-3.5-flash-lite',
  fallbackModel: 'gemini-3.1-flash-lite',
  fallbackEnabled: true,
}

function isBlockedExternalAiRequest(requestUrl: string) {
  let parsed: URL
  try {
    parsed = new URL(requestUrl)
  } catch {
    return false
  }

  if (blockedAiHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    return true
  }

  // This guard also covers a reused Vite process that was started with a
  // remote Supabase default. The tests must fail closed before a request can
  // reach a non-local project.
  if (parsed.hostname.endsWith('.supabase.co')) return true
  return false
}

function isSupabaseFunction(requestUrl: string) {
  try {
    return new URL(requestUrl).pathname.includes('/functions/v1/')
  } catch {
    return false
  }
}

function isAiSettingsRequest(requestUrl: string) {
  try {
    const parsed = new URL(requestUrl)
    return parsed.pathname.endsWith('/functions/v1/ai-settings')
      && localSupabaseHosts.has(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Install the test-only network boundary before the first navigation.
 *
 * The app still uses the local Supabase REST/Auth APIs for this suite. Only
 * the setup status call is fulfilled so a test account can enter the
 * workspace without a Gemini key; all generation/verification functions and
 * direct Gemini hosts are aborted.
 */
export async function installE2eNetworkGuards(page: Page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    if (isBlockedExternalAiRequest(requestUrl)) {
      await route.abort()
      return
    }

    if (isAiSettingsRequest(requestUrl)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
        },
        body: JSON.stringify(mockedAiStatus),
      })
      return
    }

    // No E2E case should invoke an AI provider. Keeping this explicit makes a
    // future accidental click fail locally instead of using a real key.
    if (isSupabaseFunction(requestUrl)) {
      await route.abort()
      return
    }

    await route.continue()
  })
}

async function visible(page: Page, role: 'heading' | 'textbox', name: RegExp | string, timeout = 4_000) {
  const locator = page.getByRole(role, { name })
  try {
    await locator.waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

async function completeOnboarding(page: Page) {
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible()
  await page.getByLabel('Full name').fill(process.env.E2E_FULL_NAME?.trim() || 'Playwright Teacher')
  await page.getByLabel('School name').fill(process.env.E2E_SCHOOL_NAME?.trim() || 'Playwright Local School')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Your teaching load' })).toBeVisible()
  await page.getByLabel('Sections').fill(process.env.E2E_SECTIONS?.trim() || 'E2E Section')
  await page.getByRole('button', { name: 'Add assignment' }).click()
  await expect(page.getByText('Grade 7 · Mathematics', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open workspace' }).click()
}

async function ensureGrade7MathematicsAssignment(page: Page) {
  await page.goto('/classes')
  await expect(page.getByRole('heading', { name: 'My Classes' })).toBeVisible()

  const matchingRows = page.getByRole('row').filter({ hasText: 'Grade 7' }).filter({ hasText: 'Mathematics' })
  if (await matchingRows.count() === 0) {
    await page.getByRole('button', { name: 'Add assignment' }).click()
    await page.getByLabel('Sections').fill(process.env.E2E_SECTIONS?.trim() || 'E2E Section')
    await page.getByRole('button', { name: 'Save assignment' }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Grade 7' }).filter({ hasText: 'Mathematics' })).toHaveCount(1)
  }

  await page.goto('/')
}

/** Sign in through the real local Supabase-backed form and reach the workspace. */
export async function loginAndOpenWorkspace(page: Page) {
  await page.goto('/')

  if (await visible(page, 'heading', /Good day/i)) {
    await ensureGrade7MathematicsAssignment(page)
    return
  }

  if (await visible(page, 'heading', 'About you')) {
    await completeOnboarding(page)
    await expect(page.getByRole('heading', { name: /Good day/i })).toBeVisible()
    return
  }

  await expect(page.getByRole('heading', { name: /Welcome back|Local preview/i })).toBeVisible()
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL!.trim())
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!.trim())
  await page.getByRole('button', { name: /^Sign in/ }).click()

  // The ai-settings route is mocked above. Seeing this gate means the app was
  // not wired to the local test boundary and should be diagnosed explicitly.
  if (await visible(page, 'heading', /Connect Gemini before opening your workspace/i, 5_000)) {
    throw new Error('The signed-in app reached the Gemini setup gate; verify that local ai-settings mocking is active.')
  }

  if (await visible(page, 'heading', 'About you', 20_000)) {
    await completeOnboarding(page)
  }

  await expect(page.getByRole('heading', { name: /Good day/i })).toBeVisible({ timeout: 30_000 })
  await ensureGrade7MathematicsAssignment(page)
}

export async function openAssessmentList(page: Page) {
  await page.goto('/assessments')
  await expect(page.getByRole('heading', { name: 'Assessments' })).toBeVisible()
  await expect(page.getByText(/Finalized TOS → teacher-reviewed items/)).toBeVisible()
}

export async function createFinalizedTos(page: Page, title: string) {
  await page.goto('/tos/new')
  await expect(page.getByRole('heading', { name: 'New TOS' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('TOS title').fill(title)

  const picker = page.getByRole('button', { name: /Choose verified competencies|verified competenc(?:y|ies) selected/ })
  await picker.click()
  const options = page.locator('#tos-competency-options').getByRole('option')
  await expect(options.first()).toBeVisible({ timeout: 30_000 })
  await options.first().click()
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText('Ready to finalize', { exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Finalize TOS' }).click()
  await expect(page.getByText(/TOS finalized\. Its content and allocations are now locked\./)).toBeVisible({ timeout: 30_000 })

  const id = new URL(page.url()).pathname.match(/^\/tos\/([^/]+)$/)?.[1]
  if (!id) throw new Error(`Finalized TOS did not navigate to a document route: ${page.url()}`)
  return { id, title }
}

export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await installE2eNetworkGuards(page)
    await use(page)
  },
})

export { expect }
