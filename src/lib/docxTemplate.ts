import { openOfficeArchive, parseOfficeXml } from './officeArchive'
import { replaceMappedWordText, replaceWordTextRange, replaceWordTokens, wordText } from './wordText'
import type {
  DocumentTemplateElement,
  DocumentTemplateMapping,
  DocxElementLocator,
  LessonTemplateFieldKey,
  TemplateMappingMode,
} from '../types/documentTemplate'
import type { LessonPlanExportModel } from '../types/export'

function childrenByLocalName(element: Element, localName: string) {
  return Array.from(element.children).filter((child) => child.localName === localName)
}

function descendantsByLocalName(element: Element, localName: string) {
  return Array.from(element.getElementsByTagNameNS('*', localName))
}

function textOf(element: Element) {
  return descendantsByLocalName(element, 't').map((item) => item.textContent ?? '').join('').replace(/\s+/g, ' ').trim()
}

function paragraphText(element: Element) {
  return descendantsByLocalName(element, 't').map((item) => item.textContent ?? '').join('').trim()
}

function suggestedMode(text: string): TemplateMappingMode {
  const normalized = text.trim()
  if (/_{3,}|\.{4,}|…{3,}/.test(normalized)) return 'append_after_label'
  if (/[:：]\s*$/.test(normalized)) return 'append_after_label'
  return 'replace'
}

function rowContext(cells: Element[]) {
  return cells.map((cell, index) => {
    const value = textOf(cell)
    return value ? `C${index + 1}: ${value}` : `C${index + 1}: [blank]`
  }).join(' | ')
}

export function extractDocxTemplateStructure(buffer: ArrayBuffer): DocumentTemplateElement[] {
  const zip = openOfficeArchive(buffer, 'docx')
  const raw = zip.file('word/document.xml')?.asText()
  if (!raw) throw new Error('This DOCX does not contain a readable Word document body.')
  const xml = parseOfficeXml(raw, 'Word document')
  if (xml.getElementsByTagName('parsererror').length) throw new Error('The DOCX document XML could not be parsed.')
  const body = Array.from(xml.getElementsByTagNameNS('*', 'body'))[0]
  if (!body) throw new Error('The DOCX document body could not be found.')

  const elements: DocumentTemplateElement[] = []
  let bodyParagraphIndex = 0
  let tableIndex = 0

  for (const child of Array.from(body.children)) {
    if (child.localName === 'p') {
      const text = paragraphText(child)
      if (text) {
        elements.push({
          id: `p${bodyParagraphIndex}`,
          locator: { kind: 'body_paragraph', paragraphIndex: bodyParagraphIndex },
          kind: 'paragraph',
          text,
          context: text,
          suggestedMode: suggestedMode(text),
        })
      }
      bodyParagraphIndex += 1
      continue
    }

    if (child.localName !== 'tbl') continue
    const rows = childrenByLocalName(child, 'tr')
    rows.forEach((row, rowIndex) => {
      const cells = childrenByLocalName(row, 'tc')
      const context = rowContext(cells)
      cells.forEach((cell, cellIndex) => {
        const paragraphs = childrenByLocalName(cell, 'p')
        const text = textOf(cell)
        const hasBlankSibling = cells.some((sibling, siblingIndex) => siblingIndex !== cellIndex && !textOf(sibling))
        if (text || hasBlankSibling || cells.length > 1) {
          const paragraphIndex = Math.max(0, paragraphs.findIndex((p) => paragraphText(p).trim().length > 0))
          elements.push({
            id: `t${tableIndex}r${rowIndex}c${cellIndex}`,
            locator: { kind: 'table_cell', tableIndex, rowIndex, cellIndex, paragraphIndex },
            kind: 'table_cell',
            text,
            context,
            suggestedMode: suggestedMode(text),
          })
        }
      })
    })
    tableIndex += 1
  }

  return elements.slice(0, 400)
}

