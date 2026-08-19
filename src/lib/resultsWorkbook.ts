import PizZip from 'pizzip'
import type {
  ResultsReportModel,
  ResultsReportMode,
} from '../types/resultsReport'
import { downloadBlob } from './docxTemplate'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const INSPECT_MAX_BYTES = 10 * 1024 * 1024
const INSPECT_MAX_EXPANDED_BYTES = 200 * 1024 * 1024
const INSPECT_MAX_XML_CHARACTERS = 25 * 1024 * 1024
const INSPECT_MAX_ZIP_PARTS = 5000

type CellValue = string | number | null
type CellKind = 'text' | 'title' | 'header' | 'percent' | 'integer'
type WorkbookCell = { value: CellValue; kind?: CellKind }
type WorkbookRow = WorkbookCell[]

function cell(value: CellValue, kind: CellKind = 'text'): WorkbookCell { return { value, kind } }
function text(value: unknown) { return value === null || value === undefined ? '' : String(value) }
function ratio(value: number | null) { return value === null ? cell(null, 'percent') : cell(value, 'percent') }
function integer(value: number | null | undefined) { return cell(typeof value === 'number' ? value : null, 'integer') }

function xml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[character] ?? character))
}

function columnName(number: number) {
  let current = number
  let result = ''
  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

function cellXml(value: WorkbookCell, address: string) {
  const style = value.kind === 'title' ? 1 : value.kind === 'header' ? 2 : value.kind === 'percent' ? 3 : value.kind === 'integer' ? 4 : 0
  if (typeof value.value === 'number' && Number.isFinite(value.value)) return `<c r="${address}" s="${style}"><v>${String(value.value)}</v></c>`
  const stringValue = value.value === null || value.value === undefined ? '' : String(value.value)
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(stringValue)}</t></is></c>`
}

function worksheetXml(rows: WorkbookRow[]) {
  const nonEmptyRows = rows.length > 0 ? rows : [[]]
  const maxColumns = Math.max(1, ...nonEmptyRows.map((row) => row.length))
  const maxRow = nonEmptyRows.length
  const widths = Array.from({ length: maxColumns }, (_, index) => {
    const maximum = Math.max(12, ...nonEmptyRows.map((row) => text(row[index]?.value).length).filter((length) => length > 0))
    return Math.min(70, maximum + 2)
  })
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')
  const rowXml = nonEmptyRows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => cellXml(value, `${columnName(columnIndex + 1)}${rowIndex + 1}`)).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(maxColumns)}${maxRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${columnName(maxColumns)}${maxRow}"/></worksheet>`
}

function metadataRows(model: ResultsReportModel): WorkbookRow[] {
  const { metadata, labels } = model
  return [
    [cell(model.documentTitle, 'title')],
    [cell(model.title, 'title')],
    [cell(`${labels.teacher}: ${metadata.teacherName}`)],
    [cell(`${labels.school}: ${metadata.schoolName}`)],
    [cell(`${labels.gradeLevel}: ${metadata.gradeLevel}`)],
    [cell(`${labels.learningArea}: ${metadata.learningArea}`)],
    [cell(`${labels.schoolYear}: ${metadata.schoolYear}`)],
    [cell(`${labels.gradingTerm}: ${metadata.gradingTerm}`)],
    [cell(`${labels.section}: ${metadata.sectionName}`)],
    [cell(`${labels.administrationDate}: ${metadata.administrationDate}`)],
  ]
}

