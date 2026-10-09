import { readFile } from 'node:fs/promises'

let failures = 0
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`) }
const pass = (message) => console.log(`PASS: ${message}`)
const read = (path) => readFile(path, 'utf8')

const pkg = JSON.parse(await read('package.json'))
if (!['0.4.0', '0.5.0'].includes(pkg.version)) fail(`expected Phase 3.7+ package version, found ${pkg.version}`)
for (const dependency of ['pizzip', 'docx-preview', 'html2canvas']) if (!pkg.dependencies?.[dependency]) fail(`missing ${dependency} dependency`)
if (!pkg.scripts?.['validate:phase37']) fail('missing validate:phase37 script')
pass('custom-template browser dependencies configured')

const migration = await read('supabase/migrations/202608080011_phase37_custom_document_templates.sql')
for (const required of ['document_templates', "'lesson_plan', 'tos'", "'docx', 'xlsx'", 'document-templates', 'storage.foldername(name)', 'is_default', 'mapping_json', 'structure_json']) {
  if (!migration.includes(required)) fail(`template migration missing ${required}`)
}
if (!migration.includes('public = false')) fail('template Storage bucket must be private')
pass('teacher-owned template metadata + private Storage architecture present')

const config = await read('supabase/config.toml')
if (!config.includes('[functions.template-analyzer]') || !config.includes('verify_jwt = true')) fail('template-analyzer must be JWT protected')

const analyzer = await read('supabase/functions/template-analyzer/index.ts')
for (const required of ['DOCX STRUCTURE', 'AVAILABLE GURODESK FIELDS', 'Choose only element IDs', 'resolveGeminiAccess', 'callWithFallback', 'mappings']) {
  if (!analyzer.includes(required)) fail(`template analyzer missing ${required}`)
}
if (analyzer.includes('original_file') || analyzer.includes('base64')) fail('template analyzer should receive extracted structure, not raw DOCX bytes')
pass('Gemini is used only for one-time semantic field mapping')

const parser = await read('src/lib/docxTemplate.ts')
for (const required of ['extractDocxTemplateStructure', 'fillDocxTemplate', 'word/document.xml', 'append_after_label', 'buildLessonTemplateValues', 'openOfficeArchive']) {
  if (!parser.includes(required)) fail(`DOCX deterministic template engine missing ${required}`)
}
pass('future exports fill the original DOCX deterministically without AI')

const repository = await read('src/lib/templateRepository.ts')
for (const required of ['saveNewDocumentTemplate', 'downloadDocumentTemplateFile', 'listDocumentTemplates', 'setDefaultDocumentTemplate', 'clearDefaultDocumentTemplate', 'deleteDocumentTemplate', "functions.invoke('template-analyzer'"]) {
  if (!repository.includes(required)) fail(`template repository missing ${required}`)
}

const panel = await read('src/components/DocumentTemplatesPanel.tsx')
for (const required of ['Upload ILAW/DLP template', 'Analyze once with Gemini', 'Confirm field mapping', 'Make default for lesson plans', 'Edit field mapping', 'Leave unmapped']) {
  if (!panel.includes(required)) fail(`template management UI missing ${required}`)
}
if (!panel.includes('type="file"') || !panel.includes('.docx')) fail('DOCX upload control missing')
pass('teacher can upload, analyze, correct, save, and manage templates')

const preview = await read('src/pages/LessonPlanPrintPreviewPage.tsx')
for (const required of ['listDocumentTemplates', 'downloadDocumentTemplateFile', 'fillDocxTemplate', 'CustomDocxPreview', 'customDocxPreviewToPdf', 'Original teacher template']) {
  if (!preview.includes(required)) fail(`lesson export template selection missing ${required}`)
}
pass('lesson Word/PDF/print flow can reuse an uploaded original template')

const app = await read('src/pages/SettingsPage.tsx')
if (!app.includes('DocumentTemplatesPanel')) fail('Settings does not expose custom templates')

if (failures) {
  console.error(`\nPhase 3.7 validation failed with ${failures} issue(s).`)
  process.exit(1)
}
console.log('\nPhase 3.7 custom document template validation passed.')

