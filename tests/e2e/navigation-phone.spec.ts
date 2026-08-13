import { expect, loginAndOpenWorkspace, test } from './fixtures'

test('phone navigation keeps the task-first Home → Create → TOS path usable', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)

  await expect(appPage).toHaveTitle(/GuroDesk/i)
  await expect(appPage.getByRole('heading', { name: /Good (?:morning|afternoon|evening)/i })).toBeVisible()
  await expect(appPage.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

  await appPage.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Create', exact: true }).click()
  await expect(appPage).toHaveURL(/\/create$/)
  await expect(appPage.getByRole('heading', { name: 'What do you want to create?' })).toBeVisible()

  const tosAction = appPage.getByRole('link', { name: /^TOS\b/i }).first()
  await expect(tosAction).toBeVisible()
  await tosAction.click()
  await expect(appPage).toHaveURL(/\/tos\/new(?:\?.*)?$/)
  await expect(appPage.getByRole('heading', { name: 'New TOS' })).toBeVisible({ timeout: 30_000 })
  await expect(appPage.locator('.workflow-step-card')).toHaveCount(3)
  await expect(appPage.locator('.workflow-curriculum-group').first()).toBeVisible({ timeout: 30_000 })
  const tosCardStyle = await appPage.locator('.workflow-step-card').first().evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, radius: Number.parseFloat(style.borderRadius) }
  })
  expect(tosCardStyle.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(tosCardStyle.radius).toBeGreaterThanOrEqual(10)
  const pageWidth = await appPage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }))
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.innerWidth)
})

test('teacher tour stays inside a phone viewport and restores page scrolling', async ({ appPage }) => {
  await loginAndOpenWorkspace(appPage)

  await appPage.getByRole('button', { name: 'More', exact: true }).click()
  await appPage.getByRole('dialog', { name: 'More' }).getByRole('button', { name: 'Replay Tour', exact: true }).click()
  const dialog = appPage.locator('.teacher-tour-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Welcome to GuroDesk' })).toBeVisible()
  await expect.poll(() => appPage.evaluate(() => document.body.style.overflow)).toBe('hidden')

  for (let step = 0; step < 7; step += 1) {
    const viewport = appPage.viewportSize()!
    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
    const pageWidth = await appPage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }))
    expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.innerWidth)
    if (step < 6) await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  }

  await dialog.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => appPage.evaluate(() => document.body.style.overflow)).toBe('')
})