function summarySheet(model: ResultsReportModel): WorkbookRow[] {
  const summary = model.summary
  const rows = [...metadataRows(model), [], [cell(model.labels.summary, 'header')]]
  if (!summary) return rows
  rows.push(
    [cell(model.labels.total), integer(summary.classLearnerCount)],
    [cell('Encoded learners'), integer(summary.encodedLearnerCount)],
    [cell('Scored learners'), integer(summary.scoredLearnerCount)],
    [cell(model.labels.possiblePoints), cell(summary.possiblePoints)],
    [cell(model.labels.classAverage), ratio(summary.averagePercentage), cell(summary.averageRawScore), cell(summary.possiblePoints)],
    [cell(model.labels.median), ratio(summary.medianPercentage), cell(summary.medianRawScore), cell(summary.possiblePoints)],
    [cell(model.labels.highest), ratio(summary.highestPercentage), cell(summary.highestRawScore), cell(summary.possiblePoints)],
    [cell(model.labels.lowest), ratio(summary.lowestPercentage), cell(summary.lowestRawScore), cell(summary.possiblePoints)],
    [],
    [cell(model.labels.learner, 'header'), cell(model.labels.rawScore, 'header'), cell(model.labels.percentage, 'header'), cell(model.labels.attempted, 'header'), cell(model.labels.omitted, 'header'), cell(model.labels.correct, 'header'), cell(model.labels.incorrect, 'header')],
  )
  for (const learner of summary.learners) rows.push([cell(learner.displayName), cell(learner.rawScore), ratio(learner.percentage), integer(learner.attemptedItems), integer(learner.omittedItems), integer(learner.correctItems), integer(learner.incorrectItems)])
  rows.push([], [cell('Percentage distribution', 'header'), cell('Count', 'header')])
  summary.percentageDistribution.forEach((bin) => rows.push([cell(bin.label), integer(bin.count)]))
  return rows
}

function learnerSheet(model: ResultsReportModel): WorkbookRow[] {
  const rows: WorkbookRow[] = [[cell(model.labels.learner, 'header'), cell(model.labels.rawScore, 'header'), cell(model.labels.points, 'header'), cell(model.labels.percentage, 'header'), cell(model.labels.attempted, 'header'), cell(model.labels.omitted, 'header'), cell(model.labels.correct, 'header'), cell(model.labels.incorrect, 'header')]]
  for (const learner of model.summary?.learners ?? []) rows.push([cell(learner.displayName), cell(learner.rawScore), cell(learner.possiblePoints), ratio(learner.percentage), integer(learner.attemptedItems), integer(learner.omittedItems), integer(learner.correctItems), integer(learner.incorrectItems)])
  return rows
}


function workbookUsesPointRanges(model: ResultsReportModel) {
  return model.items.some((item) => item.numberLabel !== String(item.itemNumber))
}

function workbookQuestionLabels(model: ResultsReportModel) {
  const pointRanges = workbookUsesPointRanges(model)
  return {
    singular: pointRanges ? 'Question' : model.labels.item,
    numbers: pointRanges ? 'Question numbers' : 'Item numbers',
    mapped: pointRanges ? 'Mapped questions' : 'Mapped items',
  }
}

function itemSheet(model: ResultsReportModel): WorkbookRow[] {
  const unit = workbookQuestionLabels(model)
  const rows: WorkbookRow[] = [[cell(unit.singular, 'header'), cell('Prompt', 'header'), cell(model.labels.competency, 'header'), cell(model.labels.cognitiveCategory, 'header'), cell(model.labels.curriculumPeriod, 'header'), cell('Question type', 'header'), cell(model.labels.attempted, 'header'), cell(model.labels.correct, 'header'), cell(model.labels.incorrect, 'header'), cell(model.labels.omitted, 'header'), cell(model.labels.points, 'header'), cell(model.labels.analysisBasis, 'header'), cell(model.labels.facility, 'header'), cell(model.labels.pointAchievement, 'header'), cell(model.labels.discrimination, 'header'), cell('Discrimination status', 'header')]]
  for (const item of model.items) rows.push([cell(item.numberLabel), cell(item.prompt), cell(item.competency), cell(item.cognitiveCategory), cell(item.curriculumPeriod), cell(item.questionType), integer(item.attempted), integer(item.correct), integer(item.incorrect), integer(item.omitted), cell(`${item.earnedPoints} / ${item.possiblePoints}`), cell(item.analysisBasis.replaceAll('_', ' ')), ratio(item.facility), ratio(item.normalizedPointAchievement), ratio(item.discrimination), cell(item.discriminationStatus)])
  return rows
}

function optionSheet(model: ResultsReportModel): WorkbookRow[] {
  const unit = workbookQuestionLabels(model)
  const rows: WorkbookRow[] = [[cell(unit.singular, 'header'), cell('Option', 'header'), cell(model.labels.count, 'header'), cell(model.labels.percentage, 'header'), cell('Correct option', 'header'), cell('Advisory signal', 'header'), cell(model.labels.omitted, 'header')]]
  for (const option of model.options) rows.push([cell(option.numberLabel), cell(option.option), integer(option.count), ratio(option.percentage), cell(option.correct ? 'Yes' : 'No'), cell(option.distractorSignal === 'unselected' ? 'Unselected distractor — teacher review' : ''), integer(option.omitted)])
  return rows
}

