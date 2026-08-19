import type {
  ClassLearner,
  ResultEntryMode,
  RosterImportColumnRole,
  RosterImportMapping,
  RosterImportRow,
} from '../types/results'

/**
 * CSV/XLSX import is intentionally split into two layers. This file parses
 * CSV and validates mappings; the XLSX adapter accepts rows already parsed by
 * the host's workbook reader. No workbook, learner name, or response is sent
 * to Gemini by this module.
 */

export type TabularRows = {
  headers: readonly string[]
  rows: readonly (readonly unknown[])[]
  source?: 'csv' | 'xlsx' | 'other'
}

export type CsvParseResult = TabularRows & { errors: string[] }

export type RosterImportPreviewRow = RosterImportRow & { sectionName: string }

export type RosterImportPreview = {
  source: TabularRows['source']
  sectionName: string
  headers: string[]
  mapping: RosterImportMapping
  rows: RosterImportPreviewRow[]
  errors: string[]
  warnings: string[]
  ready: boolean
}

export type RosterImportOptions = {
  /** Required so a multi-section assignment never receives an unscoped roster. */
  sectionName: string
  mapping?: RosterImportMapping
  /** A section column may be used when one workbook contains multiple sections. */
  sectionColumn?: string
  existingLearners?: readonly ClassLearner[]
}

export type ResultsImportMapping = {
  learnerColumn: string | null
  scoreColumn: string | null
  itemColumns: Record<string, number>
}

export type ResultsImportPreviewRow = {
  rowNumber: number
  learnerKey: string
  answers: Record<number, string | null>
  rawScore: string | null
  status: 'ready' | 'duplicate' | 'invalid'
  messages: string[]
}

export type ResultsImportPreview = {
  source: TabularRows['source']
  sectionName: string
  headers: string[]
  mapping: ResultsImportMapping
  rows: ResultsImportPreviewRow[]
  errors: string[]
  warnings: string[]
  ready: boolean
}

export type ResultsImportOptions = {
  sectionName: string
  mode: ResultEntryMode
  itemCount?: number
  totalPossiblePoints?: number
  mapping?: Partial<ResultsImportMapping>
}

function clean(value: unknown) {
  return value === null || value === undefined ? '' : String(value).normalize('NFKC').trim()
}

export function normalizeImportKey(value: unknown) {
  return clean(value).replace(/\s+/gu, ' ').toLocaleLowerCase('en-US')
}

function normalizedHeader(value: unknown) {
  return normalizeImportKey(value).replace(/[._-]+/gu, ' ').replace(/\s+/gu, ' ')
}

function isEmptyRow(row: readonly unknown[]) {
  return row.every((value) => clean(value) === '')
}

/** RFC-4180 compatible CSV parser with quoted commas, escaped quotes, and CRLF. */
export function parseCsv(text: string): CsvParseResult {
  const source = String(text ?? '').replace(/^\uFEFF/u, '')
  const rows: string[][] = []
  const errors: string[] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let sawQuote = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          sawQuote = true
        }
      } else field += character
      continue
    }
    if (character === '"' && field === '') {
      inQuotes = true
      sawQuote = true
    } else if (character === ',') {
      row.push(field)
      field = ''
      sawQuote = false
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      sawQuote = false
    } else {
      if (sawQuote) errors.push(`Unexpected text after a closing quote near character ${index + 1}.`)
      field += character
    }
  }
  if (inQuotes) errors.push('The CSV contains an unterminated quoted field.')
  if (field !== '' || row.length > 0 || source.endsWith(',')) {
    row.push(field)
    rows.push(row)
  }
  const headers = (rows.shift() ?? []).map((value, index) => clean(value) || `Column ${index + 1}`)
  const width = headers.length
  const normalizedRows = rows.map((values) => Array.from({ length: width }, (_, index) => values[index] ?? ''))
  return { headers, rows: normalizedRows, source: 'csv', errors }
}

function tabularToArrays(input: TabularRows): { headers: string[]; rows: unknown[][]; errors: string[] } {
  const headers = input.headers.map((value, index) => clean(value) || `Column ${index + 1}`)
  const errors: string[] = []
  const seen = new Set<string>()
  headers.forEach((header) => {
    const key = normalizedHeader(header)
    if (seen.has(key)) errors.push(`Column header "${header}" is duplicated.`)
    seen.add(key)
  })
  const rows = input.rows.map((row) => Array.from({ length: headers.length }, (_, index) => row[index] ?? ''))
  return { headers, rows, errors }
}

