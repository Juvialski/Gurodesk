import {
  AlignmentType,
  Document,
  PageBreak,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { jsPDF } from 'jspdf'
import type { ExportPaperSize } from '../types/export'
import type { ResultsReportModel } from '../types/resultsReport'
import { downloadBlob } from './docxTemplate'
import { buildResultsWorkbook, resultsWorkbookFilename } from './resultsWorkbook'

const BLACK = '000000'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type ResultsReportPage = { lines: string[] }

/** Pure pagination helper used by PDF, DOCX, print, and validation flows. */
export function paginateResultsLines(lines: string[], maxLines: number): ResultsReportPage[] {
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) throw new Error('maxLines must be a positive whole number.')
  const pages: ResultsReportPage[] = []
  for (let start = 0; start < lines.length; start += maxLines) pages.push({ lines: lines.slice(start, start + maxLines) })
  return pages
}

export const paginateResultsRows = paginateResultsLines

function clean(value: string | null | undefined) { return (value ?? '').trim() }

function number(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 1000) / 10
  return `${Object.is(rounded, -0) ? 0 : rounded}%`
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'assessment-results'
}

export function resultsReportFilename(model: ResultsReportModel, extension: 'pdf' | 'docx') {
  return `${safeFilename(`${model.metadata.gradeLevel} ${model.metadata.learningArea} - ${model.title} - ${model.documentTitle}`)}.${extension}`
}

function metadataLines(model: ResultsReportModel) {
  const { metadata, labels } = model
  return [
    `${labels.teacher}: ${metadata.teacherName}`,
    `${labels.school}: ${metadata.schoolName}`,
    `${labels.gradeLevel}: ${metadata.gradeLevel}`,
    `${labels.learningArea}: ${metadata.learningArea}`,
    `${labels.schoolYear}: ${metadata.schoolYear}`,
    `${labels.gradingTerm}: ${metadata.gradingTerm}`,
    `${labels.section}: ${metadata.sectionName}`,
    `${labels.administrationDate}: ${metadata.administrationDate}`,
  ].filter((line) => line.split(': ').slice(1).join(': ').trim())
}

function summaryLines(model: ResultsReportModel) {
  const summary = model.summary
  if (!summary) return ['No summary data is available.']
  const lines = [
    `${model.labels.total}: ${summary.classLearnerCount} · Encoded: ${summary.encodedLearnerCount} · Scored: ${summary.scoredLearnerCount}`,
    `${model.labels.classAverage}: ${number(summary.averageRawScore)} / ${number(summary.learners[0]?.possiblePoints)} (${percent(summary.averagePercentage)})`,
    `${model.labels.median}: ${number(summary.medianRawScore)} (${percent(summary.medianPercentage)})`,
    `${model.labels.highest}: ${number(summary.highestRawScore)} (${percent(summary.highestPercentage)})`,
    `${model.labels.lowest}: ${number(summary.lowestRawScore)} (${percent(summary.lowestPercentage)})`,
    '',
    `${model.labels.learner} | ${model.labels.rawScore} | ${model.labels.percentage} | ${model.labels.attempted} | ${model.labels.omitted} | ${model.labels.correct} | ${model.labels.incorrect}`,
  ]
  for (const learner of summary.learners) lines.push(`${learner.displayName || '—'} | ${number(learner.rawScore)} / ${number(learner.possiblePoints)} | ${percent(learner.percentage)} | ${learner.attemptedItems} | ${learner.omittedItems} | ${learner.correctItems} | ${learner.incorrectItems}`)
  lines.push('', 'Percentage distribution')
  summary.percentageDistribution.forEach((bin) => lines.push(`${bin.label}: ${bin.count}`))
  return lines
}

function itemAnalysisLines(model: ResultsReportModel) {
  const lines = [`${model.labels.item} | ${model.labels.competency} | ${model.labels.cognitiveCategory} | ${model.labels.curriculumPeriod} | ${model.labels.attempted} | ${model.labels.correct} | ${model.labels.incorrect} | ${model.labels.omitted} | ${model.labels.points} | ${model.labels.analysisBasis} | ${model.labels.facility} | ${model.labels.pointAchievement} | ${model.labels.discrimination}`]
  for (const item of model.items) lines.push(`${item.itemNumber} | ${item.competency} | ${item.cognitiveCategory} | ${item.curriculumPeriod} | ${item.attempted} | ${item.correct} | ${item.incorrect} | ${item.omitted} | ${number(item.earnedPoints)} / ${number(item.possiblePoints)} | ${item.analysisBasis.replaceAll('_', ' ')} | ${percent(item.facility)} | ${percent(item.normalizedPointAchievement)} | ${item.discriminationStatus === 'available' ? number(item.discrimination) : item.discriminationStatus}`)
  lines.push('', model.labels.options, `${model.labels.item} | Option | ${model.labels.count} | ${model.labels.percentage} | Correct | Advisory signal | ${model.labels.omitted}`)
  for (const option of model.options) lines.push(`${option.itemNumber} | ${option.option} | ${option.count} | ${percent(option.percentage)} | ${option.correct ? 'Yes' : 'No'} | ${option.distractorSignal === 'unselected' ? 'Unselected distractor — teacher review' : '—'} | ${option.omitted}`)
  return lines
}

