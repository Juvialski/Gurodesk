import { authStateFile, loginAndOpenWorkspace, test } from './fixtures'

test('authenticate the local E2E teacher', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)
  await appPage.context().storageState({ path: authStateFile })
})