function headersForRole(headers: readonly string[], role: 'display_name' | 'local_reference') {
  const candidates = role === 'display_name'
    ? new Set([
        'name', 'learner', 'learner name', 'student', 'student name', 'display name',
        'full name', 'pangalan', "learner's name", 'learners name',
        'learner name (last, first middle)', 'name of learner', 'name of student',
      ])
    : new Set(['reference', 'local reference', 'teacher reference', 'ref', 'code', 'local ref'])
  return headers.filter((header) => candidates.has(normalizedHeader(header)))
}

function validateRosterMapping(headers: readonly string[], supplied?: RosterImportMapping) {
  const errors: string[] = []
  const mapping: RosterImportMapping = Object.fromEntries(headers.map((header) => [header, 'ignore' as RosterImportColumnRole]))
  if (supplied) {
    for (const [header, role] of Object.entries(supplied)) {
      if (!headers.includes(header)) errors.push(`Mapping refers to missing column "${header}".`)
      else if (role !== 'ignore' && role !== 'display_name' && role !== 'local_reference') errors.push(`Mapping role for "${header}" is not supported.`)
      else mapping[header] = role
    }
    if (Object.values(mapping).filter((role) => role === 'display_name').length > 1) errors.push('Roster mapping may contain only one display-name column.')
    if (Object.values(mapping).filter((role) => role === 'local_reference').length > 1) errors.push('Roster mapping may contain only one local-reference column.')
    return { mapping, errors }
  }
  for (const role of ['display_name', 'local_reference'] as const) {
    const candidates = headersForRole(headers, role)
    if (candidates.length > 1) errors.push(`Ambiguous ${role.replace('_', ' ')} mapping: choose one of ${candidates.map((value) => `"${value}"`).join(', ')}.`)
    if (candidates.length === 1) mapping[candidates[0]] = role
    if (role === 'display_name' && candidates.length === 0) errors.push('A learner display-name column is required; map it explicitly before importing.')
  }
  return { mapping, errors }
}

function sectionForRow(
  headers: readonly string[],
  row: readonly unknown[],
  options: RosterImportOptions,
  errors: string[],
) {
  const configured = clean(options.sectionName)
  if (options.sectionColumn) {
    if (!headers.includes(options.sectionColumn)) errors.push(`Section mapping refers to missing column "${options.sectionColumn}".`)
    else return clean(row[headers.indexOf(options.sectionColumn)])
  }
  return configured
}

function rosterPreviewFromTabular(input: TabularRows, options: RosterImportOptions): RosterImportPreview {
  const tabular = tabularToArrays(input)
  const errors = [...tabular.errors]
  const warnings: string[] = []
  const sectionName = clean(options.sectionName)
  if (!sectionName && !options.sectionColumn) errors.push('A section name is required for every roster import.')
  const { mapping, errors: mappingErrors } = validateRosterMapping(tabular.headers, options.mapping)
  errors.push(...mappingErrors)
  const displayColumn = tabular.headers.find((header) => mapping[header] === 'display_name')
  const localReferenceColumn = tabular.headers.find((header) => mapping[header] === 'local_reference')
  const existing = (options.existingLearners ?? []).filter((learner) => learner.sectionName === sectionName)
  const existingNames = new Set(existing.map((learner) => normalizeImportKey(learner.displayName)))
  const existingReferences = new Set(existing.map((learner) => normalizeImportKey(learner.localReference)))
  const seenNames = new Set<string>()
  const seenReferences = new Set<string>()
  const rows: RosterImportPreviewRow[] = tabular.rows.map((values, index) => {
    const rowNumber = index + 2
    const messages: string[] = []
    const displayName = displayColumn ? clean(values[tabular.headers.indexOf(displayColumn)]) : ''
    const localReference = localReferenceColumn ? clean(values[tabular.headers.indexOf(localReferenceColumn)]) || null : null
    const rowSectionName = sectionForRow(tabular.headers, values, options, errors)
    if (!rowSectionName) messages.push('Section is required.')
    if (isEmptyRow(values)) messages.push('Empty rows must be removed before import.')
    if (!displayName) messages.push('Learner display name is required.')
    const nameKey = normalizeImportKey(displayName)
    const referenceKey = normalizeImportKey(localReference)
    const duplicateName = Boolean(nameKey && (seenNames.has(nameKey) || existingNames.has(nameKey)))
    const duplicateReference = Boolean(referenceKey && (seenReferences.has(referenceKey) || existingReferences.has(referenceKey)))
    if (duplicateName) messages.push('The display name duplicates another learner in this section; verify or correct the row.')
    if (duplicateReference) messages.push('The local reference duplicates another learner in this section; verify or correct the row.')
    if (nameKey) seenNames.add(nameKey)
    if (referenceKey) seenReferences.add(referenceKey)
    const duplicate = duplicateName || duplicateReference
    const invalid = messages.length > 0 && !duplicate
    return {
      rowNumber,
      sectionName: rowSectionName || sectionName,
      displayName,
      localReference,
      status: duplicate ? 'duplicate' : invalid ? 'invalid' : 'ready',
      messages,
    }
  })
  if (rows.some((row) => row.status === 'duplicate')) errors.push('Duplicate learner rows require correction before import.')
  if (rows.some((row) => row.status === 'invalid')) errors.push('Invalid learner rows require correction before import.')
  if (!tabular.rows.length) errors.push('The import contains no learner rows.')
  return { source: input.source, sectionName, headers: tabular.headers, mapping, rows, errors, warnings, ready: errors.length === 0 && rows.length > 0 }
}

