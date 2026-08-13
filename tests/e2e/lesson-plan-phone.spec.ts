import { expect, loginAndOpenWorkspace, test } from './fixtures'

const phoneWidths = [360, 390, 412] as const

async function expectNoHorizontalOverflow(page: Parameters<typeof loginAndOpenWorkspace>[0]) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth + 1
    && document.body.scrollWidth <= window.innerWidth + 1
  ))).toBe(true)
}

for (const width of phoneWidths) {
  test(`topic-first lesson flow supports multiple verified alignments at ${width}px`, async ({ appPage }) => {
    await appPage.setViewportSize({ width, height: 844 })
    await loginAndOpenWorkspace(appPage)
    await appPage.goto('/lesson-plans/new')

    await expect(appPage.getByRole('heading', { name: 'New lesson plan' })).toBeVisible()
    await expect(appPage.locator('.workflow-step-card')).toHaveCount(3)
    await expect(appPage.getByText('What are you teaching?', { exact: true })).toBeVisible()

    const lessonFocus = appPage.getByTestId('lesson-focus-input')
    await lessonFocus.fill('Regular and irregular polygons')
    await expect(lessonFocus).toHaveValue('Regular and irregular polygons')

    const picker = appPage.getByRole('button', { name: /Find verified curriculum matches|Add or change curriculum alignment/u })
    await expect(picker).toBeEnabled({ timeout: 30_000 })
    await picker.click()

    const options = appPage.getByRole('option', { name: /polygon/iu })
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeGreaterThanOrEqual(2)
    const secondCompetencyText = await options.nth(1).locator('strong').innerText()
    await options.nth(0).click()
    await options.nth(1).click()
    await appPage.locator('.workflow-picker-summary').getByRole('button', { name: 'Done', exact: true }).click()

    const selected = appPage.getByTestId('selected-lesson-alignments')
    await expect(selected).toContainText('2 verified competencies aligned')
    await selected.getByRole('button', { name: 'Make primary', exact: true }).click()
    await expect(selected.locator('.workflow-selected-alignment.primary')).toContainText(secondCompetencyText)

    const cardStyle = await appPage.locator('.workflow-step-card').first().evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, radius: Number.parseFloat(style.borderRadius) }
    })
    expect(cardStyle.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(cardStyle.radius).toBeGreaterThanOrEqual(10)

    const chipStyle = await appPage.locator('.workflow-chip').first().evaluate((element) => {
      const style = getComputedStyle(element)
      return { minHeight: Number.parseFloat(style.minHeight), radius: Number.parseFloat(style.borderRadius) }
    })
    expect(chipStyle.minHeight).toBeGreaterThanOrEqual(44)
    expect(chipStyle.radius).toBeGreaterThanOrEqual(20)
    await expectNoHorizontalOverflow(appPage)

    await appPage.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(appPage).toHaveURL(/\/lesson-plans\/(?!new(?:\?|$))[^/?]+$/u)
    await appPage.reload()
    await expect(appPage.getByTestId('lesson-focus-input')).toHaveValue('Regular and irregular polygons')
    await expect(appPage.getByTestId('selected-lesson-alignments')).toContainText('2 verified competencies aligned')
    await expect(appPage.getByTestId('selected-lesson-alignments').locator('.workflow-selected-alignment.primary')).toContainText(secondCompetencyText)
    await expectNoHorizontalOverflow(appPage)
  })
}

test('a phone teacher can explicitly save and reopen a topic-only enrichment lesson', async ({ appPage }) => {
  await appPage.setViewportSize({ width: 390, height: 844 })
  await loginAndOpenWorkspace(appPage)
  await appPage.goto('/lesson-plans/new')

  await appPage.getByTestId('lesson-focus-input').fill('Locally developed numeracy enrichment')
  await appPage.getByRole('button', { name: 'Continue without curriculum alignment', exact: true }).click()
  await appPage.getByRole('button', { name: 'Enrichment', exact: true }).click()
  await expect(appPage.getByText(/teacher-provided and not curriculum-aligned/iu)).toBeVisible()
  await expect(appPage.getByRole('button', { name: /Prepare lesson plan/iu })).toBeEnabled()

  await appPage.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(appPage).toHaveURL(/\/lesson-plans\/(?!new(?:\?|$))[^/?]+$/u)
  await appPage.reload()

  await expect(appPage.getByTestId('lesson-focus-input')).toHaveValue('Locally developed numeracy enrichment')
  await expect(appPage.getByRole('button', { name: 'Enrichment', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(appPage.getByTestId('selected-lesson-alignments')).toHaveCount(0)
  await expectNoHorizontalOverflow(appPage)
})

test('switching curriculum periods clears alignments from the previous period', async ({ appPage }) => {
  await appPage.setViewportSize({ width: 390, height: 844 })
  await loginAndOpenWorkspace(appPage)
  await appPage.goto('/lesson-plans/new')

  await appPage.getByTestId('lesson-focus-input').fill('Regular and irregular polygons')
  const picker = appPage.getByRole('button', { name: /Find verified curriculum matches/u })
  await expect(picker).toBeEnabled({ timeout: 30_000 })
  await picker.click()
  const option = appPage.getByRole('option', { name: /polygon/iu }).first()
  await expect(option).toBeVisible()
  await option.click()
  await expect(appPage.getByTestId('selected-lesson-alignments')).toContainText('1 verified competency aligned')

  const periodButtons = appPage.locator('.workflow-step-card').first()
    .locator('.workflow-chip-group').first().getByRole('button')
  expect(await periodButtons.count()).toBeGreaterThanOrEqual(2)
  const firstIsCurrent = await periodButtons.first().getAttribute('aria-pressed') === 'true'
  const nextPeriod = firstIsCurrent ? periodButtons.nth(1) : periodButtons.first()
  await nextPeriod.click()

  await expect(nextPeriod).toHaveAttribute('aria-pressed', 'true')
  await expect(appPage.getByTestId('selected-lesson-alignments')).toHaveCount(0)
  await expect(appPage.getByRole('button', { name: /Prepare lesson plan/iu })).toBeDisabled()
  await expectNoHorizontalOverflow(appPage)
})

test('switching periods preserves an explicit topic-only lesson purpose', async ({ appPage }) => {
  await appPage.setViewportSize({ width: 390, height: 844 })
  await loginAndOpenWorkspace(appPage)
  await appPage.goto('/lesson-plans/new')

  await appPage.getByTestId('lesson-focus-input').fill('Targeted prerequisite review')
  await appPage.getByRole('button', { name: 'Continue without curriculum alignment', exact: true }).click()
  const reviewPurpose = appPage.getByRole('button', { name: 'Review', exact: true })
  await reviewPurpose.click()

  const periodButtons = appPage.locator('.workflow-step-card').first()
    .locator('.workflow-chip-group').first().getByRole('button')
  expect(await periodButtons.count()).toBeGreaterThanOrEqual(2)
  const firstIsCurrent = await periodButtons.first().getAttribute('aria-pressed') === 'true'
  await (firstIsCurrent ? periodButtons.nth(1) : periodButtons.first()).click()

  await expect(reviewPurpose).toHaveAttribute('aria-pressed', 'true')
  await expect(appPage.getByRole('button', { name: /Prepare lesson plan/iu })).toBeEnabled()
  await expect(appPage.getByTestId('selected-lesson-alignments')).toHaveCount(0)
  await expectNoHorizontalOverflow(appPage)
})
