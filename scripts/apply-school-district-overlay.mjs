#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const TARGET_HEAD = 'acdf7c3ac6ab0ed13ce865b020a81de18cd6a693'

async function read(path) {
  return readFile(path, 'utf8')
}

async function write(path, content) {
  await writeFile(path, content, 'utf8')
  console.log(`✓ ${path}`)
}

function normalize(str) {
  return typeof str === 'string' ? str.replace(/\r\n/g, '\n') : ''
}

function replaceOnce(source, search, replacement, label, alreadyApplied = '') {
  if (alreadyApplied && normalize(source).includes(normalize(alreadyApplied))) return source
  if (!normalize(source).includes(normalize(search))) {
    throw new Error(`${label}: expected source text was not found. This overlay targets GuroDesk main ${TARGET_HEAD}; merge this edit surgically if main advanced.`)
  }
  const first = source.indexOf(search)
  if (first === -1) {
    // If exact match with source line endings differed, use normalized replace
    return normalize(source).replace(normalize(search), normalize(replacement))
  }
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`${label}: expected one source match but found multiple; refusing an ambiguous edit.`)
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

async function patchProfileType() {
  const path = 'src/types/app.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  division: string\n  schoolDirectoryId?: string | null`,
    `  division: string\n  district?: string\n  districtSource?: 'deped_official' | 'manual' | 'unknown'\n  districtVerified?: boolean\n  schoolDirectoryId?: string | null`,
    'Profile district fields',
    `districtSource?: 'deped_official' | 'manual' | 'unknown'`,
  )
  await write(path, source)
}

async function patchProfileRepository() {
  const path = 'src/lib/repository.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `    division: String(row.division ?? ''),\n    schoolDirectoryId: row.school_directory_id ? String(row.school_directory_id) : null,`,
    `    division: String(row.division ?? ''),\n    district: String(row.district ?? ''),\n    districtSource: row.district_source === 'deped_official' || row.district_source === 'manual' ? row.district_source : 'unknown',\n    districtVerified: Boolean(row.district_verified),\n    schoolDirectoryId: row.school_directory_id ? String(row.school_directory_id) : null,`,
    'Profile database district mapping',
    `districtVerified: Boolean(row.district_verified)`,
  )
  source = replaceOnce(
    source,
    `      division: profile.division,\n      school_directory_id: profile.schoolDirectoryId ?? null,`,
    `      division: profile.division,\n      district: profile.district ?? '',\n      district_source: profile.districtSource ?? ((profile.district ?? '').trim() ? 'manual' : 'unknown'),\n      district_verified: profile.districtVerified ?? false,\n      school_directory_id: profile.schoolDirectoryId ?? null,`,
    'Profile district persistence',
    `district_source: profile.districtSource`,
  )
  await write(path, source)
}

async function patchLessonExportTypes() {
  const path = 'src/types/export.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  region: string\n  division: string\n}\n\nexport type LessonExportSection`,
    `  region: string\n  division: string\n  district: string\n}\n\nexport type LessonExportSection`,
    'Lesson export district identity',
    `  district: string\n}\n\nexport type LessonExportSection`,
  )
  await write(path, source)
}

async function patchLessonExport() {
  const path = 'src/lib/lessonPlanExport.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `      region: clean(profile.region),\n      division: clean(profile.division),`,
    `      region: clean(profile.region),\n      division: clean(profile.division),\n      district: clean(profile.district),`,
    'Lesson export model district',
    `district: clean(profile.district)`,
  )
  source = replaceOnce(
    source,
    `    ...(model.identity.division ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.division, size: 16, color: TEXT })] })] : []),\n    ...(model.identity.schoolName ?`,
    `    ...(model.identity.division ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.division, size: 16, color: TEXT })] })] : []),\n    ...(model.identity.district ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.district, size: 16, color: TEXT })] })] : []),\n    ...(model.identity.schoolName ?`,
    'Lesson DOCX district header',
    `new TextRun({ text: model.identity.district`,
  )
  source = replaceOnce(
    source,
    `  pdfHeaderLine(ctx, model.identity.division, { size: 8.2, gap: 11 })\n  pdfHeaderLine(ctx, model.identity.schoolName,`,
    `  pdfHeaderLine(ctx, model.identity.division, { size: 8.2, gap: 11 })\n  pdfHeaderLine(ctx, model.identity.district, { size: 8.2, gap: 11 })\n  pdfHeaderLine(ctx, model.identity.schoolName,`,
    'Lesson PDF district header',
    `pdfHeaderLine(ctx, model.identity.district`,
  )
  await write(path, source)
}

async function patchTosExportTypes() {
  const path = 'src/types/tosExport.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  region: string\n  division: string\n}`,
    `  region: string\n  division: string\n  district: string\n}`,
    'TOS export district identity',
    `  district: string\n}\n\n\nexport type TosExportCurriculumGroup`,
  )
  await write(path, source)
}