export function previewRosterTabularRows(input: TabularRows, options: RosterImportOptions): RosterImportPreview {
  return rosterPreviewFromTabular(input, options)
}

export function previewRosterCsv(text: string, options: RosterImportOptions): RosterImportPreview {
  const parsed = parseCsv(text)
  const preview = rosterPreviewFromTabular(parsed, options)
  return { ...preview, errors: [...parsed.errors.map((message) => `CSV: ${message}`), ...preview.errors], ready: parsed.errors.length === 0 && preview.ready }
}

/** Compatibility alias for callers that use “parse” for the preview stage. */
export const parseRosterCsv = previewRosterCsv

function parseItemHeader(header: string): number | null {
  const normalized = normalizedHeader(header)
  if (/^\d+$/u.test(normalized)) return Number(normalized)
  const match = /^(?:item|question|q)\s*(\d+)$/u.exec(normalized)
  return match ? Number(match[1]) : null
}

function scoreHeaders(headers: readonly string[]) {
  return headers.filter((header) => new Set(['score', 'raw score', 'raw points', 'points', 'total', 'raw']).has(normalizedHeader(header)))
}

function learnerHeaders(headers: readonly string[]) {
  return headers.filter((header) =>
    new Set([
      'learner', 'learner name', 'student', 'student name', 'name', 'display name',
      'pangalan', "learner's name", 'learners name', 'learner name (last, first middle)',
      'name of learner', 'name of student',
    ]).has(normalizedHeader(header))
  )
}

function inferResultsMapping(headers: readonly string[], options: ResultsImportOptions) {
  const errors: string[] = []
  const learnerCandidates = learnerHeaders(headers)
  const scoreCandidates = scoreHeaders(headers)
  const learnerColumn = options.mapping?.learnerColumn ?? (learnerCandidates.length === 1 ? learnerCandidates[0] : null)
  const scoreColumn = options.mapping?.scoreColumn ?? (scoreCandidates.length === 1 ? scoreCandidates[0] : null)
  if (options.mapping?.learnerColumn && !headers.includes(options.mapping.learnerColumn)) errors.push(`Learner mapping refers to missing column "${options.mapping.learnerColumn}".`)
  if (options.mapping?.scoreColumn && !headers.includes(options.mapping.scoreColumn)) errors.push(`Score mapping refers to missing column "${options.mapping.scoreColumn}".`)
  if (!options.mapping?.learnerColumn && learnerCandidates.length > 1) errors.push(`Ambiguous learner mapping: choose one of ${learnerCandidates.map((value) => `"${value}"`).join(', ')}.`)
  if (!options.mapping?.scoreColumn && scoreCandidates.length > 1) errors.push(`Ambiguous score mapping: choose one of ${scoreCandidates.map((value) => `"${value}"`).join(', ')}.`)
  if (!learnerColumn) errors.push('A learner/name column is required; map it explicitly before importing.')
  const itemColumns: Record<string, number> = {}
  const configuredItems = options.mapping?.itemColumns ?? {}
  if (Object.keys(configuredItems).length) {
    const assignedNumbers = new Set<number>()
    for (const [header, itemNumber] of Object.entries(configuredItems)) {
      if (!headers.includes(header)) errors.push(`Item mapping refers to missing column "${header}".`)
      else if (!Number.isSafeInteger(itemNumber) || itemNumber < 1) errors.push(`Item mapping for "${header}" must be a positive whole number.`)
      else if (assignedNumbers.has(itemNumber)) errors.push(`Ambiguous item mapping: more than one column maps to item ${itemNumber}.`)
      else {
        itemColumns[header] = itemNumber
        assignedNumbers.add(itemNumber)
      }
    }
  } else {
    for (const header of headers) {
      const number = parseItemHeader(header)
      if (number !== null) {
        const duplicate = Object.values(itemColumns).includes(number)
        if (duplicate) errors.push(`Ambiguous item mapping: more than one column maps to item ${number}.`)
        itemColumns[header] = number
      }
    }
  }
  if (options.itemCount !== undefined) {
    for (const number of Object.values(itemColumns)) if (number > options.itemCount) errors.push(`Item ${number} is outside the selected assessment's ${options.itemCount} items.`)
  }
  if (options.mode === 'score_only' && itemColumns && Object.keys(itemColumns).length) errors.push('Score-only import cannot also contain item-answer columns; choose one explicit mode.')
  if (options.mode !== 'score_only' && !Object.keys(itemColumns).length) errors.push('Item-level import requires at least one mapped item column; score-only rows cannot produce item analysis.')
  if (options.mode === 'score_only' && !scoreColumn) errors.push('Score-only import requires one raw-score column; map it explicitly before importing.')
  return { mapping: { learnerColumn, scoreColumn, itemColumns }, errors }
}

