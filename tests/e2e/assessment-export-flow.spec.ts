import { createFinalizedTos, expect, loginAndOpenWorkspace, switchToAssessmentCustomize, test } from './fixtures'

test('saves an assessment, reloads it, and keeps preview/export geometry usable without live AI', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)

  const runId = `${Date.now()}`
  const tos = await createFinalizedTos(appPage, `E2E export TOS ${runId}`, /Classify polygons according to the number of sides.*regular or irregular.*convex or non-convex/i)
  const title = `E2E export assessment ${runId}`
  const promptText = `E2E export prompt ${runId}: Find $\\angle ABC$ when $x=70^\\circ$.`
  const renderedPromptText = `E2E export prompt ${runId}: Find ∠ABC when x=70°.`

  await appPage.goto(`/assessments/new?tos=${tos.id}`)
  await expect(appPage.getByRole('heading', { name: 'New assessment' })).toBeVisible()
  await appPage.getByLabel('Assessment title').fill(title)
  await appPage.getByLabel('Directions / instructions').fill('Use the saved preview for print review.')
  await appPage.getByRole('button', { name: 'Create draft' }).click()
  await expect(appPage).toHaveURL(/\/assessments\/[0-9a-f-]+$/)
  const assessmentId = new URL(appPage.url()).pathname.split('/').pop()!
  await switchToAssessmentCustomize(appPage)

  await appPage.getByLabel('Question / prompt').fill(promptText)
  // Use the deterministic editor fixture so this E2E covers visual persistence
  // without invoking Gemini or accepting arbitrary provider markup.
  await appPage.getByRole('button', { name: 'Add diagram' }).click()
  await expect(appPage.getByTestId('assessment-visual-editor').locator('svg.assessment-diagram')).toBeVisible()
  await appPage.getByRole('button', { name: /Save draft/ }).click()
  await expect(appPage.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible({ timeout: 30_000 })

  // Preview is a separate route consuming the same saved structured model.
  await appPage.goto(`/assessments/${assessmentId}/print`)
  await expect(appPage.getByText('Assessment preview', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(appPage.getByRole('tab', { name: 'Student' })).toHaveAttribute('aria-selected', 'true')
  await expect(appPage.getByText(renderedPromptText, { exact: true })).toBeVisible()
  await expect(appPage.locator('.assessment-print-stage')).not.toContainText('\\angle')
  await expect(appPage.locator('.assessment-print-stage')).not.toContainText('$')
  const previewDiagram = appPage.locator('.assessment-print-stage svg.assessment-document-question-visual').first()
  await expect(previewDiagram).toBeVisible()
  await expect(previewDiagram).toHaveAttribute('viewBox', '0 0 360 240')

  await appPage.setViewportSize({ width: 1280, height: 900 })
  const desktopGeometry = await appPage.locator('.assessment-print-stage .assessment-document').boundingBox()
  expect(desktopGeometry?.width ?? 0).toBeGreaterThan(500)
  const desktopOverflow = await appPage.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(desktopOverflow.scrollWidth).toBeLessThanOrEqual(desktopOverflow.clientWidth + 1)

  // Each mode is a projection of persisted data, not a second editable copy.
  await appPage.getByRole('tab', { name: 'Teacher' }).click()
  await expect(appPage.getByRole('tab', { name: 'Teacher' })).toHaveAttribute('aria-selected', 'true')
  await expect(appPage.getByText('Teacher preview includes answer and review context according to the toggles.', { exact: true })).toBeVisible()
  await appPage.getByRole('tab', { name: 'Answer key' }).click()
  await expect(appPage.getByRole('tab', { name: 'Answer key' })).toHaveAttribute('aria-selected', 'true')

  await appPage.setViewportSize({ width: 390, height: 844 })
  await appPage.reload()
  await expect(appPage.getByText('Assessment preview', { exact: true })).toBeVisible({ timeout: 30_000 })
  const mobileGeometry = await appPage.locator('.assessment-print-stage .assessment-document').boundingBox()
  expect(mobileGeometry?.width ?? 0).toBeGreaterThan(0)
  const mobileOverflow = await appPage.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.clientWidth + 1)

  await appPage.goto(`/assessments/${assessmentId}`)
  await switchToAssessmentCustomize(appPage)
  await expect(appPage.getByLabel('Question / prompt')).toHaveValue(promptText)
  await expect(appPage.getByTestId('assessment-visual-editor').locator('svg.assessment-diagram')).toBeVisible()
})
