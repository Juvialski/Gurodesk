import { createFinalizedTos, createManualAssessmentDraftFixture, expect, loginAndOpenWorkspace, openAssessmentList, switchToAssessmentCustomize, test } from './fixtures'

test('opens the V2 setup from a finalized TOS and preserves manual draft edits across reloads', async ({ appPage }) => {
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
  await expect(appPage.getByRole('heading', { name: 'Create assessment' })).toBeVisible()
  await expect(appPage.getByRole('heading', { name: 'Choose assessment source' })).toBeVisible()
  const sourceList = appPage.getByRole('listbox', { name: 'Finalized TOS documents' })
  const selectedSource = sourceList.getByRole('option', { name: new RegExp(tosTitle) })
  await expect(selectedSource).toHaveAttribute('aria-selected', 'true')
  await appPage.getByRole('button', { name: /Continue/ }).click()
  await expect(appPage.getByRole('heading', { name: 'Assessment setup' })).toBeVisible()
  await appPage.getByRole('button', { name: /Continue/ }).click()
  await expect(appPage.getByRole('heading', { name: 'Choose question formats' })).toBeVisible()
  await expect(appPage.getByRole('button', { name: /Generate assessment/ })).toBeVisible()

  // Live AI is deliberately blocked in this suite. Seed the editor regression
  // through the real guarded save RPC instead of restoring the removed legacy
  // "Create draft" UI.
  const seeded = await createManualAssessmentDraftFixture(finalizedTos.id, assessmentTitle, 'Directions for the local browser test.')
  await appPage.goto(`/assessments/${seeded.id}`)
  await expect(appPage).toHaveURL(/\/assessments\/[0-9a-f-]+$/)
  await switchToAssessmentCustomize(appPage)
  const sourceContext = appPage.locator('.assessment-editor-context:visible').filter({ hasText: 'Source TOS' })
  await expect(sourceContext).toHaveCount(1)
  await expect(sourceContext).toBeVisible()
  await expect(sourceContext).toContainText(tosTitle)

  const prompt = appPage.getByLabel('Question / prompt')
  await prompt.fill(promptText)
  await appPage.getByRole('button', { name: /Save draft/ }).click()
  await expect(appPage.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible({ timeout: 30_000 })

  await appPage.reload()
  await switchToAssessmentCustomize(appPage)
  await expect(appPage.getByLabel('Question / prompt')).toHaveValue(promptText)

  await openAssessmentList(appPage)
  const card = appPage.locator('article.assessment-card').filter({ hasText: assessmentTitle })
  await expect(card).toHaveCount(1)
  await expect(card.getByRole('heading', { name: assessmentTitle })).toBeVisible()
  await card.getByRole('link', { name: 'Open editor' }).click()
  await switchToAssessmentCustomize(appPage)
  await expect(appPage.getByLabel('Question / prompt')).toHaveValue(promptText)
})
