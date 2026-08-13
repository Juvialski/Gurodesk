import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const tourKeyPrefix = 'gurodesk.teacher-tour.'

async function openAsFirstTourVisit(page: Page) {
  await page.goto('/')
  await page.evaluate((prefix: string) => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) localStorage.removeItem(key)
    }
  }, tourKeyPrefix)
  await page.reload()
  return page.locator('.teacher-tour-dialog')
}

test('first authenticated visit supports Next, Back, Skip, and persistent dismissal', async ({ appPage }) => {
  const dialog = await openAsFirstTourVisit(appPage)
  await expect(dialog).toBeVisible()
  const welcomeHeading = dialog.getByRole('heading', { name: 'Welcome to GuroDesk' })
  await expect(welcomeHeading).toBeFocused()
  await expect(dialog.getByText('Step 1 of 7', { exact: true })).toBeVisible()

  await appPage.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeFocused()
  await appPage.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Skip tour', exact: true })).toBeFocused()

  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Choose your teaching context' })).toBeFocused()
  await expect(dialog.getByText('Step 2 of 7', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Welcome to GuroDesk' })).toBeFocused()

  await dialog.getByRole('button', { name: 'Skip tour', exact: true }).click()
  await expect(dialog).toBeHidden()
  await appPage.reload()
  await expect(appPage.getByRole('dialog', { name: 'Welcome to GuroDesk' })).toHaveCount(0)
})

test('Finish persists and Replay Tour opens without changing the current route', async ({ appPage }) => {
  const dialog = await openAsFirstTourVisit(appPage)
  for (let step = 1; step < 7; step += 1) {
    await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  }
  await expect(dialog.getByRole('heading', { name: 'You’re ready' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(dialog).toBeHidden()

  await appPage.reload()
  await expect(appPage.getByRole('dialog', { name: 'Welcome to GuroDesk' })).toHaveCount(0)

  await appPage.goto('/results')
  await expect(appPage).toHaveURL(/\/results$/)
  await appPage.getByRole('button', { name: 'Replay Tour', exact: true }).click()
  const replayedTour = appPage.locator('.teacher-tour-dialog')
  await expect(replayedTour.getByRole('heading', { name: 'Welcome to GuroDesk' })).toBeVisible()
  await expect(appPage).toHaveURL(/\/results$/)
  await replayedTour.getByRole('button', { name: 'Skip tour', exact: true }).click()
  await expect(appPage).toHaveURL(/\/results$/)
})

test.describe('unauthenticated entry', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('never opens the teacher tour before authentication', async ({ appPage }) => {
    await appPage.goto('/')
    await expect(appPage.getByRole('heading', { name: /Welcome back|Local preview/i })).toBeVisible()
    await expect(appPage.getByRole('dialog', { name: 'Welcome to GuroDesk' })).toHaveCount(0)
  })
})
