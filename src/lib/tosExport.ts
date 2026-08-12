import { jsPDF } from 'jspdf'
import builtInTosXlsxUrl from '../assets/tos-standard.xlsx?url'
import type { Profile } from '../types/app'
import type { TosTemplateFieldKey, TosTemplateMapping } from '../types/tosTemplate'
import type { TeacherExportPreferences } from '../types/export'
import type { TosRecord } from '../types/tos'
import type { TosExportModel } from '../types/tosExport'
import { downloadBlob } from './docxTemplate'
import { chunkTosLines, paginateTosRows } from './tosPdfPagination'
import { fillXlsxTemplate, type TosXlsxValues } from './xlsxTemplate'

// Re-export pure pagination primitives for non-UI consumers and regression
// tests without requiring them to load jsPDF or the XLSX template engine.
export { chunkTosLines, paginateTosRows } from './tosPdfPagination'

function clean(value: string | null | undefined) { return (value ?? '').trim() }
function numeric(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null }
function signatory(role: string, name: string, title: string) { return { role, name: clean(name), title: clean(title) } }
function exportStatusLabel(status: TosRecord['status']) { return status === 'final' ? '' : status === 'archived' ? 'ARCHIVED COPY' : 'DRAFT COPY' }


function buildCurriculumGroups(record: TosRecord) {
  const groups = new Map<string, {
    key: string
    curriculumPeriod: string
    contentArea: string
    contentStandards: string[]
    performanceStandards: string[]
    competencyRowNumbers: number[]
  }>()
  record.content.rows.forEach((row, index) => {
    const period = clean(row.competency.curriculumPeriodLabel) || 'Curriculum period'
    const contentArea = clean(row.competency.contentArea) || 'Other curriculum content'
    const key = `${row.competency.academicPeriodId ?? period}:${row.competency.domainId ?? contentArea}`
    const current = groups.get(key) ?? {
      key,
      curriculumPeriod: period,
      contentArea,
      contentStandards: [],
      performanceStandards: [],
      competencyRowNumbers: [],
    }
    current.competencyRowNumbers.push(index + 1)
    for (const standard of row.competency.standards ?? []) {
      const target = standard.type === 'content' ? current.contentStandards : current.performanceStandards
      const value = clean(standard.text)
      if (value && !target.includes(value)) target.push(value)
    }
    groups.set(key, current)
  })
  return [...groups.values()]
}

export function buildTosExportModel(record: TosRecord, profile: Profile, preferences: TeacherExportPreferences): TosExportModel {
  const content = record.content
  return {
    documentTitle: 'TABLE OF SPECIFICATIONS',
    status: record.status,
    identity: { teacherName: clean(profile.fullName), positionTitle: clean(profile.positionTitle), schoolName: clean(profile.schoolName), region: clean(profile.region), division: clean(profile.division) },
    title: clean(content.title),
    assessmentTitle: clean(content.assessmentTitle),
    gradeLevel: clean(content.gradeLevel),
    learningArea: clean(content.learningArea),
    sections: content.sections.join(', '),
    schoolYear: clean(content.schoolYear),
    gradingTerm: clean(content.gradingTermLabel),
    curriculumPeriod: content.curriculumPeriodLabels.join(', '),
    totalItems: content.totalItems,
    weightingMethod: content.weightingMethod === 'instructional_time' ? 'Instructional time' : content.weightingMethod === 'manual_percentage' ? 'Manual percentage' : 'Equal weighting',
    categories: content.cognitiveCategories.map(({ id, label, shortLabel }) => ({ id, label: clean(label), shortLabel: clean(shortLabel) })),
    curriculumGroups: buildCurriculumGroups(record),
    rows: content.rows.map((row, index) => ({
      rowNumber: index + 1,
      competencyCode: clean(row.competency.code),
      competency: clean(row.competency.text),
      contentArea: clean(row.competency.contentArea),
      curriculumPeriod: clean(row.competency.curriculumPeriodLabel),
      instructionalMinutes: numeric(row.instructionalMinutes),
      weightPercent: Number(row.computedWeightPercent),
      cognitiveItems: content.cognitiveCategories.map((category) => row.cognitiveAllocations.find((item) => item.categoryId === category.id)?.itemCount ?? 0),
      itemCount: row.itemCount,
      itemPlacement: row.itemRangeLabel,
      notes: clean(row.notes),
    })),
    notes: clean(content.notes),
    signatories: [
      signatory('Prepared by', clean(preferences.preparedByName) || clean(profile.fullName), clean(preferences.preparedByTitle) || clean(profile.positionTitle)),
      signatory('Reviewed by', preferences.reviewedByName, preferences.reviewedByTitle),
      signatory('Noted by', preferences.notedByName, preferences.notedByTitle),
    ].filter((item) => item.name || item.role === 'Prepared by'),
  }
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'table-of-specifications'
}