async function patchTosTemplateTypes() {
  const path = 'src/types/tosTemplate.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  | 'teacherName' | 'teacherPosition' | 'schoolName' | 'region' | 'division'\n`,
    `  | 'teacherName' | 'teacherPosition' | 'schoolName' | 'region' | 'division' | 'district'\n`,
    'TOS template district key',
    `| 'division' | 'district'`,
  )
  source = replaceOnce(
    source,
    `  { key: 'division', label: 'Schools Division', group: 'Identity' },\n`,
    `  { key: 'division', label: 'Schools Division', group: 'Identity' },\n  { key: 'district', label: 'District', group: 'Identity' },\n`,
    'TOS template district field',
    `{ key: 'district', label: 'District', group: 'Identity' }`,
  )
  await write(path, source)
}

async function patchTosExport() {
  const path = 'src/lib/tosExport.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `identity: { teacherName: clean(profile.fullName), positionTitle: clean(profile.positionTitle), schoolName: clean(profile.schoolName), region: clean(profile.region), division: clean(profile.division) },`,
    `identity: { teacherName: clean(profile.fullName), positionTitle: clean(profile.positionTitle), schoolName: clean(profile.schoolName), region: clean(profile.region), division: clean(profile.division), district: clean(profile.district) },`,
    'TOS model district',
    `district: clean(profile.district)`,
  )
  source = replaceOnce(
    source,
    "        `Teacher: ${model.identity.teacherName}`, `School: ${model.identity.schoolName}`,\n        `Grade/Section: ${[model.gradeLevel, model.sections].filter(Boolean).join(' – ')}`, `Learning Area: ${model.learningArea}`,\n        `School Year: ${model.schoolYear}`, `Grading Term: ${model.gradingTerm}`,\n        `Curriculum Period: ${model.curriculumPeriod}`, `Assessment: ${model.assessmentTitle}`,\n        `TOS: ${model.title}`, `Total Items: ${model.totalItems}`,",
    "        `Teacher: ${model.identity.teacherName}`, `School: ${model.identity.schoolName}`,\n        `Region: ${model.identity.region}`, `Schools Division: ${model.identity.division}`,\n        `District: ${model.identity.district}`, `Grade/Section: ${[model.gradeLevel, model.sections].filter(Boolean).join(' – ')}`,\n        `Learning Area: ${model.learningArea}`, `School Year: ${model.schoolYear}`,\n        `Grading Term: ${model.gradingTerm}`, `Curriculum Period: ${model.curriculumPeriod}`,\n        `Assessment: ${model.assessmentTitle}`, `TOS: ${model.title}`,\n        `Total Items: ${model.totalItems}`,",
    'TOS PDF district metadata',
    '`District: ${model.identity.district}`',
  )
  source = replaceOnce(
    source,
    `    region: model.identity.region, division: model.identity.division, gradeLevel: model.gradeLevel, sections: model.sections,`,
    `    region: model.identity.region, division: model.identity.division, district: model.identity.district, gradeLevel: model.gradeLevel, sections: model.sections,`,
    'TOS XLSX district values',
    `district: model.identity.district`,
  )
  await write(path, source)
}

async function patchTosDocx() {
  const path = 'src/lib/tosDocxExport.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `['Teacher', model.identity.teacherName, 'School', model.identity.schoolName],\n    ['Grade / Section',`,
    `['Teacher', model.identity.teacherName, 'School', model.identity.schoolName],\n    ['Schools Division', model.identity.division, 'District', model.identity.district],\n    ['Grade / Section',`,
    'TOS DOCX district metadata',
    `['Schools Division', model.identity.division, 'District', model.identity.district]`,
  )
  source = replaceOnce(
    source,
    `  if (model.identity.division) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [text(model.identity.division, { size: 13 })] }))\n  if (model.identity.schoolName)`,
    `  if (model.identity.division) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [text(model.identity.division, { size: 13 })] }))\n  if (model.identity.district) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [text(model.identity.district, { size: 13 })] }))\n  if (model.identity.schoolName)`,
    'TOS DOCX district header',
    `text(model.identity.district`,
  )
  await write(path, source)
}

async function patchAssessmentExportTypes() {
  const path = 'src/types/assessmentExport.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  region?: string\n  division?: string\n  learnerName?: string`,
    `  region?: string\n  division?: string\n  district?: string\n  learnerName?: string`,
    'Assessment export district option',
    `  district?: string\n  learnerName?: string`,
  )
  source = replaceOnce(
    source,
    `  region: string\n  division: string\n  learnerName?: string`,
    `  region: string\n  division: string\n  district: string\n  learnerName?: string`,
    'Assessment export district metadata',
    `  district: string\n  learnerName?: string`,
  )
  await write(path, source)
}

