import { readFileSync } from 'node:fs'

const source = readFileSync('tests/e2e/assessment-flow.spec.ts', 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

assert(source.includes("locator('article.tos-list-card').filter({ hasText: tosTitle })"), 'Assessment E2E must scope finalized-TOS assertions to the TOS created by the test.')
assert(source.includes("tosCard.getByText('final', { exact: true })"), 'Assessment E2E final-state assertion must be scoped to the selected TOS card.')
assert(!source.includes("expect(appPage.getByText('final', { exact: true })).toBeVisible()"), 'Assessment E2E must not use a page-global exact `final` locator because other tests may leave finalized TOS cards in the shared local database.')

console.log('✓ Playwright assessment-flow finalized-TOS locator is isolated from other E2E fixtures')