export function tosExportFilename(model: TosExportModel, extension: 'pdf' | 'xlsx') {
  return `${safeFilename(`${model.gradeLevel} ${model.learningArea} - ${model.title || 'TOS'}`)}.${extension}`
}

function fitText(doc: jsPDF, text: string, width: number, size: number) {
  doc.setFontSize(size)
  return doc.splitTextToSize(text || ' ', width) as string[]
}

export function downloadTosPdf(model: TosExportModel, preferences: TeacherExportPreferences) {
  if (model.categories.length > 8) throw new Error('The built-in PDF layout supports up to eight cognitive categories. Use browser print or reduce the export categories; no category was silently omitted.')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: preferences.paperSize, compress: true })
  const margin = 30
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const usable = pageWidth - margin * 2
  const categoryCount = Math.max(1, Math.min(8, model.categories.length))
  const fixedWidths = [22, 52, Math.max(150, usable * .25), 58, 42, 42]
  const cognitiveWidth = Math.max(25, Math.min(38, usable * .25 / categoryCount))
  const tailWidths = [38, 54, Math.max(55, usable * .09)]
  const rawWidths = [...fixedWidths, ...Array(categoryCount).fill(cognitiveWidth), ...tailWidths]
  const factor = usable / rawWidths.reduce((sum, value) => sum + value, 0)
  const widths = rawWidths.map((value) => value * factor)
  const headers = ['#', 'Code', 'Learning competency', 'Curriculum period', 'Minutes', 'Weight %', ...model.categories.filter((_, index) => index < categoryCount).map((item) => item.shortLabel), 'Items', 'Placement', 'Notes']
  const statusHeaderOffset = exportStatusLabel(model.status) ? 12 : 0
  const contentBottom = pageHeight - 42
  const firstTableTop = margin + 22 + statusHeaderOffset + (5 * 13) + 7 + 30
  const subsequentTableTop = margin + 22 + statusHeaderOffset + 30

  function pageHeader(first: boolean) {
    let y = margin
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(model.documentTitle, pageWidth / 2, y + 8, { align: 'center' }); y += 22
    const statusLabel = exportStatusLabel(model.status)
    if (statusLabel) { doc.setFontSize(8); doc.text(statusLabel, pageWidth / 2, y, { align: 'center' }); y += 12 }
    if (first) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
      const metadata = [
        `Teacher: ${model.identity.teacherName}`, `School: ${model.identity.schoolName}`,
        `Grade/Section: ${[model.gradeLevel, model.sections].filter(Boolean).join(' – ')}`, `Learning Area: ${model.learningArea}`,
        `School Year: ${model.schoolYear}`, `Grading Term: ${model.gradingTerm}`,
        `Curriculum Period: ${model.curriculumPeriod}`, `Assessment: ${model.assessmentTitle}`,
        `TOS: ${model.title}`, `Total Items: ${model.totalItems}`,
      ]
      metadata.forEach((text, index) => doc.text(text, margin + (index % 2) * usable / 2, y + Math.floor(index / 2) * 13))
      y += Math.ceil(metadata.length / 2) * 13 + 7
    }
    let x = margin
    const height = 30
    headers.forEach((header, index) => { doc.setFillColor(240, 240, 240); doc.rect(x, y, widths[index], height, 'FD'); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); const lines = fitText(doc, header, widths[index] - 5, 6.5); doc.text(lines, x + widths[index] / 2, y + 10, { align: 'center' }); x += widths[index] })
    return y + height
  }

  // Use separate point budgets for the metadata-heavy first page and repeated
  // table-header pages. `paginateTosRows` splits an oversized competency/notes
  // cell into continuation rows; no line is sliced.
  const wrappedRows = model.rows.map((row) => {
    const values: Array<string | number> = [row.rowNumber, row.competencyCode, [row.contentArea, row.competency].filter(Boolean).join(' — '), row.curriculumPeriod, row.instructionalMinutes ?? '', row.weightPercent.toFixed(2), ...row.cognitiveItems.filter((_, index) => index < categoryCount), row.itemCount, row.itemPlacement, row.notes]
    return { cells: values.map((value, index) => fitText(doc, String(value), widths[index] - 5, 6.4)) }
  })
  const tablePages = paginateTosRows(wrappedRows, {
    firstPageHeight: Math.max(20, contentBottom - firstTableTop),
    subsequentPageHeight: Math.max(20, contentBottom - subsequentTableTop),
    lineHeight: 8,
    rowPadding: 12,
  })
  const pagesToRender = tablePages.length ? tablePages : [{ rows: [], lineCount: 0 }]
  pagesToRender.forEach((tablePage, pageIndex) => {
    if (pageIndex > 0) doc.addPage()
    let y = pageHeader(pageIndex === 0)
    tablePage.rows.forEach((segment) => {
      const rowHeight = Math.max(20, segment.height)
      let x = margin
      segment.cells.forEach((lines, index) => {
        doc.rect(x, y, widths[index], rowHeight)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4)
        doc.text(lines, index === 2 || index === segment.cells.length - 1 ? x + 3 : x + widths[index] / 2, y + 9, { align: index === 2 || index === segment.cells.length - 1 ? 'left' : 'center' })
        x += widths[index]
      })
      y += rowHeight
    })
  })

  const totalLabel = `TOTAL: ${model.rows.reduce((sum, row) => sum + row.weightPercent, 0).toFixed(2)}% · ${model.rows.reduce((sum, row) => sum + row.itemCount, 0)} items`
  const plainPageHeader = () => {
    let y = margin
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(model.documentTitle, pageWidth / 2, y + 8, { align: 'center' }); y += 22
    const statusLabel = exportStatusLabel(model.status)
    if (statusLabel) { doc.setFontSize(8); doc.text(statusLabel, pageWidth / 2, y, { align: 'center' }); y += 12 }
    return y + 10
  }

  if (model.curriculumGroups.length) {
    doc.addPage()
    let contextY = plainPageHeader()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('CURRICULUM CONTENT AND STANDARDS', margin, contextY); contextY += 16
    for (const group of model.curriculumGroups) {
      const standardLines = [
        ...group.contentStandards.map((value) => `Content Standard: ${value}`),
        ...group.performanceStandards.map((value) => `Performance Standard: ${value}`),
      ]
      const body = standardLines.length ? standardLines : ['No separately verified standard is stored for this curriculum group.']
      const wrapped = body.flatMap((value) => fitText(doc, value, usable - 10, 7.2))
      const headingHeight = 23
      const boxHeight = headingHeight + Math.max(14, wrapped.length * 8 + 8)
      if (contextY + boxHeight > contentBottom) { doc.addPage(); contextY = plainPageHeader() }
      doc.rect(margin, contextY, usable, boxHeight)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(`${group.curriculumPeriod} · ${group.contentArea}`, margin + 5, contextY + 10)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(`Competency rows ${group.competencyRowNumbers.join(', ')}`, margin + 5, contextY + 19)
      doc.setFontSize(7.2); doc.text(wrapped, margin + 5, contextY + headingHeight + 7)
      contextY += boxHeight + 5
    }
  }

  // Totals and global notes use their own pages.  This makes the table and
  // signatures independent of note length and guarantees there is no overlap.
  doc.addPage()
  let y = plainPageHeader()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(totalLabel, margin, y); y += 16
  if (model.notes) {
    const lines = fitText(doc, `Notes: ${model.notes}`, usable, 7.5)
    const noteLineHeight = 9
    const firstNotesPageLines = Math.max(1, Math.floor((contentBottom - y) / noteLineHeight))
    const chunks = chunkTosLines(lines, firstNotesPageLines)
    chunks.forEach((chunk, index) => {
      if (index > 0) { doc.addPage(); y = plainPageHeader() }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(chunk, margin, y)
      y += chunk.length * noteLineHeight + 10
    })
  }
  if (model.signatories.length) {
    doc.addPage(); y = plainPageHeader()
    const columnWidth = usable / model.signatories.length
    model.signatories.forEach((item, index) => {
      const center = margin + columnWidth * index + columnWidth / 2
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(item.role, center, y + 4, { align: 'center' })
      doc.line(center - columnWidth * .32, y + 32, center + columnWidth * .32, y + 32)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(fitText(doc, item.name || ' ', columnWidth * .7, 8), center, y + 30, { align: 'center' })
      if (item.title) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(fitText(doc, item.title, columnWidth * .8, 6.5), center, y + 43, { align: 'center' }) }
    })
  }
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) { doc.setPage(page); doc.setFontSize(6.5); doc.setTextColor(90, 90, 90); doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' }) }
  doc.save(tosExportFilename(model, 'pdf'))
}

