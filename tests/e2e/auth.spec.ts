import { expect, loginAndOpenWorkspace, test } from './fixtures'

test.use({ storageState: { cookies: [], origins: [] } })

test('signs in and opens the Supabase dashboard', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)

  await expect(appPage).toHaveURL(/\/$/)
  await expect(appPage.getByRole('heading', { name: /Good (?:morning|afternoon|evening)/i })).toBeVisible()
  await expect(appPage.getByRole('heading', { name: 'What do you want to create?' })).toBeVisible()
  await expect(appPage.getByText('AI assistance is optional', { exact: true })).toBeVisible()
})
