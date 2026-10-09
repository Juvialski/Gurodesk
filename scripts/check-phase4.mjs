import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import PizZip from 'pizzip'
import { Unzip, UnzipInflate } from 'fflate'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

async function loadAllocationEngine() {
  const source = read('src/lib/tosAllocation.ts')
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

async function loadTosPagination() {
  const source = read('src/lib/tosPdfPagination.ts')
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

async function loadXlsxEngine() {
  const source = read('src/lib/xlsxTemplate.ts')
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  output = output
    .replace("import { openOfficeArchive } from './officeArchive';", 'const openOfficeArchive = globalThis.__phase4OpenOfficeArchive;')
    .replace("import PizZip from 'pizzip';", 'const PizZip = globalThis.__phase4PizZip;')
    .replace("import { sha256Hex } from './docxTemplate';", 'const sha256Hex = globalThis.__phase4Sha256Hex;')
  globalThis.__phase4PizZip = PizZip
  let archiveSource = ts.transpileModule(read('src/lib/officeArchive.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  archiveSource = archiveSource.replace("import PizZip from 'pizzip';", 'const PizZip = globalThis.__phase4PizZip;')
    .replace("import { Unzip, UnzipInflate } from 'fflate';", 'const { Unzip, UnzipInflate } = globalThis.__phase4Fflate;')
  globalThis.__phase4Fflate = { Unzip, UnzipInflate }
  globalThis.__phase4OpenOfficeArchive = (await import('data:text/javascript;base64,' + Buffer.from(archiveSource).toString('base64'))).openOfficeArchive
  globalThis.DOMParser = DOMParser
  globalThis.XMLSerializer = XMLSerializer
  globalThis.__phase4PizZip = PizZip
  globalThis.__phase4Sha256Hex = async (buffer) => createHash('sha256').update(Buffer.from(buffer)).digest('hex')
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const parseXml = (raw) => new DOMParser().parseFromString(raw, 'application/xml')
const elementsNamed = (xml, name) => Array.from(xml.getElementsByTagNameNS('*', name))
const cellAt = (xml, address) => elementsNamed(xml, 'c').find((cell) => cell.getAttribute('r') === address)
const cellValue = (xml, address) => {
  const cell = cellAt(xml, address)
  if (!cell) return undefined
  return elementsNamed(cell, 't')[0]?.textContent ?? elementsNamed(cell, 'v')[0]?.textContent ?? ''
}
const sha256 = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex')

const categories = [
  { id: 'r', label: 'Remembering', shortLabel: 'R', weight: '1', sortOrder: 1 },
  { id: 'u', label: 'Understanding', shortLabel: 'U', weight: '1', sortOrder: 2 },
  { id: 'a', label: 'Applying', shortLabel: 'A', weight: '1', sortOrder: 3 },
]
const row = (id, sortOrder, weight = '1', override = '', cognitiveWeights = { r: '1', u: '1', a: '1' }) => ({ id, sortOrder, weight, itemCountOverride: override, cognitiveWeights })
const engine = await loadAllocationEngine()

function assertExact(result, total) {
  assert.equal(result.ok, true, result.errors.join('; '))
  assert.equal(result.totalAllocated, total)
  assert.equal(result.rows.reduce((sum, item) => sum + item.itemCount, 0), total)
  const numbers = result.rows.flatMap((item) => item.cognitiveAllocations.flatMap((part) => part.itemStart === null ? [] : Array.from({ length: part.itemCount }, (_, index) => part.itemStart + index)))
  assert.deepEqual(numbers, Array.from({ length: total }, (_, index) => index + 1), 'item placement must have no gaps, duplicates, or overlaps')
  for (const item of result.rows) assert.equal(item.cognitiveAllocations.reduce((sum, part) => sum + part.itemCount, 0), item.itemCount)
  if (result.rows.length) {
    const hundredths = result.rows.reduce((sum, item) => sum + Number(item.computedWeightPercent.replace('.', '')), 0)
    assert.equal(hundredths, 10000, 'displayed weight percentages must reconcile to exactly 100.00%')
  }
}

const equal37 = engine.calculateTosAllocation({ totalItems: 37, categories, rows: [row('a', 1), row('b', 2), row('c', 3)] })
assertExact(equal37, 37)
assert.deepEqual(equal37.rows.map((item) => item.itemCount), [13, 12, 12], 'Hamilton tie-break is stable by sort order')
assert.deepEqual(equal37.rows.map((item) => item.computedWeightPercent), ['33.34', '33.33', '33.33'])

const odd43 = engine.calculateTosAllocation({ totalItems: 43, categories, rows: Array.from({ length: 11 }, (_, index) => row(`row-${index + 1}`, index + 1, String(index + 1))) })
assertExact(odd43, 43)

const decimals = engine.calculateTosAllocation({ totalItems: 37, categories, rows: [row('a', 1, '33.3'), row('b', 2, '33.3'), row('c', 3, '33.4')] })
assertExact(decimals, 37)
assert.deepEqual(decimals.rows.map((item) => item.itemCount), [12, 12, 13])
assert.equal(engine.decimalStringsSumTo(['33.3', '33.3', '33.4'], '100'), true)
assert.equal(engine.decimalStringsSumTo(['33.3', '33.3', '33.3'], '100'), false)

const override = engine.calculateTosAllocation({ totalItems: 43, categories, rows: [row('a', 1, '1', '9'), row('b', 2, '2'), row('c', 3, '1')] })
assertExact(override, 43)
assert.deepEqual(override.rows.map((item) => item.itemCount), [9, 23, 11])

const one = engine.calculateTosAllocation({ totalItems: 43, categories, rows: [row('only', 1, '.125')] })
assertExact(one, 43)
assert.equal(one.rows[0].itemRangeLabel, '1–43')

const zero = engine.calculateTosAllocation({ totalItems: 0, categories, rows: [] })
assertExact(zero, 0)
const zeroWithCompetency = engine.calculateTosAllocation({ totalItems: 0, categories, rows: [row('zero-row', 1)] })
assertExact(zeroWithCompetency, 0)
assert.equal(zeroWithCompetency.rows[0].itemStart, null)
assert.equal(zeroWithCompetency.rows[0].itemEnd, null)
assert.equal(engine.calculateTosAllocation({ totalItems: 10, categories, rows: [row('bad', 1, '-2')] }).ok, false)
assert.equal(engine.calculateTosAllocation({ totalItems: 10, categories, rows: [row('locked', 1, '1', '11')] }).ok, false)
assert.equal(engine.calculateTosAllocation({ totalItems: 10, categories, rows: [row('a', 1, '0'), row('b', 2, '0')] }).ok, false)

const app = read('src/App.tsx')
assert.match(app, /path="tos" element={<TosListPage/)
assert.match(app, /path="tos\/new" element={<TosEditorPage/)
assert.match(app, /path="tos\/:id\/print" element={<TosPrintPreviewPage/)
// Assessment routes may be present in the Phase 4.1 integration branch; the
// TOS architecture checks below remain independent of that UI boundary.

const editor = read('src/pages/TosEditorPage.tsx')
assert.match(editor, /competency-picker-trigger/)
assert.doesNotMatch(editor, /select\s+multiple/i)
assert.match(editor, /School grading term/)
assert.match(editor, /Curriculum-guide period/)
assert.match(editor, /manual_percentage/)
assert.match(editor, /instructional_time/)
assert.match(editor, /stagedTotalItems/)
assert.match(editor, /sameVerifiedSnapshot/)
assert.match(editor, /periodsBySavedLabel/)

const tosRepository = read('src/lib/tosRepository.ts')
assert.match(tosRepository, /requireAllCompetencies: true/)
assert.match(tosRepository, /clearDemoTosDocuments/)
assert.match(tosRepository, /safeDraftDecimal/)
assert.match(tosRepository, /resolveVerifiedCompetenciesBatch/)
assert.match(tosRepository, /matchesTosCompetencySnapshot/)
assert.match(tosRepository, /Promise\.all\(\[/)
assert.match(tosRepository, /\.in\('subject_id', validSubjectIds\)/)
assert.match(tosRepository, /\.in\('curriculum_version_id', \[\.\.\.new Set\(validSubjects/)
assert.doesNotMatch(tosRepository, /academic_periods'\)\.select\('id, subject_id/)
assert.doesNotMatch(tosRepository, /content\.rows\.map\(async/)
assert.doesNotMatch(tosRepository, /function resolveCompetency\(/)

const analyzerSource = read('supabase/functions/tos-template-analyzer/index.ts')
const analyzerCompile = ts.transpileModule(analyzerSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  reportDiagnostics: true,
})
assert.equal((analyzerCompile.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0, 'TOS template analyzer must be syntactically valid TypeScript')
for (const required of ['decryptCredential', 'callWithFallback', 'EXTRACTED XLSX STRUCTURE', 'never raw workbook bytes', 'Never invent a destination']) assert.match(analyzerSource, new RegExp(required))
assert.doesNotMatch(analyzerSource, /original_file|base64/i)
const supabaseConfig = read('supabase/config.toml')
assert.match(supabaseConfig, /\[functions\.tos-template-analyzer\]\s+verify_jwt = true/)

const allocationSource = read('src/lib/tosAllocation.ts')
assert.match(allocationSource, /bigint/)
assert.match(allocationSource, /remainder/)
assert.doesNotMatch(allocationSource, /Gemini|AI support|Math\.random/i)

const migration = read('supabase/migrations/202608080012_phase4_tos_builder.sql')
assert.match(migration, /create table if not exists public\.tos_competencies/)
assert.match(migration, /enable row level security/)
assert.match(migration, /save_tos_document/)
assert.match(migration, /create trigger tos_document_state_guard/)
assert.match(migration, /security definer/)
assert.match(migration, /before insert or update on public\.documents/)
assert.match(migration, /source_status is null or source_status not in/)
assert.match(migration, /public\.curriculum_applicability/)
assert.match(migration, /subject_source_status/)
assert.match(migration, /tos_cognitive_allocations_valid/)
assert.match(migration, /saved_row\.value #>> '\{competency,id\}' = tc\.competency_id::text/)
assert.match(migration, /\^comp-\[a-z0-9_-\]/)
assert.match(migration, /curriculumPeriodLabels/)
assert.match(migration, /document_type <> 'tos'/)
assert.match(migration, /unique \(document_id, row_order\)/)
assert.match(migration, /on delete restrict/)
assert.match(migration, /document assignment must belong to the document owner/)
assert.match(migration, /contiguous item ranges must reconcile exactly/)

const xlsxSource = read('src/lib/xlsxTemplate.ts')
assert.match(xlsxSource, /openXlsx\(original\)/)
assert.match(xlsxSource, /openOfficeArchive\(buffer, 'xlsx'\)/)
const archiveSource = read('src/lib/officeArchive.ts')
assert.match(archiveSource, /MAX_EXPANDED/)
assert.match(archiveSource, /actualTotal > MAX_EXPANDED/)
assert.match(xlsxSource, /unsupported XML entity declarations/)
assert.match(xlsxSource, /contains a formula and is intentionally read-only/)
assert.match(xlsxSource, /Exact template filling never inserts unstyled cells/)
assert.match(xlsxSource, /expectedSourceHash/)
assert.match(xlsxSource, /validateXlsxTemplateMappings/)
assert.match(xlsxSource, /Strict or unsupported OOXML/)
assert.match(xlsxSource, /fullCalcOnLoad/)
assert.match(xlsxSource, /pivotCaches/)
assert.doesNotMatch(xlsxSource, /Gemini|template-analyzer/)

const tosExportSource = read('src/lib/tosExport.ts')
assert.match(tosExportSource, /model\.signatories\.forEach/)
assert.match(tosExportSource, /No category was silently omitted/)
assert.match(tosExportSource, /DRAFT COPY/)
assert.match(tosExportSource, /Map the TOS title before exporting a draft/)
assert.match(tosExportSource, /paginateTosRows/)
assert.match(tosExportSource, /chunkTosLines/)
assert.match(tosExportSource, /contentBottom - firstTableTop/)
assert.match(tosExportSource, /contentBottom - subsequentTableTop/)
assert.match(tosExportSource, /firstNotesPageLines/)
assert.doesNotMatch(tosExportSource, /Math\.min\(72/)
assert.doesNotMatch(tosExportSource, /lines\.slice/)

const tosPagination = await loadTosPagination()
const longCompetencyLines = Array.from({ length: 121 }, (_, index) => `line-${index + 1}`)
const paginationPages = tosPagination.paginateTosRows([{ cells: [longCompetencyLines, ['short']] }], { firstPageHeight: 60, subsequentPageHeight: 80, lineHeight: 8, rowPadding: 12 })
assert.ok(paginationPages.length > 1, 'oversized TOS rows must continue onto additional pages')
assert.deepEqual(paginationPages.flatMap((page) => page.rows.flatMap((row) => row.cells[0])).filter(Boolean), longCompetencyLines, 'TOS pagination must preserve every wrapped row line exactly once')
paginationPages.forEach((page, index) => assert.ok(page.height <= (index === 0 ? 60 : 80), 'rendered row heights must fit each page budget'))
assert.ok(paginationPages.slice(1).every((page) => page.rows.some((row) => row.continuesFromPrevious)), 'continuation rows must be represented explicitly for repeated table headers')

const workbookBytes = fs.readFileSync(path.join(root, 'src/assets/tos-standard.xlsx'))
const workbookZip = new PizZip(workbookBytes)
const sheetXml = workbookZip.file('xl/worksheets/sheet1.xml')?.asText() ?? ''
assert.match(sheetXml, /mergeCell/)
assert.match(sheetXml, /<(?:\w+:)?f>SUM\(F9:F68\)<\/(?:\w+:)?f>/)
assert.match(sheetXml, /r="C9"/)
assert.match(sheetXml, /r="Q68"/)
assert.match(sheetXml, /state="frozen"/)
assert.ok(workbookZip.file('xl/styles.xml'))

const xlsxEngine = await loadXlsxEngine()
const originalBuffer = workbookBytes.buffer.slice(workbookBytes.byteOffset, workbookBytes.byteOffset + workbookBytes.byteLength)
const sourceHash = sha256(originalBuffer)
const scalarMapping = {
  fieldKey: 'title', elementId: 'TOS!C2',
  locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'C2' },
  mode: 'replace', confidence: null,
}
const rowMapping = {
  fieldKey: 'rowNumber', elementId: 'TOS!A8',
  locator: { kind: 'worksheet_column', sheetName: 'TOS', columnAddress: 'A', firstDataRow: 9, lastDataRow: 12 },
  mode: 'table_column', confidence: null,
}
const structure = xlsxEngine.extractXlsxTemplateStructure(originalBuffer)
assert.deepEqual(xlsxEngine.validateXlsxTemplateMappings(structure, [scalarMapping, rowMapping]), [])

const roundTripBlob = await xlsxEngine.fillXlsxTemplate(originalBuffer, [scalarMapping, rowMapping], {
  scalar: { title: 'Round-trip verification' },
  rows: [{ rowNumber: 1 }, { rowNumber: 2 }],
}, sourceHash)
const outputBuffer = await roundTripBlob.arrayBuffer()
assert.equal(sha256(originalBuffer), sourceHash, 'the master bytes must remain unchanged')
const outputZip = new PizZip(outputBuffer)
const outputSheetRaw = outputZip.file('xl/worksheets/sheet1.xml')?.asText() ?? ''
const outputSheet = parseXml(outputSheetRaw)
const sourceSheet = parseXml(sheetXml)
assert.equal(cellValue(outputSheet, 'C2'), 'Round-trip verification')
assert.equal(cellValue(outputSheet, 'A9'), '1')
assert.equal(cellValue(outputSheet, 'A10'), '2')
assert.equal(cellValue(outputSheet, 'A11'), '', 'unused mapped rows must be cleared')
assert.equal(cellValue(outputSheet, 'A12'), '', 'unused mapped rows must be cleared')
assert.equal(cellAt(outputSheet, 'A9')?.getAttribute('s'), cellAt(sourceSheet, 'A9')?.getAttribute('s'), 'cell style must survive filling')
assert.equal(elementsNamed(cellAt(outputSheet, 'F69'), 'f')[0]?.textContent, 'SUM(F9:F68)', 'formula definitions must survive')
assert.deepEqual(elementsNamed(outputSheet, 'mergeCell').map((item) => item.getAttribute('ref')), elementsNamed(sourceSheet, 'mergeCell').map((item) => item.getAttribute('ref')), 'merged ranges must survive')
assert.deepEqual(elementsNamed(outputSheet, 'col').map((item) => [item.getAttribute('min'), item.getAttribute('max'), item.getAttribute('width')]), elementsNamed(sourceSheet, 'col').map((item) => [item.getAttribute('min'), item.getAttribute('max'), item.getAttribute('width')]), 'column widths must survive')
assert.deepEqual(elementsNamed(outputSheet, 'row').map((item) => [item.getAttribute('r'), item.getAttribute('ht')]), elementsNamed(sourceSheet, 'row').map((item) => [item.getAttribute('r'), item.getAttribute('ht')]), 'row heights must survive')
assert.equal(elementsNamed(outputSheet, 'pageSetup')[0]?.getAttribute('orientation'), 'landscape')
assert.ok(elementsNamed(outputSheet, 'oddFooter')[0]?.textContent)
assert.deepEqual(elementsNamed(outputSheet, 'headerFooter').map((item) => item.textContent), elementsNamed(sourceSheet, 'headerFooter').map((item) => item.textContent), 'headers and footers must survive')
assert.ok(elementsNamed(outputSheet, 'pane').some((item) => item.getAttribute('state') === 'frozen'))
assert.equal(outputZip.file('xl/styles.xml')?.asText(), workbookZip.file('xl/styles.xml')?.asText(), 'unmapped styles XML must remain byte-identical')
const outputWorkbook = parseXml(outputZip.file('xl/workbook.xml')?.asText() ?? '')
const calcPr = elementsNamed(outputWorkbook, 'calcPr')[0]
assert.equal(calcPr?.getAttribute('calcMode'), 'auto')
assert.equal(calcPr?.getAttribute('fullCalcOnLoad'), '1')
assert.equal(calcPr?.getAttribute('forceFullCalc'), '1')
assert.ok(elementsNamed(outputWorkbook, 'definedName').some((item) => item.getAttribute('name') === '_xlnm.Print_Area'))

await assert.rejects(
  xlsxEngine.fillXlsxTemplate(originalBuffer, [scalarMapping], { scalar: { title: 'No' }, rows: [] }, '0'.repeat(64)),
  /master no longer matches/,
)
await assert.rejects(
  xlsxEngine.fillXlsxTemplate(originalBuffer, [{ ...scalarMapping, locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'F69' } }], { scalar: { title: 'No' }, rows: [] }, sourceHash),
  /contains a formula/,
)
await assert.rejects(
  xlsxEngine.fillXlsxTemplate(originalBuffer, [{ ...scalarMapping, locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B1' } }], { scalar: { title: 'No' }, rows: [] }, sourceHash),
  /merged range/,
)
await assert.rejects(
  xlsxEngine.fillXlsxTemplate(originalBuffer, [scalarMapping, { ...scalarMapping, fieldKey: 'assessmentTitle' }], { scalar: { title: 'A', assessmentTitle: 'B' }, rows: [] }, sourceHash),
  /mapped more than once/,
)
await assert.rejects(
  xlsxEngine.fillXlsxTemplate(originalBuffer, [rowMapping, { ...rowMapping, fieldKey: 'competencyCode', locator: { ...rowMapping.locator, columnAddress: 'B', firstDataRow: 10, lastDataRow: 13 } }], { scalar: {}, rows: [{ rowNumber: 1, competencyCode: 'X' }] }, sourceHash),
  /same worksheet and first\/last data rows/,
)
const unsafeMappings = [
  { ...scalarMapping, locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'F69' } },
  { ...scalarMapping, fieldKey: 'assessmentTitle', locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'B1' } },
  { ...scalarMapping, fieldKey: 'gradeLevel', locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress: 'F69' } },
]
const mappingErrors = xlsxEngine.validateXlsxTemplateMappings(structure, unsafeMappings)
assert.ok(mappingErrors.some((message) => message.includes('formula')))
assert.ok(mappingErrors.some((message) => message.includes('merged range')))
assert.ok(mappingErrors.some((message) => message.includes('both')))
const invalidColumnErrors = xlsxEngine.validateXlsxTemplateMappings(structure, [{
  ...rowMapping, locator: { ...rowMapping.locator, columnAddress: 'XFE' },
}])
assert.ok(invalidColumnErrors.some((message) => message.includes('invalid worksheet column range')))
const mismatchedHeaderErrors = xlsxEngine.validateXlsxTemplateMappings(structure, [{
  ...rowMapping, locator: { ...rowMapping.locator, columnAddress: 'B' },
}])
assert.ok(mismatchedHeaderErrors.some((message) => message.includes('inspected header column')))
const excessiveMappings = Array.from({ length: 101 }, (_, index) => ({ ...scalarMapping, fieldKey: `field-${index}` }))
assert.ok(xlsxEngine.validateXlsxTemplateMappings(structure, excessiveMappings).some((message) => message.includes('at most 100')))
await assert.rejects(
  xlsxEngine.fillXlsxTemplate(originalBuffer, excessiveMappings, { scalar: {}, rows: [] }),
  /at most 100/,
)
assert.throws(
  () => xlsxEngine.extractXlsxTemplateStructure(new ArrayBuffer(10 * 1024 * 1024 + 1)),
  /10 MB or smaller/,
)

const strictZip = new PizZip(originalBuffer)
strictZip.file('xl/workbook.xml', (strictZip.file('xl/workbook.xml')?.asText() ?? '').replace(SHEET_NS, 'http://purl.oclc.org/ooxml/spreadsheetml/main'))
assert.throws(
  () => xlsxEngine.extractXlsxTemplateStructure(strictZip.generate({ type: 'arraybuffer' })),
  /Strict or unsupported OOXML/,
)

const entityZip = new PizZip(originalBuffer)
entityZip.file('xl/workbook.xml', (entityZip.file('xl/workbook.xml')?.asText() ?? '').replace('?>', '?><!DOCTYPE workbook [<!ENTITY x "unsafe">]>'))
assert.throws(
  () => xlsxEngine.extractXlsxTemplateStructure(entityZip.generate({ type: 'arraybuffer' })),
  /unsupported XML entity declarations/,
)

const extensionZip = new PizZip(originalBuffer)
const extensionSheet = extensionZip.file('xl/worksheets/sheet1.xml')?.asText() ?? ''
extensionZip.file('xl/worksheets/sheet1.xml', extensionSheet.replace('<x:c r="C2" s="12" t="str" />', '<x:c r="C2" s="12" t="str"><x:extLst/></x:c>'))
const extensionBuffer = extensionZip.generate({ type: 'arraybuffer' })
const extensionBlob = await xlsxEngine.fillXlsxTemplate(extensionBuffer, [scalarMapping], { scalar: { title: 'Ordered' }, rows: [] })
const extensionOutput = new PizZip(await extensionBlob.arrayBuffer()).file('xl/worksheets/sheet1.xml')?.asText() ?? ''
assert.match(extensionOutput, /r="C2"[^>]*>[\s\S]*?<[^>]*is[^>]*>[\s\S]*?<[^>]*extLst/)

const packageJson = JSON.parse(read('package.json'))
assert.equal(packageJson.version, '0.5.0')
assert.equal(packageJson.scripts['validate:phase4'], 'node scripts/check-phase4.mjs')

console.log('Phase 4 validation passed: exact Hamilton allocation, overrides, ranges, curriculum/term separation, mobile picker architecture, RLS/RPC, and real XLSX round-trip preservation.')