export async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function locateParagraph(body: Element, locator: DocxElementLocator): Element | null {
  if (locator.kind === 'body_paragraph') {
    const paragraphs = Array.from(body.children).filter((child) => child.localName === 'p')
    return paragraphs[locator.paragraphIndex] ?? null
  }
  const tables = Array.from(body.children).filter((child) => child.localName === 'tbl')
  const table = tables[locator.tableIndex]
  if (!table) return null
  const row = childrenByLocalName(table, 'tr')[locator.rowIndex]
  if (!row) return null
  const cell = childrenByLocalName(row, 'tc')[locator.cellIndex]
  if (!cell) return null
  const paragraphs = childrenByLocalName(cell, 'p')
  return paragraphs[locator.paragraphIndex] ?? paragraphs[0] ?? null
}

function prefixForAppend(existing: string) {
  let prefix = existing.replace(/_{3,}|\.{4,}|…{3,}/g, '').trim()
  if (!prefix) return ''
  if (/[:：]\s*$/.test(prefix)) return `${prefix} `
  const colon = Math.max(prefix.lastIndexOf(':'), prefix.lastIndexOf('：'))
  if (colon >= 0 && colon < prefix.length - 1) prefix = prefix.slice(0, colon + 1)
  return `${prefix} `
}

function replaceParagraphText(paragraph: Element, value: string, mode: TemplateMappingMode) {
  const existing = wordText(paragraph)
  if (mode === 'append_after_label') {
    const prefix = prefixForAppend(existing)
    const preserved = prefix.trimEnd()
    const index = existing.indexOf(preserved)
    const end = index >= 0 ? index + preserved.length : 0
    replaceWordTextRange(paragraph, end, existing.length, (preserved ? ' ' : '') + value)
  } else if (/\{\{[a-zA-Z0-9_ .]+\}\}/.test(existing)) {
    const match = existing.match(/\{\{[a-zA-Z0-9_ .]+\}\}/)!
    replaceWordTextRange(paragraph, match.index!, match.index! + match[0].length, value)
  } else replaceMappedWordText(paragraph, value)
}

export type LessonTemplateValues = Partial<Record<LessonTemplateFieldKey, string>>

function sectionBody(model: LessonPlanExportModel, key: string) {
  const groups = [model.ilaw.intentions, model.ilaw.learningExperience, model.ilaw.assessingLearning, model.ilaw.waysForward]
  return groups.flat().find((section) => section.key === key)?.body ?? ''
}

