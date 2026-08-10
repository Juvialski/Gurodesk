import { createFinalizedTos, expect, loginAndOpenWorkspace, openAssessmentList, test } from './fixtures'

test('creates an assessment from a finalized TOS and preserves edits across reloads', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)

  const runId = `${Date.now()}`
  const tosTitle = `E2E TOS ${runId}`
  const assessmentTitle = `E2E Assessment ${runId}`
  const promptText = `E2E authored prompt ${runId}`
  const finalizedTos = await createFinalizedTos(appPage, tosTitle)

  // Finalization should make the source visible in the ordinary TOS list,
  // which is the same list consumed by AssessmentNewPage.
  await appPage.goto('/tos')
  const tosCard = appPage.locator('article.tos-list-card').filter({ hasText: tosTitle })
  await expect(tosCard).toHaveCount(1)
  await expect(tosCard.getByRole('heading', { name: tosTitle })).toBeVisible()
  await expect(tosCard.getByText('final', { exact: true })).toBeVisible()

  await appPage.goto(`/assessments/new?tos=${finalizedTos.id}`)
  await expect(appPage.getByRole('heading', { name: 'New assessment' })).toBeVisible()
  const sourceList = appPage.getByRole('listbox', { name: 'Finalized TOS documents' })
  const selectedSource = sourceList.getByRole('option', { name: new RegExp(tosTitle) })
  await expect(selectedSource).toHaveAttribute('aria-selected', 'true')
  await expect(appPage.getByText(tosTitle, { exact: true }).last()).toBeVisible()

  await appPage.getByLabel('Assessment title').fill(assessmentTitle)
  await appPage.getByLabel('Directions / instructions').fill('Directions for the local browser test.')
  await appPage.getByRole('button', { name: 'Create draft' }).click()

  await expect(appPage).toHaveURL(/\/assessments\/[0-9a-f-]+$/)
  await expect(appPage.getByRole('heading', { name: 'Assessment editor' })).toBeVisible({ timeout: 30_000 })
  await expect(appPage.getByText(tosTitle, { exact: true })).toBeVisible()

  const prompt = appPage.getByLabel('Question / prompt')
  await prompt.fill(promptText)
  await appPage.getByRole('button', { name: /Save draft/ }).click()
  await expect(appPage.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible({ timeout: 30_000 })

  await appPage.reload()
  await expect(appPage.getByRole('heading', { name: 'Assessment editor' })).toBeVisible({ timeout: 30_000 })
  await expect(appPage.getByLabel('Question / prompt')).toHaveValue(promptText)

  await openAssessmentList(appPage)
  const card = appPage.locator('article.assessment-card').filter({ hasText: assessmentTitle })
  await expect(card).toHaveCount(1)
  await expect(card.getByRole('heading', { name: assessmentTitle })).toBeVisible()
  await card.getByRole('link', { name: 'Open editor' }).click()
  await expect(appPage.getByRole('heading', { name: 'Assessment editor' })).toBeVisible()
  await expect(appPage.getByLabel('Question / prompt')).toHaveValue(promptText)
})

