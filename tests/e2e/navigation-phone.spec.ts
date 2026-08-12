import { expect, loginAndOpenWorkspace, test } from './fixtures'

test('phone navigation keeps the task-first Home → Create → TOS path usable', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)

  await expect(appPage).toHaveTitle(/GuroDesk/i)
  await expect(appPage.getByRole('heading', { name: /Good (?:morning|afternoon|evening)/i })).toBeVisible()
  await expect(appPage.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

  await appPage.getByRole('link', { name: 'Create', exact: true }).click()
  await expect(appPage).toHaveURL(/\/create$/)
  await expect(appPage.getByRole('heading', { name: 'What do you want to create?' })).toBeVisible()

  const tosAction = appPage.getByRole('link', { name: /^TOS\b/i }).first()
  await expect(tosAction).toBeVisible()
  await tosAction.click()
  await expect(appPage).toHaveURL(/\/tos\/new(?:\?.*)?$/)
  await expect(appPage.getByRole('heading', { name: 'New TOS' })).toBeVisible({ timeout: 30_000 })
})
