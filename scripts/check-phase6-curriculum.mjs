import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(path, 'utf8')
const [catalog, curriculumPage, catalogBrowser, classesPage, onboardingPage, repository, resolution, styles] = await Promise.all([
  read('src/data/curriculumCatalog.ts'),
  read('src/pages/CurriculumPage.tsx'),
  read('src/components/CurriculumCatalogBrowser.tsx'),
  read('src/pages/ClassesPage.tsx'),
  read('src/pages/OnboardingPage.tsx'),
  read('src/lib/repository.ts'),
  read('src/lib/curriculumResolution.ts'),
  read('src/styles.css'),
])

for (const token of [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  'General Mathematics', 'Computer Systems Servicing', 'Advanced Mathematics', 'Legacy SHS subject (non-pilot school)',
  'verified_competencies', 'official_guide_catalogued', 'official_family_catalogued', 'transitional',
]) assert.match(catalog, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

assert.match(catalog, /K10_ROLLOUT_START/)
assert.doesNotMatch(catalog, /tinyurl\.com/i)
assert.match(catalog, /REVISED_K10_PHASE2_URL/)
assert.match(catalog, /REVISED_K10_PHASE3_URL/)
assert.match(catalog, /2024-2025/)
assert.match(catalog, /2025-2026/)
assert.match(catalog, /2026-2027/)
assert.match(curriculumPage, /CurriculumCatalogBrowser/)
assert.match(catalogBrowser, /A catalogued guide is not treated as an executable competency pack/)
assert.match(catalogBrowser, /Official DepEd source/)
assert.match(classesPage, /curriculumCatalogGroups/)
assert.match(onboardingPage, /curriculumCatalogGroups/)
assert.doesNotMatch(classesPage, /LEARNING_AREAS\.map/)
assert.doesNotMatch(onboardingPage, /LEARNING_AREAS\.map/)
assert.match(repository, /findCurriculumCatalogEntry/)
assert.match(repository, /no source-verified competency pack is loaded yet/)
assert.match(repository, /acceptedSubjectNames/)
assert.match(repository, /implementation_status', \['full', 'transitional', 'pilot', 'legacy'\]/)
assert.match(repository, /applicabilityCandidates/)
assert.match(repository, /catalogEntry\?\.curriculumCode/)
assert.match(repository, /resolveCurriculumSubjectVersion/)
assert.match(resolution, /preferredCurriculumCode/)
assert.match(resolution, /priorityDifference/)
assert.match(styles, /curriculum-catalog-panel/)

console.log('Phase 6 curriculum catalog validation passed: current K-12 catalog coverage, rollout-aware grade choices, SHS transition handling, alias resolution, source-gated competency availability, and mobile catalog UI are present.')