async function patchAssessmentExportModel() {
  const path = 'src/lib/assessmentExportModel.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `teacherName: clean(options.teacherName), positionTitle: clean(options.positionTitle), schoolName: clean(options.schoolName), region: clean(options.region), division: clean(options.division),`,
    `teacherName: clean(options.teacherName), positionTitle: clean(options.positionTitle), schoolName: clean(options.schoolName), region: clean(options.region), division: clean(options.division), district: clean(options.district),`,
    'Assessment model district metadata',
    `district: clean(options.district)`,
  )
  await write(path, source)
}

async function patchAssessmentPresentation() {
  const path = 'src/lib/assessmentExportPresentation.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  role: 'republic' | 'department' | 'region' | 'division' | 'school'\n`,
    `  role: 'republic' | 'department' | 'region' | 'division' | 'district' | 'school'\n`,
    'Assessment district identity role',
    `| 'district' | 'school'`,
  )
  source = replaceOnce(
    source,
    `  if (text(model.metadata.division)) lines.push({ role: 'division', text: text(model.metadata.division) })\n  if (text(model.metadata.schoolName))`,
    `  if (text(model.metadata.division)) lines.push({ role: 'division', text: text(model.metadata.division) })\n  if (text(model.metadata.district)) lines.push({ role: 'district', text: text(model.metadata.district) })\n  if (text(model.metadata.schoolName))`,
    'Assessment district header line',
    `role: 'district', text: text(model.metadata.district)`,
  )
  await write(path, source)
}

async function patchAssessmentPreview() {
  const path = 'src/pages/AssessmentPrintPreviewPage.tsx'
  let source = await read(path)
  source = replaceOnce(
    source,
    `      region: profile.region,\n      division: profile.division,\n      includeAnswer:`,
    `      region: profile.region,\n      division: profile.division,\n      district: profile.district ?? '',\n      includeAnswer:`,
    'Assessment preview district option',
    `district: profile.district ?? ''`,
  )
  await write(path, source)
}

async function patchDocumentTemplateTypes() {
  const path = 'src/types/documentTemplate.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `  | 'region'\n  | 'division'\n  | 'gradeLevel'`,
    `  | 'region'\n  | 'division'\n  | 'district'\n  | 'gradeLevel'`,
    'Lesson custom-template district key',
    `  | 'district'\n  | 'gradeLevel'`,
  )
  source = replaceOnce(
    source,
    `  { key: 'division', label: 'Schools Division', group: 'Identity' },\n  { key: 'gradeLevel',`,
    `  { key: 'division', label: 'Schools Division', group: 'Identity' },\n  { key: 'district', label: 'District', group: 'Identity' },\n  { key: 'gradeLevel',`,
    'Lesson custom-template district field',
    `{ key: 'district', label: 'District', group: 'Identity' }`,
  )
  await write(path, source)
}

async function patchDocxTemplateValues() {
  const path = 'src/lib/docxTemplate.ts'
  let source = await read(path)
  source = replaceOnce(
    source,
    `    region: model.identity.region,\n    division: model.identity.division,\n    gradeLevel:`,
    `    region: model.identity.region,\n    division: model.identity.division,\n    district: model.identity.district,\n    gradeLevel:`,
    'Lesson custom DOCX district value',
    `district: model.identity.district`,
  )
  await write(path, source)
}

async function patchPackageJson() {
  const path = 'package.json'
  let source = await read(path)
  source = replaceOnce(
    source,
    `"validate:schools": "node scripts/check-school-directory-contract.mjs && node scripts/schools/validate-school-directory.mjs data/schools/philippine-schools.sample.json",`,
    `"validate:schools": "node scripts/check-school-directory-contract.mjs && node scripts/check-school-district-contract.mjs && node scripts/schools/validate-school-directory.mjs data/schools/philippine-schools.sample.json",`,
    'District validator hook',
    `check-school-district-contract.mjs`,
  )
  await write(path, source)
}

async function main() {
  console.log(`Applying school district + mobile A-Z overlay for GuroDesk base ${TARGET_HEAD}`)
  await patchProfileType()
  await patchProfileRepository()
  await patchLessonExportTypes()
  await patchLessonExport()
  await patchTosExportTypes()
  await patchTosTemplateTypes()
  await patchTosExport()
  await patchTosDocx()
  await patchAssessmentExportTypes()
  await patchAssessmentExportModel()
  await patchAssessmentPresentation()
  await patchAssessmentPreview()
  await patchDocumentTemplateTypes()
  await patchDocxTemplateValues()
  await patchPackageJson()
  console.log('✓ District overlay applied. Run validate:schools, typecheck, unit tests, build, and fresh/upgrade migration tests.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