function competencySheet(model: ResultsReportModel): WorkbookRow[] {
  const unit = workbookQuestionLabels(model)
  const rows: WorkbookRow[] = [[cell(model.labels.competency, 'header'), cell('Code', 'header'), cell(model.labels.curriculumPeriod, 'header'), cell(unit.numbers, 'header'), cell(unit.mapped, 'header'), cell(model.labels.attempted, 'header'), cell(model.labels.correct, 'header'), cell(model.labels.incorrect, 'header'), cell(model.labels.omitted, 'header'), cell(model.labels.facility, 'header'), cell(model.labels.points, 'header'), cell(model.labels.pointAchievement, 'header')]]
  for (const row of model.competencies) rows.push([cell(row.competency), cell(row.code), cell(row.curriculumPeriod), cell(row.itemNumberLabels.join(', ')), integer(row.mappedItems), integer(row.attempts), integer(row.correct), integer(row.incorrect), integer(row.omitted), ratio(row.facility), cell(`${row.earnedPoints} / ${row.pointsPossibleForAll}`), ratio(row.normalizedPointAchievement)])
  return rows
}

function cognitiveSheet(model: ResultsReportModel): WorkbookRow[] {
  const unit = workbookQuestionLabels(model)
  const rows: WorkbookRow[] = [[cell(model.labels.cognitiveCategory, 'header'), cell(model.labels.curriculumPeriod, 'header'), cell(unit.numbers, 'header'), cell(unit.mapped, 'header'), cell(model.labels.attempted, 'header'), cell(model.labels.correct, 'header'), cell(model.labels.incorrect, 'header'), cell(model.labels.omitted, 'header'), cell(model.labels.facility, 'header'), cell(model.labels.points, 'header'), cell(model.labels.pointAchievement, 'header')]]
  for (const row of model.cognitiveCategories) rows.push([cell(row.category), cell(row.curriculumPeriod), cell(row.itemNumberLabels.join(', ')), integer(row.mappedItems), integer(row.attempts), integer(row.correct), integer(row.incorrect), integer(row.omitted), ratio(row.facility), cell(`${row.earnedPoints} / ${row.pointsPossibleForAll}`), ratio(row.normalizedPointAchievement)])
  return rows
}

function remediationSheet(model: ResultsReportModel): WorkbookRow[] {
  const unit = workbookQuestionLabels(model)
  const rows: WorkbookRow[] = [[cell('Scope', 'header'), cell(model.labels.target, 'header'), cell(model.labels.curriculumPeriod, 'header'), cell(unit.numbers, 'header'), cell(model.labels.evidence, 'header'), cell(model.labels.threshold, 'header'), cell(model.labels.learners, 'header'), cell('Denominator', 'header'), cell('Instructional signal', 'header'), cell(model.labels.plannedActivity, 'header'), cell(model.labels.schedule, 'header'), cell(model.labels.followUpEvidence, 'header'), cell(model.labels.notes, 'header'), cell(model.labels.teacherReview, 'header')]]
  for (const row of model.remediation) rows.push([cell(row.scope), cell(row.targetCompetency), cell(row.curriculumPeriod), cell(row.itemNumberLabels.join(', ')), ratio(row.evidence), ratio(row.threshold), integer(row.learnerCount), cell(row.denominatorLabel), cell(row.instructionalMessage), cell(row.plannedActivity), cell(row.schedule), cell(row.followUpEvidence), cell(row.notes), cell(row.teacherReviewed ? 'Yes' : 'No')])
  return rows
}

