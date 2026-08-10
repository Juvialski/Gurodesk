import PizZip from 'pizzip'
import { sha256Hex } from './docxTemplate'
import { extractXlsxTemplateStructure } from './xlsxTemplate'
import { parseCsv } from './resultsImport'
import type {
  CustomCurriculumCompetencyDraft,
  CustomCurriculumDomainDraft,
  CustomCurriculumPeriodDraft,
  CustomCurriculumReview,
  CustomCurriculumStandardDraft,
} from '../types/customCurriculum'

export const CUSTOM_CURRICULUM_MAX_FILE_BYTES = 15 * 1024 * 1024
export const CUSTOM_CURRICULUM_MAX_EXTRACTED_CHARS = 350_000

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md'] as const
export type CustomCurriculumFileExtension = typeof SUPPORTED_EXTENSIONS[number]

const MIME_BY_EXTENSION: Record<CustomCurriculumFileExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
}

function extensionOf(name: string): CustomCurriculumFileExtension | null {
  const extension = name.trim().toLowerCase().split('.').pop() ?? ''
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)
    ? extension as CustomCurriculumFileExtension
    : null
}

export function validateCurriculumFile(file: File) {
  const extension = extensionOf(file.name)
  if (!extension) throw new Error('Choose a PDF, DOCX, XLSX, CSV, TXT, or Markdown curriculum file.')
  if (file.size <= 0) throw new Error('The curriculum file is empty.')
  if (file.size > CUSTOM_CURRICULUM_MAX_FILE_BYTES) throw new Error('Curriculum files must be 15 MB or smaller.')
  return { extension, mimeType: MIME_BY_EXTENSION[extension] }
}

function textFromDocx(buffer: ArrayBuffer) {
  let zip: PizZip
  try { zip = new PizZip(buffer) } catch { throw new Error('This DOCX file is not readable.') }
  const raw = zip.file('word/document.xml')?.asText()
  if (!raw) throw new Error('This DOCX does not contain a readable document body.')
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error('This DOCX contains unsupported XML declarations.')
  const xml = new DOMParser().parseFromString(raw, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length) throw new Error('The DOCX document XML could not be parsed.')
  const paragraphs = Array.from(xml.getElementsByTagNameNS('*', 'p'))
  return paragraphs
    .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS('*', 't')).map((item) => item.textContent ?? '').join('').trim())
    .filter(Boolean)
    .join('\n')
}

function textFromXlsx(buffer: ArrayBuffer) {
  const elements = extractXlsxTemplateStructure(buffer)
  const seen = new Set<string>()
  const lines: string[] = []
  for (const element of elements) {
    const text = element.text.trim()
    if (!text || text.startsWith('=') || seen.has(`${element.id}:${text}`)) continue
    seen.add(`${element.id}:${text}`)
    lines.push(`${element.id}: ${text}`)
  }
  return lines.join('\n')
}

function textFromCsv(raw: string) {
  const parsed = parseCsv(raw)
  const rows = [parsed.headers, ...parsed.rows]
  return rows.map((row) => row.map((value) => String(value ?? '').trim()).filter(Boolean).join(' | ')).filter(Boolean).join('\n')
}

export async function inspectCurriculumFile(file: File) {
  const { extension, mimeType } = validateCurriculumFile(file)
  const buffer = await file.arrayBuffer()
  const sourceHash = await sha256Hex(buffer)
  let extractedText: string | null = null
  if (extension === 'docx') extractedText = textFromDocx(buffer)
  else if (extension === 'xlsx') extractedText = textFromXlsx(buffer)
  else if (extension === 'csv') extractedText = textFromCsv(new TextDecoder().decode(buffer))
  else if (extension === 'txt' || extension === 'md') extractedText = new TextDecoder().decode(buffer)
  // PDF is intentionally analyzed from the original bytes by Gemini document
  // understanding; extracting it as plain text would discard diagrams/tables.
  if (extractedText !== null) {
    extractedText = extractedText.normalize('NFKC').replace(/\u0000/g, '').slice(0, CUSTOM_CURRICULUM_MAX_EXTRACTED_CHARS).trim()
    if (!extractedText) throw new Error('No readable curriculum text was found in this file.')
  }
  return { buffer, sourceHash, mimeType, extension, extractedText }
}

export async function sha256Text(value: string) {
  return sha256Hex(new TextEncoder().encode(value).buffer)
}

function compactKey(value: string, fallback: string) {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized.slice(0, 80) || fallback
}

function asString(value: unknown, max = 12000) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, max) : ''
}

function asNullableString(value: unknown, max = 120) {
  const text = asString(value, max)
  return text || null
}

function asPage(value: unknown) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 && page <= 10000 ? page : null
}

