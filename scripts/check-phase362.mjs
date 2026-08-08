import { readFile } from 'node:fs/promises'

const exportCode = await readFile('src/lib/lessonPlanExport.ts', 'utf8')
const view = await readFile('src/components/LessonPlanDocumentView.tsx', 'utf8')
const css = await readFile('src/styles.css', 'utf8')

const fail = (message) => { console.error(`Phase 3.6.2 validation failed: ${message}`); process.exit(1) }

for (const required of [
  'pdfMetaRow(ctx, model.labels.teacher',
  'pdfMetaRow(ctx, model.labels.gradeSection',
  'pdfMetaRow(ctx, model.labels.gradingTerm',
  'pdfMetaRow(ctx, model.labels.curriculumPeriod',
  'pdfSignatoryGrid',
  'const margin = 54',
]) if (!exportCode.includes(required)) fail(`missing ${required}`)

if (exportCode.includes("pdfInfoRow(ctx, 'Lesson Title'")) fail('legacy crowded four-column PDF metadata table is still active')
if (view.includes('<th>Lesson Title</th><td>{model.lesson.title}</td><th>')) fail('preview still uses the old four-column metadata row')
if (!view.includes('<tr><th>{model.labels.teacher}</th><td>{model.identity.teacherName}</td></tr>')) fail('plain two-column preview metadata is missing')
if (!css.includes('.print-meta-table th { width: 28%')) fail('print metadata widths were not updated')
if (css.includes('background: #f2f2f2; text-align: left;')) fail('legacy shaded metadata labels remain')

console.log('Phase 3.6.2 PDF/layout regression checks passed.')
