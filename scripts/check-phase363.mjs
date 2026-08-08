import { readFile } from 'node:fs/promises'

let failures = 0
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`) }
const pass = (message) => console.log(`PASS: ${message}`)
const read = (path) => readFile(path, 'utf8')

const pkg = JSON.parse(await read('package.json'))
if (!['0.3.11', '0.4.0'].includes(pkg.version)) fail(`expected Phase 3.6.3+ package version, found ${pkg.version}`)
if (!pkg.scripts?.['validate:phase363']) fail('missing validate:phase363 script')

const migration = await read('supabase/migrations/202608080010_phase363_multilingual_lesson_support.sql')
for (const required of ['local_language_name', 'document_language', "'match', 'english', 'filipino'"]) {
  if (!migration.includes(required)) fail(`multilingual migration missing ${required}`)
}
pass('multilingual preference migration present')

const teachingTypes = await read('src/types/teachingSetup.ts')
for (const required of ['localLanguageName', "languagePreference: 'Auto'", 'Auto — match subject / lesson text']) {
  if (!teachingTypes.includes(required)) fail(`teaching language settings missing ${required}`)
}

const editor = await read('src/pages/LessonPlanEditorPage.tsx')
if (!editor.includes('localLanguageName: preferences.localLanguageName')) fail('lesson AI context does not pass local language name')

const edge = await read('supabase/functions/lesson-ai-support/index.ts')
for (const required of ['outputLanguageInstruction', 'OUTPUT LANGUAGE RULE', "preference === 'filipino'", "preference === 'english + filipino'", 'subjectIsFilipino', 'Preserve the language of the teacher-authored text']) {
  if (!edge.includes(required)) fail(`AI language enforcement missing ${required}`)
}
pass('Gemini suggestions explicitly follow teacher/lesson language')

const aiField = await read('src/components/AiAssistTextarea.tsx')
for (const required of ["assist('translate', 'Filipino')", "assist('translate', 'English')", 'localLanguageName']) {
  if (!aiField.includes(required)) fail(`translation action missing ${required}`)
}
pass('teacher text can be translated to Filipino, English, or configured local language')

const exportTypes = await read('src/types/export.ts')
for (const required of ["'match' | 'english' | 'filipino'", 'Match lesson language', 'LessonExportLabels']) {
  if (!exportTypes.includes(required)) fail(`export language model missing ${required}`)
}

const exporter = await read('src/lib/lessonPlanExport.ts')
for (const required of ['ILAW BANGHAY-ARALIN', 'KARANASAN SA PAGKATUTO', 'PAGTATAYA SA PAGKATUTO', 'MGA SUSUNOD NA HAKBANG', 'resolveExportLanguage', "includes('filipino')", 'model.labels.department']) {
  if (!exporter.includes(required)) fail(`localized export missing ${required}`)
}
pass('PDF/DOCX exporter supports Filipino labels and automatic matching')

const preview = await read('src/pages/LessonPlanPrintPreviewPage.tsx')
if (!preview.includes('loadTeacherLessonPreferences')) fail('print preview does not load lesson-language preference')
if (!preview.includes('Filipino labels')) fail('print preview does not show resolved label language')

if (failures) {
  console.error(`\nPhase 3.6.3 validation failed with ${failures} issue(s).`)
  process.exit(1)
}
console.log('\nPhase 3.6.3 multilingual lesson support validation passed.')