const BUILTIN_TOS_MAPPINGS: TosTemplateMapping[] = [
  ['tosTitle', 'C2'], ['assessmentTitle', 'K2'], ['teacherName', 'C3'], ['schoolName', 'I3'],
  ['gradeSection', 'C4'], ['learningArea', 'G4'], ['schoolYear', 'L4'], ['gradingTerm', 'P4'],
  ['curriculumPeriod', 'D5'], ['weightingMethod', 'J5'], ['totalItems', 'O5'],
  ...Array.from({ length: 8 }, (_, index) => [`cognitiveLabel${index + 1}`, `${String.fromCharCode(71 + index)}8`]),
  ['preparedBy', 'B73'], ['reviewedBy', 'H73'], ['notedBy', 'N73'],
].map(([fieldKey, cellAddress]) => ({ fieldKey: fieldKey as TosTemplateFieldKey, elementId: `TOS!${cellAddress}`, locator: { kind: 'worksheet_cell', sheetName: 'TOS', cellAddress }, mode: 'replace', confidence: null }))

const BUILTIN_COLUMNS: Array<[TosTemplateFieldKey, string]> = [
  ['competencyRowNumber', 'A'], ['competencyCode', 'B'], ['competency', 'C'], ['rowCurriculumPeriod', 'D'],
  ['instructionalMinutes', 'E'], ['weightPercent', 'F'],
  ...Array.from({ length: 8 }, (_, index) => [`cognitiveItems${index + 1}` as TosTemplateFieldKey, String.fromCharCode(71 + index)] as [TosTemplateFieldKey, string]),
  ['itemCount', 'O'], ['itemPlacement', 'P'], ['rowNotes', 'Q'],
]
BUILTIN_TOS_MAPPINGS.push(...BUILTIN_COLUMNS.map(([fieldKey, columnAddress]) => ({ fieldKey, elementId: `TOS!${columnAddress}8`, locator: { kind: 'worksheet_column', sheetName: 'TOS', columnAddress, firstDataRow: 9, lastDataRow: 68 }, mode: 'table_column', confidence: null } satisfies TosTemplateMapping)))

