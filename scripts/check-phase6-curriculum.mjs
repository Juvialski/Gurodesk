import { readFile } from 'node:fs/promises'

const read = (path) => readFile(path, 'utf8')
const fail = (message) => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }

const catalog = await read('src/data/curriculumCatalog.ts')
const browser = await read('src/components/CurriculumCatalogBrowser.tsx')
const classes = await read('src/pages/ClassesPage.tsx')
const onboarding = await read('src/pages/OnboardingPage.tsx')
const curriculum = await read('src/pages/CurriculumPage.tsx')
const repository = await read('src/lib/repository.ts')
const resolution = await read('src/lib/curriculumResolution.ts')

for (const marker of ['REVISED-K10-MATATAG', 'STRENGTHENED-SHS-2026', 'K12-LEGACY-TRANSITION', 'verified_competencies', 'official_guide_catalogued', 'transitional']) {
  assert(catalog.includes(marker), `Curriculum catalog missing ${marker}`)
}
for (const marker of ['curriculumCatalogGroups', 'findCurriculumCatalogEntry', 'Official DepEd reference', 'Source integrity:']) {
  assert(browser.includes(marker) || classes.includes(marker) || onboarding.includes(marker), `Phase 6 curriculum UI missing ${marker}`)
}
assert(classes.includes("sourceKind === 'official'") && classes.includes('customChoices'), 'My Classes must support official and private curriculum assignment sources.')
assert(onboarding.includes('curriculumCatalogGroups') && onboarding.includes("curriculumSourceKind: 'official'"), 'Onboarding must create source-catalogued official assignments and defer private imports to Curriculum Navigator.')
assert(curriculum.includes('CurriculumCatalogBrowser') && curriculum.includes('CustomCurriculumPanel'), 'Curriculum Navigator must expose both official and private curriculum paths.')
assert(repository.includes('findCurriculumCatalogEntry') && repository.includes('resolveCurriculumVersion'), 'Repository must resolve overlapping official versions using catalog metadata.')
assert(repository.includes(".eq('verification_status', 'verified')"), 'Official/custom normalized workflow must continue to load only approved/verified competencies.')
assert(resolution.includes('preferredCurriculumCode') && resolution.includes('subjectNamesMatch'), 'Pure curriculum resolution guard is missing.')
assert(!catalog.toLowerCase().includes('gemini'), 'Official curriculum catalog must not be generated from Gemini/model memory.')
console.log('✓ Phase 6 national curriculum catalog, rollout resolution, and grade-aware teacher setup present')
