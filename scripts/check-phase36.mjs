import { readFile } from 'node:fs/promises'

let failures = 0
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`) }
const pass = (message) => console.log(`PASS: ${message}`)
const read = (path) => readFile(path, 'utf8')

const pkg = JSON.parse(await read('package.json'))
if (!['0.3.8', '0.3.9', '0.3.10', '0.3.11', '0.4.0'].includes(pkg.version)) fail('package version must be 0.3.8, 0.3.9, 0.3.10, or 0.3.11')
else pass(`package version ${pkg.version}`)
for (const dep of ['docx', 'jspdf']) {
  if (!pkg.dependencies?.[dep]) fail(`missing ${dep} dependency`)
  else pass(`${dep} dependency declared`)
}
if (!pkg.scripts?.['validate:phase36']) fail('missing validate:phase36 script')

const migration = await read('supabase/migrations/202608080009_phase36_export_preferences.sql')
for (const required of ['teacher_export_preferences', 'enable row level security', 'auth.uid() = user_id', 'paper_size']) {
  if (!migration.toLowerCase().includes(required.toLowerCase())) fail(`migration missing ${required}`)
}
pass('export preference migration guards present')

const exportTypes = await read('src/types/export.ts')
for (const required of ['gurodesk_ilaw_standard', "'a4' | 'letter' | 'legal'", 'TeacherExportPreferences', 'LessonPlanExportModel']) {
  if (!exportTypes.includes(required)) fail(`export types missing ${required}`)
}
pass('shared export model defined')

const exporter = await read('src/lib/lessonPlanExport.ts')
for (const required of ['downloadLessonPlanDocx', 'downloadLessonPlanPdf', 'buildLessonPlanExportModel', 'Packer.toBlob', 'new jsPDF']) {
  if (!exporter.includes(required)) fail(`lesson export engine missing ${required}`)
}
if (/DepEd seal|Department of Education seal|logo.*DepEd/i.test(exporter)) fail('exporter must not embed or request a DepEd seal/logo')
else pass('no DepEd seal/logo embedded')

const preview = await read('src/pages/LessonPlanPrintPreviewPage.tsx')
for (const required of ['downloadLessonPlanPdf', 'downloadLessonPlanDocx', 'window.print()', 'LessonPlanDocumentView']) {
  if (!preview.includes(required)) fail(`print preview missing ${required}`)
}
pass('preview supports print, PDF, and Word')

const app = await read('src/App.tsx')
if (!app.includes('lesson-plans/:id/print')) fail('print preview route missing')
else pass('print preview route registered')

const editor = await read('src/pages/LessonPlanEditorPage.tsx')
if (!editor.includes('Preview / download')) fail('lesson editor missing export action')
if (!editor.includes('competency-picker')) fail('Phase 3.5.3 mobile competency picker was lost')
else pass('mobile competency picker retained')

const settings = await read('src/pages/SettingsPage.tsx')
if (!settings.includes('ExportSettingsPanel')) fail('settings page missing export settings')
else pass('export settings exposed')

const repo = await read('src/lib/repository.ts')
for (const required of ['loadTeacherExportPreferences', 'saveTeacherExportPreferences', "from('teacher_export_preferences')"]) {
  if (!repo.includes(required)) fail(`repository missing ${required}`)
}
pass('export preferences persist through repository')

const demo = await read('src/lib/demoStore.ts')
if (!demo.includes('EXPORT_PREFERENCES_KEY')) fail('demo export preferences missing')
else pass('demo export settings supported')

if (failures) {
  console.error(`\nPhase 3.6 validation failed with ${failures} issue(s).`)
  process.exit(1)
}
console.log('\nPhase 3.6 validation passed.')
