import { expect, loginAndOpenWorkspace, test } from './fixtures'

const deepRoutes = [
  { path: '/create', heading: 'What do you want to create?' },
  { path: '/documents', heading: 'My Files' },
  { path: '/classes', heading: 'Classes' },
  { path: '/assessments', heading: 'Assessments' },
  { path: '/tos', heading: 'Table of Specifications' },
  { path: '/curriculum', heading: 'My Curriculum' },
  { path: '/results', heading: 'Results' },
  { path: '/settings', heading: 'Settings' },
] as const

for (const route of deepRoutes) {
  test(`refreshes ${route.path} without losing the SPA route`, async ({ appPage }) => {
    await loginAndOpenWorkspace(appPage)

    const response = await appPage.goto(route.path, { waitUntil: 'domcontentloaded' })
    expect(response?.status(), `${route.path} should be served by the local Vite fallback`).toBe(200)
    await expect(appPage.getByRole('heading', { name: route.heading })).toBeVisible({ timeout: 30_000 })

    const refreshed = await appPage.reload({ waitUntil: 'domcontentloaded' })
    expect(refreshed?.status(), `${route.path} refresh should be served by the local Vite fallback`).toBe(200)
    await expect(appPage.getByRole('heading', { name: route.heading })).toBeVisible({ timeout: 30_000 })
  })
}