export function buildTosXlsxValues(model: TosExportModel): TosXlsxValues {
  const scalar: TosXlsxValues['scalar'] = {
    teacherName: model.identity.teacherName, teacherPosition: model.identity.positionTitle, schoolName: model.identity.schoolName,
    region: model.identity.region, division: model.identity.division, gradeLevel: model.gradeLevel, sections: model.sections,
    gradeSection: [model.gradeLevel, model.sections].filter(Boolean).join(' – '),
    learningArea: model.learningArea, schoolYear: model.schoolYear, gradingTerm: model.gradingTerm,
    curriculumPeriod: model.curriculumPeriod, tosTitle: [exportStatusLabel(model.status), model.title].filter(Boolean).join(' — '), assessmentTitle: model.assessmentTitle,
    totalItems: model.totalItems, weightingMethod: model.weightingMethod, totalWeight: model.rows.reduce((sum, row) => sum + row.weightPercent, 0),
  }
  for (let index = 0; index < 8; index += 1) scalar[`cognitiveLabel${index + 1}` as TosTemplateFieldKey] = ''
  model.categories.filter((_, index) => index < 8).forEach((category, index) => { scalar[`cognitiveLabel${index + 1}` as TosTemplateFieldKey] = category.shortLabel || category.label })
  model.signatories.forEach((item) => {
    const field: TosTemplateFieldKey = item.role === 'Reviewed by' ? 'reviewedBy' : item.role === 'Noted by' ? 'notedBy' : 'preparedBy'
    scalar[field] = [item.name, item.title].filter(Boolean).join('\n')
  })
  return {
    scalar,
    rows: model.rows.map((row) => {
      const values: Partial<Record<TosTemplateFieldKey, string | number>> = {
        competencyRowNumber: row.rowNumber, competencyCode: row.competencyCode, competency: row.competency,
        rowCurriculumPeriod: row.curriculumPeriod, instructionalMinutes: row.instructionalMinutes ?? '',
        weightPercent: row.weightPercent, itemCount: row.itemCount, itemPlacement: row.itemPlacement, rowNotes: row.notes,
      }
      row.cognitiveItems.filter((_, index) => index < 8).forEach((count, index) => { values[`cognitiveItems${index + 1}` as TosTemplateFieldKey] = count })
      return values
    }),
  }
}

