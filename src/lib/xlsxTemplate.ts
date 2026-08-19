import PizZip from 'pizzip'
import type {
  TosTemplateElement,
  TosTemplateMapping,
  TosTemplateFieldKey,
  TosTemplateMappingMode,
  XlsxCellLocator,
  XlsxColumnLocator,
} from '../types/tosTemplate'
import { sha256Hex } from './docxTemplate'

const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_XLSX_BYTES = 10 * 1024 * 1024
const MAX_EXPANDED_BYTES = 200 * 1024 * 1024
const MAX_XML_CHARACTERS = 25 * 1024 * 1024
const MAX_ZIP_PARTS = 5000
const MAX_MAPPINGS = 100
const MAX_WORKSHEET_ROW = 1048576
const MAX_WORKSHEET_COLUMN = 16384

type WorkbookSheet = { name: string; path: string }
export type TosXlsxValue = string | number
export type TosXlsxValues = {
  scalar: Partial<Record<TosTemplateFieldKey, TosXlsxValue>>
  rows: Array<Partial<Record<TosTemplateFieldKey, TosXlsxValue>>>
}

function parseXml(raw: string, label: string) {
  if (raw.length > MAX_XML_CHARACTERS) throw new Error(`${label} is too large for safe in-browser template inspection.`)
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error(`${label} contains unsupported XML entity declarations.`)
  const xml = new DOMParser().parseFromString(raw, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length) throw new Error(`${label} XML could not be parsed.`)
  return xml
}