function competencyLines(model: ResultsReportModel) {
  const lines = [`${model.labels.competency} | Code | ${model.labels.curriculumPeriod} | Items | ${model.labels.attempted} | ${model.labels.correct} | ${model.labels.incorrect} | ${model.labels.omitted} | ${model.labels.points} | ${model.labels.pointAchievement} | ${model.labels.facility}`]
  for (const row of model.competencies) lines.push(`${row.competency} | ${row.code || '—'} | ${row.curriculumPeriod} | ${row.itemNumbers.join(', ')} | ${row.attempts} | ${row.correct} | ${row.incorrect} | ${row.omitted} | ${number(row.earnedPoints)} / ${number(row.pointsPossibleForAll)} | ${percent(row.normalizedPointAchievement)} | ${percent(row.facility)}`)
  lines.push('', model.labels.cognitiveCategory, `${model.labels.cognitiveCategory} | ${model.labels.curriculumPeriod} | Items | ${model.labels.attempted} | ${model.labels.correct} | ${model.labels.incorrect} | ${model.labels.omitted} | ${model.labels.points} | ${model.labels.pointAchievement} | ${model.labels.facility}`)
  for (const row of model.cognitiveCategories) lines.push(`${row.category} | ${row.curriculumPeriod} | ${row.itemNumbers.join(', ')} | ${row.attempts} | ${row.correct} | ${row.incorrect} | ${row.omitted} | ${number(row.earnedPoints)} / ${number(row.pointsPossibleForAll)} | ${percent(row.normalizedPointAchievement)} | ${percent(row.facility)}`)
  lines.push('', model.labels.curriculumPeriod, `${model.labels.curriculumPeriod} | Items | ${model.labels.attempted} | ${model.labels.correct} | ${model.labels.incorrect} | ${model.labels.omitted} | ${model.labels.points} | ${model.labels.pointAchievement} | ${model.labels.facility}`)
  for (const row of model.curriculumPeriods) lines.push(`${row.curriculumPeriod} | ${row.itemNumbers.join(', ')} | ${row.attempts} | ${row.correct} | ${row.incorrect} | ${row.omitted} | ${number(row.earnedPoints)} / ${number(row.pointsPossibleForAll)} | ${percent(row.normalizedPointAchievement)} | ${percent(row.facility)}`)
  return lines
}

function remediationLines(model: ResultsReportModel) {
  if (model.remediation.length === 0) return ['No remediation signals have been selected for teacher review.']
  const lines = [`Scope | ${model.labels.target} | ${model.labels.curriculumPeriod} | Items | ${model.labels.evidence} | ${model.labels.threshold} | ${model.labels.learners} | Denominator | ${model.labels.plannedActivity} | ${model.labels.schedule} | ${model.labels.followUpEvidence} | ${model.labels.teacherReview}`]
  for (const row of model.remediation) lines.push(`${row.scope} | ${row.targetCompetency} | ${row.curriculumPeriod} | ${row.itemNumbers.join(', ')} | ${percent(row.evidence)} | ${percent(row.threshold)} | ${row.learnerCount} | ${row.denominatorLabel} | ${row.plannedActivity || '—'} | ${row.schedule || '—'} | ${row.followUpEvidence || '—'} | ${row.teacherReviewed ? 'Yes' : 'No'}`)
  lines.push('', 'Instructional signals')
  model.remediation.forEach((row) => lines.push(`${row.targetCompetency}: ${row.instructionalMessage}`))
  return lines
}

export function resultsReportLines(model: ResultsReportModel): string[] {
  const modeLines = model.mode === 'summary' ? summaryLines(model)
    : model.mode === 'item_analysis' ? itemAnalysisLines(model)
      : model.mode === 'competency' ? competencyLines(model)
        : remediationLines(model)
  return [model.documentTitle, model.title, ...metadataLines(model), '', ...modeLines]
}

type PdfContext = {
  doc: jsPDF
  x: number
  y: number
  width: number
  bottom: number
  header: () => void
}

function continuationHeader(ctx: PdfContext, model: ResultsReportModel) {
  const { doc, x, width } = ctx
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`${model.documentTitle} — continued`, x + width / 2, 30, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(model.title, x + width / 2, 44, { align: 'center' })
  ctx.y = 62
}