export async function buildTosXlsxBlob(model: TosExportModel, original?: ArrayBuffer, mappings?: TosTemplateMapping[], sourceHash?: string) {
  if (model.categories.length > 8) throw new Error('XLSX export supports up to eight cognitive categories in Phase 4. No category was silently omitted.')
  if (original && !/^[0-9a-f]{64}$/i.test(sourceHash ?? '')) throw new Error('A verified SHA-256 fingerprint is required for custom XLSX export.')
  if (original && !mappings?.length) throw new Error('A confirmed workbook mapping is required for custom XLSX export.')
  if (original && model.status !== 'final' && !mappings?.some((mapping) => mapping.fieldKey === 'tosTitle')) throw new Error('Map the TOS title before exporting a draft through a custom workbook so the file is visibly marked as a draft.')
  const buffer: ArrayBuffer = original ?? await fetch(builtInTosXlsxUrl).then((response) => {
    if (!response.ok) throw new Error('Built-in TOS workbook could not be loaded.')
    return response.arrayBuffer()
  })
  return fillXlsxTemplate(buffer, mappings ?? BUILTIN_TOS_MAPPINGS, buildTosXlsxValues(model), sourceHash)
}

export async function downloadTosXlsx(model: TosExportModel, original?: ArrayBuffer, mappings?: TosTemplateMapping[], sourceHash?: string) {
  downloadBlob(await buildTosXlsxBlob(model, original, mappings, sourceHash), tosExportFilename(model, 'xlsx'))
}