function expandedSize(file: unknown) {
  const value = (file as { _data?: { uncompressedSize?: unknown } } | null)?._data?.uncompressedSize
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function openXlsx(buffer: ArrayBuffer) {
  if (buffer.byteLength > MAX_XLSX_BYTES) throw new Error('XLSX templates must be 10 MB or smaller.')
  let zip: PizZip
  try { zip = new PizZip(buffer) }
  catch { throw new Error('This file is not a readable standard .xlsx workbook.') }
  const parts = Object.values(zip.files)
  if (parts.length > MAX_ZIP_PARTS) throw new Error('This XLSX contains too many workbook parts for safe in-browser inspection.')
  const total = parts.reduce((sum, part) => sum + expandedSize(part), 0)
  if (total > MAX_EXPANDED_BYTES) throw new Error('This XLSX expands beyond the safe in-browser template limit.')
  return zip
}

function zipText(zip: PizZip, path: string, label: string) {
  const file = zip.file(path)
  if (!file) return null
  if (expandedSize(file) > MAX_XML_CHARACTERS) throw new Error(`${label} is too large for safe in-browser template inspection.`)
  const raw = file.asText()
  if (raw.length > MAX_XML_CHARACTERS) throw new Error(`${label} is too large for safe in-browser template inspection.`)
  return raw
}

function assertTransitionalSpreadsheet(xml: Document, label: string) {
  if (xml.documentElement.namespaceURI !== SHEET_NS) {
    throw new Error(`${label} uses Strict or unsupported OOXML. Open it in Excel or LibreOffice and save a standard .xlsx copy before mapping.`)
  }
}

function descendants(element: Document | Element, localName: string) {
  return Array.from(element.getElementsByTagNameNS('*', localName))
}

function workbookSheets(zip: PizZip): WorkbookSheet[] {
  const workbookRaw = zipText(zip, 'xl/workbook.xml', 'Workbook')
  const relsRaw = zipText(zip, 'xl/_rels/workbook.xml.rels', 'Workbook relationships')
  if (!workbookRaw || !relsRaw) throw new Error('This XLSX does not contain a readable workbook definition.')
  const workbook = parseXml(workbookRaw, 'Workbook')
  assertTransitionalSpreadsheet(workbook, 'This workbook')
  const rels = parseXml(relsRaw, 'Workbook relationships')
  const targets = new Map(descendants(rels, 'Relationship').map((item) => [item.getAttribute('Id') ?? '', item.getAttribute('Target') ?? '']))
  return descendants(workbook, 'sheet').flatMap((sheet) => {
    const name = sheet.getAttribute('name') ?? ''
    const relationshipId = sheet.getAttributeNS(REL_NS, 'id') ?? sheet.getAttribute('r:id') ?? ''
    const target = targets.get(relationshipId)
    if (!name || !target) return []
    const path = target.startsWith('/') ? target.slice(1) : target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`
    if (path.split('/').includes('..') || path.includes('\\') || !path.startsWith('xl/')) throw new Error(`Worksheet “${name}” uses an unsafe workbook relationship path.`)
    return [{ name, path }]
  })
}

function sharedStrings(zip: PizZip) {
  const raw = zipText(zip, 'xl/sharedStrings.xml', 'Shared strings')
  if (!raw) return []
  const xml = parseXml(raw, 'Shared strings')
  return descendants(xml, 'si').map((item) => descendants(item, 't').map((text) => text.textContent ?? '').join(''))
}

function cellText(cell: Element, shared: string[]) {
  if (descendants(cell, 'f').length) return `=${descendants(cell, 'f')[0]?.textContent ?? ''}`
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') return descendants(cell, 't').map((item) => item.textContent ?? '').join('')
  const raw = descendants(cell, 'v')[0]?.textContent ?? ''
  if (type === 's') return shared[Number(raw)] ?? ''
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE'
  return raw
}

function splitAddress(address: string) {
  const match = /^([A-Z]{1,3})([1-9]\d*)$/i.exec(address.trim())
  if (!match) throw new Error(`Invalid XLSX cell address: ${address}.`)
  const column = match[1].toUpperCase()
  const row = Number(match[2])
  if (row > MAX_WORKSHEET_ROW || columnNumber(column) > MAX_WORKSHEET_COLUMN) throw new Error(`XLSX cell address is outside worksheet limits: ${address}.`)
  return { column, row }
}

function safeSplitAddress(address: string) {
  try { return splitAddress(address) }
  catch { return null }
}

function columnNumber(column: string) {
  return [...column.toUpperCase()].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0)
}

function rowContext(rowCells: Element[], shared: string[]) {
  return rowCells.map((cell) => `${cell.getAttribute('r') ?? '?'}: ${cellText(cell, shared) || '[blank]'}`).join(' | ').slice(0, 1100)
}

export function extractXlsxTemplateStructure(buffer: ArrayBuffer): TosTemplateElement[] {
  const zip = openXlsx(buffer)
  const shared = sharedStrings(zip)
  const elements: TosTemplateElement[] = []
  for (const sheet of workbookSheets(zip)) {
    const raw = zipText(zip, sheet.path, `Worksheet ${sheet.name}`)
    if (!raw) continue
    const xml = parseXml(raw, `Worksheet ${sheet.name}`)
    assertTransitionalSpreadsheet(xml, `Worksheet “${sheet.name}”`)
    const mergedRanges = descendants(xml, 'mergeCell').map((item) => item.getAttribute('ref') ?? '').filter(Boolean)
    for (const row of descendants(xml, 'row')) {
      const cells = Array.from(row.childNodes).filter((item): item is Element => item.nodeType === 1 && (item as Element).localName === 'c')
      const context = rowContext(cells, shared)
      for (const cell of cells) {
        const address = (cell.getAttribute('r') ?? '').toUpperCase()
        if (!address) continue
        const text = cellText(cell, shared).trim()
        const styledBlank = Boolean(cell.getAttribute('s'))
        if (!text && !styledBlank) continue
        const mergedRange = mergedRanges.find((range) => insideRange(address, range)) ?? null
        elements.push({
          id: `${sheet.name}!${address}`,
          locator: { kind: 'worksheet_cell', sheetName: sheet.name, cellAddress: address },
          kind: 'worksheet_cell',
          text,
          context: `${sheet.name} · ${context}`,
          suggestedMode: 'replace',
          isFormula: descendants(cell, 'f').length > 0,
          isMerged: Boolean(mergedRange),
          isMergedAnchor: Boolean(mergedRange && mergedRange.split(':')[0].toUpperCase() === address),
          styleIndex: cell.getAttribute('s'),
        })
        if (elements.length >= 5000) return elements
      }
    }
  }
  return elements
}

function cellByAddress(xml: Document, address: string) {
  return descendants(xml, 'c').find((item) => (item.getAttribute('r') ?? '').toUpperCase() === address.toUpperCase()) ?? null
}

function insideRange(address: string, range: string) {
  const [startAddress, endAddress = startAddress] = range.split(':')
  const point = splitAddress(address)
  const start = splitAddress(startAddress)
  const end = splitAddress(endAddress)
  return point.row >= start.row && point.row <= end.row
    && columnNumber(point.column) >= columnNumber(start.column)
    && columnNumber(point.column) <= columnNumber(end.column)
}

function assertWritableCell(xml: Document, cell: Element, address: string) {
  if (descendants(cell, 'f').length) throw new Error(`${address} contains a formula and is intentionally read-only.`)
  for (const merge of descendants(xml, 'mergeCell')) {
    const range = merge.getAttribute('ref') ?? ''
    if (range && insideRange(address, range) && range.split(':')[0].toUpperCase() !== address.toUpperCase()) {
      throw new Error(`${address} is inside merged range ${range}; map the top-left anchor instead.`)
    }
  }
}

function removeValueChildren(cell: Element) {
  for (const child of Array.from(cell.childNodes)) {
    if (child.nodeType === 1 && ((child as Element).localName === 'v' || (child as Element).localName === 'is')) cell.removeChild(child)
  }
}

function appendBeforeExtensions(cell: Element, child: Element) {
  const extension = Array.from(cell.childNodes).find((item) => item.nodeType === 1 && (item as Element).localName === 'extLst') ?? null
  cell.insertBefore(child, extension)
}

function setCellValue(xml: Document, cell: Element, address: string, value: TosXlsxValue) {
  assertWritableCell(xml, cell, address)
  removeValueChildren(cell)
  if (typeof value === 'number' && Number.isFinite(value)) {
    cell.removeAttribute('t')
    const node = xml.createElementNS(SHEET_NS, 'v')
    node.textContent = String(value)
    appendBeforeExtensions(cell, node)
    return
  }
  cell.setAttribute('t', 'inlineStr')
  const inline = xml.createElementNS(SHEET_NS, 'is')
  const text = xml.createElementNS(SHEET_NS, 't')
  text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
  text.textContent = String(value ?? '')
  inline.appendChild(text)
  appendBeforeExtensions(cell, inline)
}

function sheetXml(zip: PizZip, sheets: WorkbookSheet[], name: string, cache: Map<string, Document>) {
  const known = cache.get(name)
  if (known) return known
  const sheet = sheets.find((item) => item.name === name)
  if (!sheet) throw new Error(`Worksheet “${name}” no longer exists in this template.`)
  const raw = zipText(zip, sheet.path, `Worksheet ${name}`)
  if (!raw) throw new Error(`Worksheet “${name}” could not be read.`)
  const xml = parseXml(raw, `Worksheet ${name}`)
  assertTransitionalSpreadsheet(xml, `Worksheet “${name}”`)
  cache.set(name, xml)
  return xml
}

export function validateXlsxTemplateMappings(elements: TosTemplateElement[], mappings: TosTemplateMapping[]) {
  const errors: string[] = []
  const elementMap = new Map(elements.map((item) => [item.id, item]))
  const seenFields = new Set<TosTemplateFieldKey>()
  const seenCells = new Map<string, TosTemplateFieldKey>()
  let tableRange: { sheetName: string; firstDataRow: number; lastDataRow: number } | null = null
  const add = (message: string) => { if (!errors.includes(message) && errors.length < 20) errors.push(message) }
  if (mappings.length > MAX_MAPPINGS) add(`A TOS template supports at most ${MAX_MAPPINGS} confirmed mappings.`)
  const claim = (sheetName: string, address: string, fieldKey: TosTemplateFieldKey) => {
    const key = `${sheetName}!${address.toUpperCase()}`
    const prior = seenCells.get(key)
    if (prior) add(`${key} is mapped to both ${prior} and ${fieldKey}.`)
    else seenCells.set(key, fieldKey)
    const element = elementMap.get(key)
    if (!element) add(`${key} is not an existing styled/value cell in the inspected master.`)
    else if (element.isFormula || element.text.startsWith('=')) add(`${key} contains a formula and must remain read-only.`)
    else if (element.isMerged && !element.isMergedAnchor) add(`${key} is inside a merged range; map its top-left anchor instead.`)
  }

  for (const mapping of mappings) {
    if (seenFields.has(mapping.fieldKey)) add(`${mapping.fieldKey} is mapped more than once.`)
    seenFields.add(mapping.fieldKey)
    if (mapping.locator.kind === 'worksheet_cell') {
      if (mapping.elementId !== `${mapping.locator.sheetName}!${mapping.locator.cellAddress.toUpperCase()}`) add(`${mapping.fieldKey} locator no longer matches its inspected workbook cell.`)
      claim(mapping.locator.sheetName, mapping.locator.cellAddress, mapping.fieldKey)
      continue
    }
    const { sheetName, columnAddress, firstDataRow, lastDataRow } = mapping.locator
    const headerElement = elementMap.get(mapping.elementId)
    const headerAddress = headerElement?.locator.kind === 'worksheet_cell' ? safeSplitAddress(headerElement.locator.cellAddress) : null
    if (!/^[A-Z]{1,3}$/i.test(columnAddress) || columnNumber(columnAddress) > MAX_WORKSHEET_COLUMN || !Number.isSafeInteger(firstDataRow) || !Number.isSafeInteger(lastDataRow) || firstDataRow < 1 || lastDataRow < firstDataRow) {
      add(`${mapping.fieldKey} has an invalid worksheet column range.`)
      continue
    }
    if (!headerElement || headerElement.locator.kind !== 'worksheet_cell' || !headerAddress
      || headerElement.locator.sheetName !== sheetName
      || headerAddress.column !== columnAddress.toUpperCase()) {
      add(`${mapping.fieldKey} table locator no longer matches its inspected header column.`)
    }
    const capacity = lastDataRow - firstDataRow + 1
    if (capacity > 5000 || lastDataRow > MAX_WORKSHEET_ROW) add(`${mapping.fieldKey} exceeds safe XLSX worksheet limits.`)
    if (!tableRange) tableRange = { sheetName, firstDataRow, lastDataRow }
    else if (tableRange.sheetName !== sheetName || tableRange.firstDataRow !== firstDataRow || tableRange.lastDataRow !== lastDataRow) {
      add('All competency-table columns must use the same worksheet and first/last data rows.')
    }
    claim(sheetName, mapping.elementId.split('!').pop() ?? '', mapping.fieldKey)
    for (let row = firstDataRow; row <= lastDataRow && row - firstDataRow < 5000; row += 1) claim(sheetName, `${columnAddress.toUpperCase()}${row}`, mapping.fieldKey)
  }
  return errors
}

function writeAtLocator(xml: Document, locator: XlsxCellLocator, value: TosXlsxValue) {
  const address = locator.cellAddress.toUpperCase()
  const cell = cellByAddress(xml, address)
  if (!cell) throw new Error(`${locator.sheetName}!${address} does not exist. Exact template filling never inserts unstyled cells.`)
  setCellValue(xml, cell, address, value)
}

function markWorkbookForRecalculation(zip: PizZip) {
  const path = 'xl/workbook.xml'
  const raw = zipText(zip, path, 'Workbook')
  if (!raw) throw new Error('This XLSX no longer contains its workbook definition.')
  const xml = parseXml(raw, 'Workbook')
  assertTransitionalSpreadsheet(xml, 'This workbook')
  let calculation = descendants(xml, 'calcPr')[0] ?? null
  if (!calculation) {
    calculation = xml.createElementNS(SHEET_NS, 'calcPr')
    const root = xml.documentElement
    const insertBefore = Array.from(root.childNodes).find((item) => item.nodeType === 1
      && ['oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'].includes((item as Element).localName)) ?? null
    root.insertBefore(calculation, insertBefore)
  }
  calculation.setAttribute('calcMode', 'auto')
  calculation.setAttribute('fullCalcOnLoad', '1')
  calculation.setAttribute('forceFullCalc', '1')
  zip.file(path, new XMLSerializer().serializeToString(xml))
}

export async function fillXlsxTemplate(
  original: ArrayBuffer,
  mappings: TosTemplateMapping[],
  values: TosXlsxValues,
  expectedSourceHash?: string,
) {
  if (mappings.length > MAX_MAPPINGS) throw new Error(`A TOS template supports at most ${MAX_MAPPINGS} confirmed mappings.`)
  if (values.rows.length > 5000) throw new Error('This TOS exceeds the supported custom-workbook row limit.')
  if (expectedSourceHash) {
    const actual = await sha256Hex(original)
    if (actual !== expectedSourceHash) throw new Error('The stored XLSX master no longer matches its saved mapping. Re-upload or remap the template.')
  }
  const zip = openXlsx(original)
  const sheets = workbookSheets(zip)
  const cache = new Map<string, Document>()
  const mappedFields = new Set<TosTemplateFieldKey>()
  const writtenCells = new Set<string>()
  let tableRangeKey = ''
  const writeMappedValue = (xml: Document, locator: XlsxCellLocator, value: TosXlsxValue) => {
    const key = `${locator.sheetName}!${locator.cellAddress.toUpperCase()}`
    if (writtenCells.has(key)) throw new Error(`${key} is mapped more than once. Choose one destination per field.`)
    writtenCells.add(key)
    writeAtLocator(xml, locator, value)
  }
  for (const mapping of mappings) {
    if (mappedFields.has(mapping.fieldKey)) throw new Error(`${mapping.fieldKey} is mapped more than once. Keep only one confirmed destination.`)
    mappedFields.add(mapping.fieldKey)
    if (mapping.locator.kind === 'worksheet_cell') {
      const value = values.scalar[mapping.fieldKey as TosTemplateFieldKey]
      if (value === undefined) continue
      const xml = sheetXml(zip, sheets, mapping.locator.sheetName, cache)
      writeMappedValue(xml, mapping.locator, value)
      continue
    }
    if (mapping.locator.kind !== 'worksheet_column') continue
    const locator = mapping.locator as XlsxColumnLocator
    const nextRangeKey = `${locator.sheetName}!${locator.firstDataRow}:${locator.lastDataRow}`
    if (tableRangeKey && tableRangeKey !== nextRangeKey) throw new Error('All competency-table columns must use the same worksheet and first/last data rows.')
    tableRangeKey = nextRangeKey
    const capacity = locator.lastDataRow - locator.firstDataRow + 1
    if (capacity < 1) throw new Error(`The saved range for ${mapping.fieldKey} is invalid.`)
    if (!/^[A-Z]{1,3}$/i.test(locator.columnAddress) || columnNumber(locator.columnAddress) > MAX_WORKSHEET_COLUMN
      || !Number.isSafeInteger(locator.firstDataRow) || !Number.isSafeInteger(locator.lastDataRow)
      || locator.firstDataRow < 1 || capacity > 5000 || locator.lastDataRow > MAX_WORKSHEET_ROW) {
      throw new Error(`The saved range for ${mapping.fieldKey} exceeds safe XLSX worksheet limits.`)
    }
    if (values.rows.length > capacity) throw new Error(`This template has ${capacity} competency row(s), but the TOS needs ${values.rows.length}. Use a larger template range or reduce the selected competencies.`)
    const xml = sheetXml(zip, sheets, locator.sheetName, cache)
    for (let index = 0; index < capacity; index += 1) {
      const value = values.rows[index]?.[mapping.fieldKey as TosTemplateFieldKey] ?? ''
      writeMappedValue(xml, { kind: 'worksheet_cell', sheetName: locator.sheetName, cellAddress: `${locator.columnAddress}${locator.firstDataRow + index}` }, value)
    }
  }
  for (const [name, xml] of cache) {
    const sheet = sheets.find((item) => item.name === name)!
    zip.file(sheet.path, new XMLSerializer().serializeToString(xml))
  }
  markWorkbookForRecalculation(zip)
  return zip.generate({ type: 'blob', mimeType: XLSX_MIME })
}

export function columnLocatorFromHeader(element: TosTemplateElement, firstDataRow: number, lastDataRow: number): XlsxColumnLocator {
  if (element.locator.kind !== 'worksheet_cell') throw new Error('Choose a worksheet cell for an XLSX column mapping.')
  const { column } = splitAddress(element.locator.cellAddress)
  return { kind: 'worksheet_column', sheetName: element.locator.sheetName, columnAddress: column, firstDataRow, lastDataRow }
}

export const TOS_FIELD_SYNONYMS: Record<string, string[]> = {
  teacherName: ['teacher', 'guro', 'name of teacher', 'teacher name', "teacher's name", 'prepared by'],
  teacherPosition: ['position', 'designation', 'rank', 'posisyon'],
  schoolName: ['school', 'paaralan', 'school name', 'pangalan ng paaralan'],
  region: ['region', 'rehiyon'],
  division: ['division', 'sangay', 'schools division'],
  district: ['district', 'distrito'],
  gradeLevel: ['grade', 'baitang', 'grade level', 'level'],
  sections: ['section', 'seksyon', 'sections'],
  gradeSection: ['grade & section', 'grade and section', 'grade / section', 'baitang at seksyon'],
  learningArea: ['learning area', 'subject', 'asignatura', 'course'],
  schoolYear: ['school year', 's.y.', 'sy', 'taong panuruan'],
  gradingTerm: ['quarter', 'grading period', 'markahan', 'term', 'period'],
  curriculumPeriod: ['curriculum period', 'curriculum-guide period'],
  tosTitle: ['table of specifications', 't.o.s.', 'tos', 'talahanayan ng ispesipikasyon'],
  assessmentTitle: ['assessment title', 'test title', 'examination', 'pagsusulit'],
  totalItems: ['total items', 'total test items', 'total questions', 'kabuuang bilang ng aytem'],
  weightingMethod: ['weighting', 'weighting method'],
  competencyRowNumber: ['item no.', 'row no.', 'row #', 'item #', 'bilang', 'row'],
  competencyCode: ['code', 'competency code', 'learning competency code', 'lc code', 'koda'],
  competency: ['competency', 'competencies', 'learning competency', 'learning competencies', 'kasanayan', 'mga kasanayan', 'pamantayan sa pagkatuto', 'objectives', 'most essential learning competencies', 'melc', 'content standard'],
  rowCurriculumPeriod: ['curriculum period', 'quarter', 'period', 'markahan'],
  instructionalMinutes: ['minutes', 'instructional minutes', 'min', 'time', 'hours', 'oras', 'araw', 'days', 'sessions'],
  weightPercent: ['weight', 'weight %', 'bahagdan', '% of items', 'percent', 'percentage', 'timbang'],
  itemCount: ['no. of items', 'number of items', 'item count', 'actual items', 'bilang ng aytem', 'items count', 'no of items', 'bilang ng mga aytem'],
  itemPlacement: ['item placement', 'placement', 'item number', 'item numbers', 'kinalalagyan', 'item distribution'],
  rowNotes: ['notes', 'remarks', 'puna'],
  totalWeight: ['total weight', '100%', 'total %'],
  preparedBy: ['prepared by', 'inihanda ni', 'guro'],
  reviewedBy: ['reviewed by', 'sinuri ni', 'checked by', 'recommending approval'],
  notedBy: ['noted by', 'pinagtibay ni', 'approved by'],
}

export function prioritizeTosTemplateElements(elements: TosTemplateElement[], maxElements = 320): TosTemplateElement[] {
  const scored = elements.map((element) => {
    let score = 0
    if (element.isFormula || element.text.startsWith('=') || (element.isMerged && !element.isMergedAnchor)) {
      return { element, score: -100 }
    }
    const lower = element.text.toLowerCase().trim()
    if (lower.length > 0) {
      score += 10
      for (const synonyms of Object.values(TOS_FIELD_SYNONYMS)) {
        if (synonyms.some((s) => lower === s)) {
          score += 100
          break
        } else if (synonyms.some((s) => s.length > 3 && lower.includes(s))) {
          score += 50
          break
        }
      }
    } else if (element.styleIndex) {
      score += 5
    }
    return { element, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.filter((item) => item.score >= 0).slice(0, maxElements).map((item) => item.element)
}

const IMPORTANT_FIELD_KEYS: TosTemplateFieldKey[] = [
  'competency', 'itemCount', 'itemPlacement', 'weightPercent', 'schoolName', 'teacherName', 'learningArea', 'gradeLevel', 'gradingTerm', 'tosTitle', 'totalItems'
]
const TABLE_COLUMN_FIELD_KEYS: TosTemplateFieldKey[] = [
  'competencyRowNumber', 'competencyCode', 'competency', 'rowCurriculumPeriod',
  'instructionalMinutes', 'weightPercent', 'itemCount', 'itemPlacement', 'rowNotes',
  'cognitiveItems1', 'cognitiveItems2', 'cognitiveItems3', 'cognitiveItems4',
  'cognitiveItems5', 'cognitiveItems6', 'cognitiveItems7', 'cognitiveItems8',
]

export function detectTosCandidates(elements: TosTemplateElement[]): Array<{ fieldKey: TosTemplateFieldKey; elementId: string; mode: TosTemplateMappingMode; confidence: number }> {
  const result: Array<{ fieldKey: TosTemplateFieldKey; elementId: string; mode: TosTemplateMappingMode; confidence: number }> = []
  const usedElements = new Set<string>()

  const usable = elements.filter((item) => !item.isFormula && !item.text.startsWith('=') && (!item.isMerged || item.isMergedAnchor))

  const fieldEntries = Object.entries(TOS_FIELD_SYNONYMS) as Array<[TosTemplateFieldKey, string[]]>
  fieldEntries.sort(([keyA], [keyB]) => {
    const isImpA = IMPORTANT_FIELD_KEYS.includes(keyA)
    const isImpB = IMPORTANT_FIELD_KEYS.includes(keyB)
    if (isImpA && !isImpB) return -1
    if (!isImpA && isImpB) return 1
    return 0
  })

  for (const [key, synonyms] of fieldEntries) {
    const matches: Array<{ element: TosTemplateElement; score: number }> = []
    const isTableColumn = TABLE_COLUMN_FIELD_KEYS.includes(key)

    for (const el of usable) {
      if (usedElements.has(el.id)) continue
      const lower = el.text.toLowerCase().trim()
      let matchScore = 0
      for (const syn of synonyms) {
        if (lower === syn) {
          matchScore = Math.max(matchScore, 100 + syn.length)
        } else if (syn.length > 3 && lower.includes(syn)) {
          matchScore = Math.max(matchScore, 70 + syn.length)
        }
      }
      if (matchScore > 0) {
        matches.push({ element: el, score: matchScore })
      }
    }

    matches.sort((a, b) => b.score - a.score)
    if (matches.length > 0) {
      const best = matches[0]
      usedElements.add(best.element.id)
      result.push({
        fieldKey: key,
        elementId: best.element.id,
        mode: isTableColumn ? 'table_column' : 'replace',
        confidence: best.score / 100,
      })
    }
  }

  return result
}

export function inferTosTableRange(
  elements: TosTemplateElement[],
  headerRow: number,
  sheetName: string,
): { firstDataRow: number; lastDataRow: number } {
  const sheetElements = elements.filter((e) => e.locator.sheetName === sheetName)
  const firstDataRow = Math.max(1, headerRow + 1)
  let lastDataRow = firstDataRow + 39

  const rowsAfterHeader = new Set<number>()
  sheetElements.forEach((e) => {
    const parsed = safeSplitAddress(e.locator.cellAddress)
    if (parsed && parsed.row >= firstDataRow) {
      rowsAfterHeader.add(parsed.row)
    }
  })

  const stopKeywords = ['total', 'kabuuan', 'prepared by', 'reviewed by', 'noted by', 'approved by', 'summary']
  let detectedStopRow: number | null = null

  sheetElements.forEach((e) => {
    const parsed = safeSplitAddress(e.locator.cellAddress)
    if (parsed && parsed.row > firstDataRow) {
      const lower = e.text.toLowerCase()
      if (stopKeywords.some((kw) => lower.includes(kw))) {
        if (detectedStopRow === null || parsed.row < detectedStopRow) {
          detectedStopRow = parsed.row
        }
      }
    }
  })

  if (detectedStopRow !== null && detectedStopRow > firstDataRow) {
    lastDataRow = detectedStopRow - 1
  } else if (rowsAfterHeader.size > 0) {
    const maxRowFound = Math.max(...rowsAfterHeader)
    lastDataRow = Math.max(firstDataRow + 5, maxRowFound)
  }

  return { firstDataRow, lastDataRow: Math.min(firstDataRow + 500, lastDataRow) }
}