function initialHeader(ctx: PdfContext, model: ResultsReportModel) {
  const { doc, x, width } = ctx
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(model.documentTitle, x + width / 2, 31, { align: 'center' })
  doc.setFontSize(12); doc.text(model.title, x + width / 2, 49, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  let y = 72
  for (const line of metadataLines(model)) {
    const wrapped = doc.splitTextToSize(line, width) as string[]
    doc.text(wrapped, x, y)
    y += wrapped.length * 10 + 2
  }
  ctx.y = y + 8
}

function drawLines(ctx: PdfContext, lines: string[]) {
  ctx.doc.setTextColor(0, 0, 0)
  for (const line of lines) {
    const wrapped = ctx.doc.splitTextToSize(line || ' ', ctx.width) as string[]
    const lineHeight = 11
    if (ctx.y + wrapped.length * lineHeight > ctx.bottom) {
      ctx.doc.addPage()
      ctx.header()
    }
    ctx.doc.text(wrapped, ctx.x, ctx.y)
    ctx.y += wrapped.length * lineHeight + 3
  }
}

export function buildResultsPdf(model: ResultsReportModel, paperSize: ExportPaperSize = 'a4') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: paperSize, compress: true })
  const margin = 42
  const width = doc.internal.pageSize.getWidth() - margin * 2
  const ctx: PdfContext = {
    doc,
    x: margin,
    y: 0,
    width,
    bottom: doc.internal.pageSize.getHeight() - 42,
    header: () => continuationHeader(ctx, model),
  }
  initialHeader(ctx, model)
  drawLines(ctx, resultsReportLines(model).slice(2 + metadataLines(model).length))
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 90, 90)
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 18, { align: 'right' })
  }
  return doc
}

export function downloadResultsPdf(model: ResultsReportModel, paperSize: ExportPaperSize = 'a4') {
  buildResultsPdf(model, paperSize).save(resultsReportFilename(model, 'pdf'))
}

function docxText(text: string, options: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text: text || ' ', bold: options.bold, size: options.size ?? 18, color: BLACK })
}

function docxPaperSize(paper: ExportPaperSize) {
  if (paper === 'letter') return { width: 12240, height: 15840 }
  if (paper === 'legal') return { width: 12240, height: 20160 }
  return { width: 11906, height: 16838 }
}

export async function buildResultsDocxBlob(model: ResultsReportModel, paperSize: ExportPaperSize = 'a4') {
  const lines = resultsReportLines(model)
  // Summary rows are compact, while item-analysis rows commonly wrap across two
  // or more visual lines. Keep the conservative limit for analytical reports,
  // but let a 40-learner summary use two balanced pages instead of creating a
  // nearly empty orphan page.
  const pages = paginateResultsLines(lines, model.mode === 'summary' ? 46 : 34)
  const children: Paragraph[] = []
  pages.forEach((page, pageIndex) => {
    page.lines.forEach((line, lineIndex) => children.push(new Paragraph({
      keepLines: true,
      keepNext: pageIndex === 0 && lineIndex < 2,
      spacing: { before: lineIndex === 0 ? 100 : 25, after: 0 },
      children: [docxText(line, { bold: pageIndex === 0 && lineIndex < 2, size: pageIndex === 0 && lineIndex < 2 ? 22 : 17 })],
    })))
    if (pageIndex < pages.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }))
  })
  const document = new Document({
    creator: clean(model.metadata.teacherName) || 'Teacher',
    title: model.title,
    description: model.documentTitle,
    sections: [{ properties: { page: { size: docxPaperSize(paperSize), margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, children }],
  })
  return Packer.toBlob(document)
}

export async function downloadResultsDocx(model: ResultsReportModel, paperSize: ExportPaperSize = 'a4') {
  downloadBlob(await buildResultsDocxBlob(model, paperSize), resultsReportFilename(model, 'docx'))
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character))
}

export function resultsReportPrintHtml(model: ResultsReportModel) {
  const pages = paginateResultsLines(resultsReportLines(model), 42)
  return `<main class="results-report-print">${pages.map((page, index) => `<section class="results-report-print-page"><div class="results-report-print-heading"><h1>${escapeHtml(page.lines[0] ?? model.documentTitle)}</h1><h2>${escapeHtml(page.lines[1] ?? model.title)}</h2>${index === 0 ? metadataLines(model).map((line) => `<p>${escapeHtml(line)}</p>`).join('') : '<p>Continued</p>'}</div><pre>${escapeHtml(page.lines.slice(index === 0 ? 2 + metadataLines(model).length : 0).join('\n'))}</pre></section>`).join('')}</main>`
}

export function printResults(model: ResultsReportModel) {
  if (typeof window === 'undefined') throw new Error('Browser print is only available in a browser context.')
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('The print window could not be opened.')
  printWindow.opener = null
  printWindow.document.open()
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(model.documentTitle)}</title><style>@page{size:auto;margin:12mm}.results-report-print-page{break-after:page}.results-report-print-page:last-child{break-after:auto}pre{white-space:pre-wrap;font:10pt Arial;line-height:1.45}h1{font:700 16pt Arial;text-align:center}h2{font:700 13pt Arial;text-align:center}p{font:9pt Arial;margin:2px 0}</style></head><body>${resultsReportPrintHtml(model)}</body></html>`)
  printWindow.document.close(); printWindow.focus(); printWindow.print()
}

export function downloadResultsWorkbook(model: ResultsReportModel) {
  const blob = buildResultsWorkbook(model)
  downloadBlob(blob, resultsWorkbookFilename(model))
}

export { XLSX_MIME }
