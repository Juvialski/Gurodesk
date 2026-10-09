import { test, expect, type Page } from '@playwright/test'
import { wordMaster } from '../fixtures/mailMergeFixtures'

async function guards(page: Page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  })
}
async function openDemo(page: Page) {
  await guards(page); await page.goto('/')
  await page.getByRole('button', { name: 'Open sample teacher workspace' }).click()
  const tour = page.getByRole('dialog', { name: 'Welcome to GuroDesk' })
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/ })).toBeVisible()
  try { await tour.waitFor({ state: 'visible', timeout: 3_000 }); await tour.getByRole('button', { name: 'Skip tour' }).click() } catch { /* Returning demo profiles can already have dismissed the tour. */ }
}

for (const width of [360, 390, 412, 768, 1280]) test(`manual teacher routes have no horizontal overflow at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await openDemo(page)
  for (const route of ['/classes', '/curriculum', '/tos', '/assessments', '/results', '/files', '/documents/merge', '/settings#ai-assistance', '/paperwork']) {
    await page.goto(route)
    await expect(page.locator('h1')).toBeVisible()
    const featureTour = page.locator('[role="dialog"]')
    if (await featureTour.count()) {
      const close = featureTour.getByRole('button', { name: /Skip tour|Close tour|Close/i }).first()
      if (await close.isVisible()) await close.click()
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1)
    await expect(page.getByText('Required Teacher Setup', { exact: true })).toHaveCount(0)
  }
})

test('local demo onboarding proceeds without a key and survives reload', async ({ page }) => {
  await guards(page)
  await page.addInitScript(() => { if (!sessionStorage.getItem('setup-seeded')) { localStorage.setItem('gurodesk.demo.session.v1', 'true'); localStorage.removeItem('gurodesk.demo.profile.v1'); localStorage.removeItem('gurodesk.demo.assignments.v1'); sessionStorage.setItem('setup-seeded', 'true') } })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible()
  await page.getByLabel('Full name').fill('Synthetic Test Teacher')
  await page.getByRole('button', { name: /Continue to AI/ }).click()
  await expect(page.getByRole('heading', { name: 'Optional AI setup' })).toBeVisible()
  await page.getByRole('button', { name: 'Set up later' }).click()
  await page.getByLabel('School name', { exact: true }).fill('Synthetic Teacher School')
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByLabel('Sections', { exact: true }).fill('Test Section')
  await page.getByRole('button', { name: 'Add assignment' }).click()
  await page.getByRole('button', { name: 'Continue to Tour', exact: true }).click()
  await page.getByRole('button', { name: 'Open workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/ })).toBeVisible()
})

test('Word master maps, repeats, previews and downloads editable output on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await openDemo(page); await page.goto('/documents/merge')
  await page.getByLabel('Upload master template').setInputFiles({ name: 'Teacher-Exam.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(await wordMaster()) })
  await expect(page.getByRole('heading', { name: 'Field mappings' })).toBeVisible()
  await page.getByRole('button', { name: 'Add questions record' }).click()
  const record = page.locator('.merge-record').first()
  await record.getByLabel('number').fill('1'); await record.getByLabel('prompt').fill('What is 2 + 2?'); await record.getByLabel('options').fill('A. 3\nB. 4')
  await page.getByRole('button', { name: 'Generate and preview' }).click()
  await expect(page.locator('.merge-word-preview')).toContainText('What is 2 + 2?')
  await expect(page.locator('.merge-word-preview')).toContainText('Sample Integrated School')
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download editable DOCX' }).click()
  expect((await download).suggestedFilename()).toBe('Teacher-Exam.docx')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})