export function buildLessonTemplateValues(model: LessonPlanExportModel): LessonTemplateValues {
  const competencyAndStandards = sectionBody(model, 'competency-standards')
  const performanceMarker = /(?:Performance Standard|Pamantayan sa Pagganap):\s*/i
  const curriculumLines = competencyAndStandards.split(/\r?\n/)

  let inPerformanceSection = false
  const performanceLines: string[] = []
  const competencyLines: string[] = []

  for (const line of curriculumLines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('### ')) {
      const heading = trimmed.replace(/^###\s+/, '').toLowerCase()
      inPerformanceSection = heading.includes('performance standard') || heading.includes('pamantayan sa pagganap')
      continue
    }
    if (inPerformanceSection) {
      const cleaned = trimmed.replace(/^[•*-]\s+/, '')
      if (cleaned) performanceLines.push(cleaned)
    } else if (performanceMarker.test(trimmed)) {
      const cleaned = trimmed.replace(performanceMarker, '').trim()
      if (cleaned) performanceLines.push(cleaned)
    } else {
      competencyLines.push(trimmed)
    }
  }

  const competency = competencyLines.join('\n').trim()
  const performanceStandard = performanceLines.join('\n').trim()
  const prepared = model.signatories.find((item) => item.role === model.labels.preparedBy)
  const reviewed = model.signatories.find((item) => item.role === model.labels.reviewedBy)
  const noted = model.signatories.find((item) => item.role === model.labels.notedBy)
  const signatory = (item?: { name: string; title: string }) => [item?.name, item?.title].filter(Boolean).join('\n')

  return {
    teacherName: model.identity.teacherName,
    teacherPosition: model.identity.positionTitle,
    schoolName: model.identity.schoolName,
    region: model.identity.region,
    division: model.identity.division,
    district: model.identity.district,
    gradeLevel: model.lesson.gradeLevel,
    sections: model.lesson.sections,
    gradeSection: [model.lesson.gradeLevel, model.lesson.sections].filter(Boolean).join(' - '),
    learningArea: model.lesson.learningArea,
    lessonFocus: sectionBody(model, 'lesson-focus'),
    lessonTitle: model.lesson.title,
    lessonDate: model.lesson.lessonDate,
    weekSchedule: model.lesson.weekLabel,
    schoolYear: model.lesson.schoolYear,
    gradingTerm: model.lesson.gradingTerm,
    curriculumPeriod: model.lesson.curriculumPeriod,
    sessionsDuration: `${model.lesson.sessions} session(s), ${model.lesson.duration}`,
    references: model.references,
    competency,
    performanceStandard,
    learningObjectives: sectionBody(model, 'learning-objectives'),
    learnerContext: sectionBody(model, 'learner-context'),
    teachingApproaches: sectionBody(model, 'teaching-approaches'),
    preLessonActivity: sectionBody(model, 'pre-lesson'),
    lessonFlow: sectionBody(model, 'lesson-flow'),
    learningResources: sectionBody(model, 'resources'),
    contextualization: sectionBody(model, 'contextualization'),
    inclusionAccommodations: sectionBody(model, 'inclusion'),
    homeBasedAlternative: sectionBody(model, 'home-alternative'),
    formativeAssessment: sectionBody(model, 'formative'),
    evidenceOfLearning: sectionBody(model, 'evidence'),
    extendedLearning: sectionBody(model, 'extended'),
    nextSteps: sectionBody(model, 'next-steps'),
    reflection: sectionBody(model, 'reflection'),
    preparedBy: signatory(prepared),
    reviewedBy: signatory(reviewed),
    notedBy: signatory(noted),
  }
}

export function fillDocxTemplate(
  original: ArrayBuffer,
  mappings: DocumentTemplateMapping[],
  values: LessonTemplateValues,
) {
  const zip = openOfficeArchive(original, 'docx')
  const file = zip.file('word/document.xml')
  const raw = file?.asText()
  if (!raw) throw new Error('This DOCX does not contain a readable Word document body.')
  const xml = parseOfficeXml(raw, 'Word document')
  const body = Array.from(xml.getElementsByTagNameNS('*', 'body'))[0]
  if (!body) throw new Error('The DOCX document body could not be found.')

  for (const mapping of mappings) {
    if (values[mapping.fieldKey] === undefined) continue
    const value = (values[mapping.fieldKey] ?? '').trim()
    const paragraph = locateParagraph(body, mapping.locator)
    if (!paragraph) throw new Error('The saved template mapping no longer identifies an existing paragraph.')
    replaceParagraphText(paragraph, value, mapping.mode)
  }

  const aliases: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    aliases[key] = value ?? ''
    aliases[key.replace(/[A-Z]/g, character => '_' + character.toLowerCase())] = value ?? ''
  }
  for (const paragraph of descendantsByLocalName(body, 'p')) replaceWordTokens(paragraph, aliases)
  for (const part of Object.keys(zip.files).filter(name => /^word\/(?:header|footer)\d*\.xml$/.test(name))) {
    const header = parseOfficeXml(zip.file(part)!.asText(), part)
    for (const paragraph of Array.from(header.getElementsByTagNameNS('*', 'p'))) replaceWordTokens(paragraph, aliases)
    zip.file(part, new XMLSerializer().serializeToString(header))
  }
  const serialized = new XMLSerializer().serializeToString(xml)
  zip.file('word/document.xml', serialized)
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
