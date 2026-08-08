import { readFile } from 'node:fs/promises'

let failures = 0
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`) }
const pass = (message) => console.log(`PASS: ${message}`)
const read = (path) => readFile(path, 'utf8')

const pkg = JSON.parse(await read('package.json'))
if (!['0.3.9', '0.3.10', '0.3.11', '0.4.0', '0.5.0'].includes(pkg.version)) fail('package version must support Phase 3.6.1+')
else pass(`package version ${pkg.version}`)

const exporter = await read('src/lib/lessonPlanExport.ts')
const view = await read('src/components/LessonPlanDocumentView.tsx')
const exportTypes = await read('src/types/export.ts')
const settings = await read('src/components/ExportSettingsPanel.tsx')
const visibleExportCode = `${exporter}\n${view}`

for (const forbidden of [
  'AI Use Declaration',
  'Teacher-reviewed assistance',
  'Source provenance',
  'Generated using the GuroDesk',
  'GuroDesk ILAW Standard',
  'independent tool and does not imply DepEd endorsement',
]) {
  if (visibleExportCode.includes(forbidden)) fail(`plain export still contains: ${forbidden}`)
}
if (!failures) pass('generated lesson documents contain no AI/tool/provenance/branding clutter')

for (const required of [
  'ILAW LESSON PLAN',
  'Learning Competency and Curriculum Standards',
  'Learning Objectives',
  'Learner Context',
  'Pre-Lesson',
  'Lesson Flow',
  'Learning Resources',
  'Formative Assessment',
  'Extended Learning Opportunities',
  'Reflection',
  'model.labels.intentions',
  'model.labels.learningExperience',
  'model.labels.assessingLearning',
  'model.labels.waysForward',
]) {
  if (!visibleExportCode.includes(required)) fail(`standard ILAW export missing: ${required}`)
}
pass('standard ILAW section order and fields are present')

if (!exportTypes.includes("label: 'ILAW Standard'")) fail('default export template label must be ILAW Standard')
if (!exportTypes.includes('includeAiDeclaration: false')) fail('legacy AI export preference should default false')
if (!exportTypes.includes('includeSourceProvenance: false')) fail('legacy provenance preference should default false')
else pass('plain ILAW template is the default')

if (settings.includes('Include AI-use declaration') || settings.includes('Include curriculum source provenance')) {
  fail('obsolete export clutter toggles are still exposed in Settings')
} else pass('obsolete document-clutter toggles removed from Settings')

if (failures) {
  console.error(`\nPhase 3.6.1 validation failed with ${failures} issue(s).`)
  process.exit(1)
}
console.log('\nPhase 3.6.1 validation passed.')