export function normalizeCustomCurriculumReview(value: unknown, fallback: Partial<CustomCurriculumReview> = {}): CustomCurriculumReview {
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const mode = root.curriculumMode === 'hybrid' || fallback.curriculumMode === 'hybrid' ? 'hybrid' : 'custom'
  const periodsRaw = Array.isArray(root.periods) ? root.periods.slice(0, 16) : fallback.periods ?? []
  const periods: CustomCurriculumPeriodDraft[] = periodsRaw.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const item = raw as Record<string, unknown>
    const label = asString(item.label, 120)
    if (!label) return []
    const rawType = asString(item.periodType, 20)
    const periodType = (['term', 'quarter', 'semester', 'year'] as const).includes(rawType as 'term') ? rawType as CustomCurriculumPeriodDraft['periodType'] : 'quarter'
    return [{ key: asString(item.key, 80) || compactKey(label, `period-${index + 1}`), label, sequence: Math.max(1, Math.min(50, Number(item.sequence) || index + 1)), periodType }]
  })
  const safePeriods = periods.length ? periods : [{ key: 'year', label: 'Year', sequence: 1, periodType: 'year' }]

  const domainsRaw = Array.isArray(root.domains) ? root.domains.slice(0, 120) : fallback.domains ?? []
  const domains: CustomCurriculumDomainDraft[] = domainsRaw.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const item = raw as Record<string, unknown>
    const name = asString(item.name, 200)
    if (!name) return []
    return [{ key: asString(item.key, 80) || compactKey(name, `domain-${index + 1}`), code: asNullableString(item.code, 80), name, sortOrder: Math.max(0, Math.min(10000, Number(item.sortOrder) || index)) }]
  })
  const safeDomains = domains.length ? domains : [{ key: 'general', code: null, name: 'General', sortOrder: 0 }]
  const periodKeys = new Set(safePeriods.map((item) => item.key))
  const domainKeys = new Set(safeDomains.map((item) => item.key))

  const standardsRaw = Array.isArray(root.standards) ? root.standards.slice(0, 800) : fallback.standards ?? []
  const standards: CustomCurriculumStandardDraft[] = standardsRaw.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const item = raw as Record<string, unknown>
    const standardText = asString(item.standardText)
    if (!standardText) return []
    const rawType = asString(item.standardType, 30)
    const standardType = (['content', 'performance', 'stage', 'key_stage', 'other'] as const).includes(rawType as 'content') ? rawType as CustomCurriculumStandardDraft['standardType'] : 'other'
    const periodKey = asNullableString(item.periodKey, 80)
    const domainKey = asNullableString(item.domainKey, 80)
    return [{ standardType, standardText, periodKey: periodKey && periodKeys.has(periodKey) ? periodKey : null, domainKey: domainKey && domainKeys.has(domainKey) ? domainKey : null, sortOrder: Math.max(0, Math.min(100000, Number(item.sortOrder) || index)), sourcePage: asPage(item.sourcePage) }]
  })

  const competenciesRaw = Array.isArray(root.competencies) ? root.competencies.slice(0, 2500) : fallback.competencies ?? []
  const competencies: CustomCurriculumCompetencyDraft[] = competenciesRaw.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const item = raw as Record<string, unknown>
    const competencyText = asString(item.competencyText)
    if (!competencyText) return []
    const periodKey = asNullableString(item.periodKey, 80)
    const domainKey = asNullableString(item.domainKey, 80)
    return [{ competencyCode: asNullableString(item.competencyCode, 120), competencyText, periodKey: periodKey && periodKeys.has(periodKey) ? periodKey : null, domainKey: domainKey && domainKeys.has(domainKey) ? domainKey : null, sortOrder: Math.max(0, Math.min(100000, Number(item.sortOrder) || index)), sourcePage: asPage(item.sourcePage) }]
  })

  return {
    schemaVersion: 1,
    curriculumMode: mode,
    title: asString(root.title, 240) || fallback.title || 'Untitled school curriculum',
    organizationName: asString(root.organizationName, 240) || fallback.organizationName || '',
    schoolYear: asString(root.schoolYear, 20) || fallback.schoolYear || '2026-2027',
    gradeLevel: asString(root.gradeLevel, 80) || fallback.gradeLevel || 'Grade 7',
    learningArea: asString(root.learningArea, 160) || fallback.learningArea || 'Mathematics',
    periods: safePeriods,
    domains: safeDomains,
    standards,
    competencies,
    warnings: (Array.isArray(root.warnings) ? root.warnings : fallback.warnings ?? []).map((item) => asString(item, 500)).filter(Boolean).slice(0, 30),
  }
}

export function validateCustomCurriculumReview(review: CustomCurriculumReview) {
  const errors: string[] = []
  if (!review.title.trim()) errors.push('Give the curriculum a title.')
  if (!/^\d{4}-\d{4}$/.test(review.schoolYear)) errors.push('School year must use YYYY-YYYY.')
  if (!review.gradeLevel.trim()) errors.push('Grade level is required.')
  if (!review.learningArea.trim()) errors.push('Learning area is required.')
  if (!review.periods.length) errors.push('Add at least one curriculum period.')
  if (!review.domains.length) errors.push('Add at least one domain or strand.')
  if (!review.competencies.length) errors.push('Add at least one competency or learning objective before approval.')
  const periodKeys = new Set(review.periods.map((item) => item.key))
  const domainKeys = new Set(review.domains.map((item) => item.key))
  if (periodKeys.size !== review.periods.length) errors.push('Curriculum period keys must be unique.')
  if (domainKeys.size !== review.domains.length) errors.push('Domain keys must be unique.')
  review.competencies.forEach((item, index) => {
    if (!item.competencyText.trim()) errors.push(`Competency ${index + 1} is empty.`)
    if (item.periodKey && !periodKeys.has(item.periodKey)) errors.push(`Competency ${index + 1} references an unknown period.`)
    if (item.domainKey && !domainKeys.has(item.domainKey)) errors.push(`Competency ${index + 1} references an unknown domain.`)
  })
  return errors
}
