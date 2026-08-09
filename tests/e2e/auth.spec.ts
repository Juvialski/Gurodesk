import { expect, loginAndOpenWorkspace, test } from './fixtures'

test.use({ storageState: { cookies: [], origins: [] } })

test('signs in and opens the Supabase dashboard', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)

  await expect(appPage).toHaveURL(/\/$/)
  await expect(appPage.getByRole('heading', { name: /Good day/i })).toBeVisible()
  await expect(appPage.getByText('Protected by RLS policies', { exact: true })).toBeVisible()
})