function appXml(sheetNames: string[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Spreadsheet</Application><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="lpstr">${sheetNames.map((name) => `<vt:lpstr>${xml(name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`
}

function workbookXml(sheetNames: string[]) {
  const sheets = sheetNames.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="1"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets>${sheets}</sheets><calcPr calcId="0" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`
}

function workbookRels(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheetCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>`
}

function rootRels() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
}

function contentTypes(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheets}</Types>`
}

function stylesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Aptos"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="DDEBF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/></styleSheet>'
}

function themeXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F4E78"/></a:dk2><a:lt2><a:srgbClr val="DDEBF7"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>'
}

const SHEET_NAMES = ['Summary', 'Learner Scores', 'Item Analysis', 'Option Analysis', 'Competency Analysis', 'Cognitive Analysis', 'Remediation'] as const

function sheetRows(model: ResultsReportModel): WorkbookRow[][] {
  return [summarySheet(model), learnerSheet(model), itemSheet(model), optionSheet(model), competencySheet(model), cognitiveSheet(model), remediationSheet(model)]
}

/** Build a standards-compatible workbook without formula-dependent correctness. */
export function buildResultsWorkbook(model: ResultsReportModel) {
  const zip = new PizZip()
  const rows = sheetRows(model)
  zip.file('[Content_Types].xml', contentTypes(rows.length))
  zip.file('_rels/.rels', rootRels())
  zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Assessment results</dc:title><dc:creator>Teacher</dc:creator></cp:coreProperties>')
  zip.file('docProps/app.xml', appXml([...SHEET_NAMES]))
  zip.file('xl/workbook.xml', workbookXml([...SHEET_NAMES]))
  zip.file('xl/_rels/workbook.xml.rels', workbookRels(rows.length))
  zip.file('xl/styles.xml', stylesXml())
  zip.file('xl/theme/theme1.xml', themeXml())
  rows.forEach((sheet, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet)))
  return zip.generate({ type: 'blob', mimeType: XLSX_MIME })
}

export function resultsWorkbookFilename(model: ResultsReportModel) {
  const title = model.title.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'assessment-results'
  return `${title} - Results.xlsx`
}

export function downloadResultsXlsx(model: ResultsReportModel) {
  downloadBlob(buildResultsWorkbook(model), resultsWorkbookFilename(model))
}

export function resultsWorkbookSheetNames() {
  return [...SHEET_NAMES]
}

export type { ResultsReportMode }

export type ResultsXlsxSheetPreview = {
  name: string
  headers: string[]
  rows: string[][]
  truncated: boolean
}

export type ResultsXlsxInspection = {
  sheetNames: string[]
  selectedSheet: ResultsXlsxSheetPreview
}

type XlsxSheetPath = { name: string; path: string }

function openInspectionWorkbook(buffer: ArrayBuffer) {
  if (buffer.byteLength > INSPECT_MAX_BYTES) throw new Error('XLSX files must be 10 MB or smaller for safe inspection.')
  let zip: PizZip
  try { zip = new PizZip(buffer) } catch { throw new Error('This file is not a readable standard .xlsx workbook.') }
  const parts = Object.values(zip.files)
  if (parts.length > INSPECT_MAX_ZIP_PARTS) throw new Error('This XLSX contains too many workbook parts for safe inspection.')
  const expanded = parts.reduce((sum, part) => sum + inspectionExpandedSize(part), 0)
  if (expanded > INSPECT_MAX_EXPANDED_BYTES) throw new Error('This XLSX expands beyond the safe in-browser inspection limit.')
  return zip
}

function inspectionExpandedSize(file: unknown) {
  const value = (file as { _data?: { uncompressedSize?: unknown } } | null)?._data?.uncompressedSize
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function inspectionText(zip: PizZip, path: string, label: string) {
  const file = zip.file(path)
  if (!file) return null
  if (inspectionExpandedSize(file) > INSPECT_MAX_XML_CHARACTERS) throw new Error(`${label} is too large for safe workbook inspection.`)
  const value = file.asText()
  if (value.length > INSPECT_MAX_XML_CHARACTERS) throw new Error(`${label} is too large for safe workbook inspection.`)
  return value
}

function inspectionXml(raw: string, label: string) {
  if (raw.length > INSPECT_MAX_XML_CHARACTERS) throw new Error(`${label} is too large for safe workbook inspection.`)
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error(`${label} contains unsupported XML entity declarations.`)
  const parsed = new DOMParser().parseFromString(raw, 'application/xml')
  if (parsed.getElementsByTagName('parsererror').length) throw new Error(`${label} XML could not be parsed.`)
  return parsed
}

function inspectionDescendants(element: Document | Element, localName: string) {
  return Array.from(element.getElementsByTagNameNS('*', localName))
}

function inspectionColumnNumber(column: string) {
  let value = 0
  for (const character of column.toUpperCase()) value = value * 26 + character.charCodeAt(0) - 64
  return value
}

function inspectionCellText(cellElement: Element, sharedStrings: string[]) {
  const formula = inspectionDescendants(cellElement, 'f')[0]
  if (formula) return `=${formula.textContent ?? ''}`
  const type = cellElement.getAttribute('t')
  if (type === 'inlineStr') return inspectionDescendants(cellElement, 't').map((item) => item.textContent ?? '').join('')
  const raw = inspectionDescendants(cellElement, 'v')[0]?.textContent ?? ''
  if (type === 's') return sharedStrings[Number(raw)] ?? ''
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE'
  return raw
}

function inspectionWorkbookSheets(zip: PizZip): XlsxSheetPath[] {
  const workbookRaw = inspectionText(zip, 'xl/workbook.xml', 'Workbook')
  const relationshipsRaw = inspectionText(zip, 'xl/_rels/workbook.xml.rels', 'Workbook relationships')
  if (!workbookRaw || !relationshipsRaw) throw new Error('This workbook does not contain a readable workbook definition.')
  const workbook = inspectionXml(workbookRaw, 'Workbook')
  const relationships = inspectionXml(relationshipsRaw, 'Workbook relationships')
  const targets = new Map(inspectionDescendants(relationships, 'Relationship').map((item) => [item.getAttribute('Id') ?? '', item.getAttribute('Target') ?? '']))
  return inspectionDescendants(workbook, 'sheet').flatMap((sheet) => {
    const name = sheet.getAttribute('name') ?? ''
    const relationshipId = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? sheet.getAttribute('r:id') ?? ''
    const target = targets.get(relationshipId) ?? ''
    if (!name || !target) return []
    const normalizedTarget = target.replace(/^\.\//, '')
    const path = normalizedTarget.startsWith('/') ? normalizedTarget.slice(1) : normalizedTarget.startsWith('xl/') ? normalizedTarget : `xl/${normalizedTarget}`
    if (!path.startsWith('xl/') || path.split('/').includes('..') || path.includes('\\')) throw new Error(`Worksheet “${name}” uses an unsafe workbook relationship path.`)
    return [{ name, path }]
  })
}

/** List readable worksheets before the teacher explicitly chooses one. */
export function listResultsXlsxSheets(buffer: ArrayBuffer): string[] {
  return inspectionWorkbookSheets(openInspectionWorkbook(buffer)).map((sheet) => sheet.name)
}

function inspectionSharedStrings(zip: PizZip) {
  const raw = inspectionText(zip, 'xl/sharedStrings.xml', 'Shared strings')
  if (!raw) return []
  const parsed = inspectionXml(raw, 'Shared strings')
  return inspectionDescendants(parsed, 'si').map((item) => inspectionDescendants(item, 't').map((textNode) => textNode.textContent ?? '').join(''))
}

function detectHeaderRow(table: string[][]): number {
  if (table.length <= 1) return 0
  const maxScan = Math.min(table.length, 50)
  let bestRowIndex = 0
  let bestScore = -1

  const KEYWORDS = [
    'name', 'learner', 'student', 'last name', 'first name', 'display name',
    'apelyido', 'pangalan', 'middle name', 'extension', 'ext', 'sex', 'gender',
    'lrn', 'remarks', 'score', 'item', 'no.', 'no', '#', 'status', 'reference',
    'learner name', "learner's name", 'student name', 'full name', 'q1', 'q2', 'q3', 'q4',
  ]

  for (let i = 0; i < maxScan; i++) {
    const row = table[i]
    const filledCells = row.filter((c) => c && c.trim().length > 0)
    if (filledCells.length === 0) continue

    let score = 0
    for (const cell of filledCells) {
      const lower = cell.toLowerCase().trim()
      for (const kw of KEYWORDS) {
        if (lower === kw) score += 40
        else if (lower.includes(kw)) score += 20
      }
    }

    if (filledCells.length === 1 && filledCells[0].length > 25) score -= 30
    if (filledCells.length >= 2) score += 10

    if (score > bestScore) {
      bestScore = score
      bestRowIndex = i
    }
  }

  return bestScore > 10 ? bestRowIndex : 0
}

function composeCompositeNames(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
  const normHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))

  const singleNameHeaders = ['name', 'learner', 'learnername', 'student', 'studentname', 'displayname', 'fullname', 'pangalan', 'learnersname']
  if (normHeaders.some((h) => singleNameHeaders.includes(h))) {
    return { headers, rows }
  }

  const lastNames = ['lastname', 'last', 'apelyido', 'surname']
  const firstNames = ['firstname', 'first', 'givenname', 'pangalan']
  const middleNames = ['middlename', 'middle', 'middleinitial', 'mi']
  const extensions = ['extension', 'ext', 'nameextension', 'suffix']

  const lastIdx = normHeaders.findIndex((h) => lastNames.includes(h))
  const firstIdx = normHeaders.findIndex((h) => firstNames.includes(h))
  const midIdx = normHeaders.findIndex((h) => middleNames.includes(h))
  const extIdx = normHeaders.findIndex((h) => extensions.includes(h))

  if (lastIdx >= 0 && firstIdx >= 0) {
    const composedHeader = 'Learner Name (Last, First Middle)'
    const nextHeaders = [composedHeader, ...headers]
    const nextRows = rows.map((row) => {
      const last = (row[lastIdx] ?? '').trim()
      const first = (row[firstIdx] ?? '').trim()
      const middle = midIdx >= 0 ? (row[midIdx] ?? '').trim() : ''
      const ext = extIdx >= 0 ? (row[extIdx] ?? '').trim() : ''
      let composed = ''
      if (last && first) {
        composed = `${last}, ${first}${middle ? ` ${middle}` : ''}${ext ? ` ${ext}` : ''}`
      } else {
        composed = last || first
      }
      return [composed, ...row]
    })
    return { headers: nextHeaders, rows: nextRows }
  }

  return { headers, rows }
}

function inspectWorksheet(zip: PizZip, sheet: XlsxSheetPath, sharedStrings: string[], maxRows: number, maxColumns: number): ResultsXlsxSheetPreview {
  const raw = inspectionText(zip, sheet.path, `Worksheet ${sheet.name}`)
  if (!raw) throw new Error(`Worksheet “${sheet.name}” could not be read.`)
  const parsed = inspectionXml(raw, `Worksheet ${sheet.name}`)
  const rows = inspectionDescendants(parsed, 'row')
  const table: string[][] = []
  let truncated = false
  for (const row of rows) {
    const values = Array.from(row.getElementsByTagNameNS('*', 'c')).map((cellElement) => ({
      address: cellElement.getAttribute('r') ?? '',
      value: inspectionCellText(cellElement, sharedStrings),
    }))
    const rowValues = Array.from({ length: maxColumns }, () => '')
    for (const value of values) {
      const match = /^([A-Z]{1,3})[1-9]\d*$/i.exec(value.address)
      if (!match) continue
      const column = inspectionColumnNumber(match[1]) - 1
      if (column < 0 || column >= maxColumns) { truncated = true; continue }
      rowValues[column] = value.value
    }
    while (rowValues.length > 0 && rowValues[rowValues.length - 1] === '') rowValues.pop()
    if (rowValues.some((value) => value.trim())) table.push(rowValues)
    if (table.length >= maxRows + 50) { truncated = true; break }
  }
  const headerIndex = detectHeaderRow(table)
  const rawHeaders = table[headerIndex] ?? []
  const rawBodyRows = table.slice(headerIndex + 1, headerIndex + 1 + maxRows)
  if (table.length - (headerIndex + 1) > maxRows) truncated = true

  const { headers, rows: bodyRows } = composeCompositeNames(rawHeaders, rawBodyRows)
  return { name: sheet.name, headers, rows: bodyRows, truncated }
}

/**
 * Safely inspect one explicitly selected worksheet. This only previews raw
 * cells; it never infers a school layout or imports data.
 */
export function inspectResultsXlsx(
  buffer: ArrayBuffer,
  worksheetName: string,
  options: { maxRows?: number; maxColumns?: number } = {},
): ResultsXlsxInspection {
  if (!worksheetName.trim()) throw new Error('Select one worksheet before inspecting an XLSX.')
  const zip = openInspectionWorkbook(buffer)
  const sheets = inspectionWorkbookSheets(zip)
  const sheetNames = sheets.map((sheet) => sheet.name)
  const selected = sheets.find((sheet) => sheet.name === worksheetName)
  if (!selected) throw new Error(`Worksheet “${worksheetName}” was not found. Choose one of: ${sheetNames.join(', ') || 'none'}.`)
  const maxRows = Math.min(5000, Math.max(1, Math.floor(options.maxRows ?? 500)))
  const maxColumns = Math.min(200, Math.max(1, Math.floor(options.maxColumns ?? 100)))
  return { sheetNames, selectedSheet: inspectWorksheet(zip, selected, inspectionSharedStrings(zip), maxRows, maxColumns) }
}