function resultsPreviewFromTabular(input: TabularRows, options: ResultsImportOptions): ResultsImportPreview {
  const tabular = tabularToArrays(input)
  const errors = [...tabular.errors]
  const warnings: string[] = []
  const sectionName = clean(options.sectionName)
  if (!sectionName) errors.push('A section name is required for every results import.')
  const inferred = inferResultsMapping(tabular.headers, options)
  errors.push(...inferred.errors)
  const learnerIndex = inferred.mapping.learnerColumn ? tabular.headers.indexOf(inferred.mapping.learnerColumn) : -1
  const scoreIndex = inferred.mapping.scoreColumn ? tabular.headers.indexOf(inferred.mapping.scoreColumn) : -1
  const itemEntries = Object.entries(inferred.mapping.itemColumns).sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0], 'en'))
  const seen = new Set<string>()
  const rows: ResultsImportPreviewRow[] = tabular.rows.map((values, index) => {
    const messages: string[] = []
    const learnerKey = learnerIndex >= 0 ? clean(values[learnerIndex]) : ''
    const rawScore = scoreIndex >= 0 ? clean(values[scoreIndex]) || null : null
    if (isEmptyRow(values)) messages.push('Empty rows must be removed before import.')
    if (!learnerKey) messages.push('Learner/name is required.')
    const duplicate = Boolean(learnerKey && seen.has(normalizeImportKey(learnerKey)))
    if (duplicate) messages.push('The learner appears more than once in this import.')
    if (learnerKey) seen.add(normalizeImportKey(learnerKey))
    if (options.mode === 'score_only' && rawScore === null) messages.push('Raw score is required in score-only mode.')
    if (options.mode === 'score_only' && rawScore !== null) {
      const parsedScore = Number(rawScore)
      if (!Number.isFinite(parsedScore) || parsedScore < 0) messages.push('Raw score must be a nonnegative number.')
      else if (Number.isFinite(options.totalPossiblePoints) && parsedScore > Number(options.totalPossiblePoints)) messages.push('Raw score cannot exceed the selected assessment total.')
    }
    const answers: Record<number, string | null> = {}
    for (const [header, itemNumber] of itemEntries) answers[itemNumber] = clean(values[tabular.headers.indexOf(header)]) || null
    const invalid = messages.length > 0 && !duplicate
    return { rowNumber: index + 2, learnerKey, answers, rawScore, status: duplicate ? 'duplicate' : invalid ? 'invalid' : 'ready', messages }
  })
  if (rows.some((row) => row.status === 'duplicate')) errors.push('Duplicate learner rows require correction before import.')
  if (rows.some((row) => row.status === 'invalid')) errors.push('Invalid result rows require correction before import.')
  if (!tabular.rows.length) errors.push('The import contains no result rows.')
  return { source: input.source, sectionName, headers: tabular.headers, mapping: inferred.mapping, rows, errors, warnings, ready: errors.length === 0 && rows.length > 0 }
}

export function previewResultsTabularRows(input: TabularRows, options: ResultsImportOptions): ResultsImportPreview {
  return resultsPreviewFromTabular(input, options)
}

export function previewResultsCsv(text: string, options: ResultsImportOptions): ResultsImportPreview {
  const parsed = parseCsv(text)
  const preview = resultsPreviewFromTabular(parsed, options)
  return { ...preview, errors: [...parsed.errors.map((message) => `CSV: ${message}`), ...preview.errors], ready: parsed.errors.length === 0 && preview.ready }
}

export const parseResultsCsv = previewResultsCsv

export function buildTabularRows(headers: readonly string[], rows: readonly (readonly unknown[])[], source: TabularRows['source'] = 'xlsx'): TabularRows {
  return { headers: [...headers], rows: rows.map((row) => [...row]), source }
}
