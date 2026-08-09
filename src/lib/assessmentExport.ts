import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { jsPDF } from 'jspdf'
import type { AssessmentAnswer } from '../types/assessment'
import type {
  AssessmentExportModel,
  AssessmentExportQuestion,
  AssessmentExportQuestionBase,
  AssessmentStudentExportQuestion,
} from '../types/assessmentExport'
import type { ExportPaperSize } from '../types/export'
import { downloadBlob } from './docxTemplate'

const TEXT = '000000'
const MUTED = '555555'

function clean(value: string | null | undefined) { return (value ?? '').trim() }

export type AssessmentLinePage = {
  lines: string[]
}

/** Pure helper used by PDF/print flows and tests; flattening pages preserves every line. */
export function paginateAssessmentLines(lines: string[], maxLines: number): AssessmentLinePage[] {
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) throw new Error('maxLines must be a positive whole number.')
  const pages: AssessmentLinePage[] = []
  for (let start = 0; start < lines.length; start += maxLines) pages.push({ lines: lines.slice(start, start + maxLines) })
  return pages
}

export const paginateAssessmentText = paginateAssessmentLines

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'assessment'
}

export function assessmentExportFilename(model: AssessmentExportModel, extension: 'pdf' | 'docx') {
  const suffix = model.mode === 'answer_key' ? ' - Answer Key' : model.mode === 'teacher' ? ' - Teacher Copy' : ''
  return `${safeFilename(`${model.metadata.gradeLevel} ${model.metadata.learningArea} - ${model.title}${suffix}`)}.${extension}`
}

function isStudentQuestion(question: AssessmentExportQuestion): question is AssessmentStudentExportQuestion {
  return 'choices' in question && Array.isArray(question.choices) && question.choices.every((choice) => typeof choice === 'string')
}

function answerText(answer: AssessmentAnswer, question: Pick<AssessmentExportQuestionBase, 'choices'> | AssessmentExportQuestion) {
  if (answer.type === 'multiple_choice') {
    const choiceIndex = answer.choices.findIndex((item) => item.id === answer.choiceId)
    const choice = choiceIndex >= 0 ? answer.choices[choiceIndex] : null
    // Exported documents use visible A/B/C labels; internal choice IDs never
    // leak into teacher, student, print, or answer-key text.
    return choice?.text ? `(${String.fromCharCode(65 + choiceIndex)}) ${choice.text}` : ''
  }
  if (answer.type === 'true_false') return answer.value ? 'True' : 'False'
  if (answer.type === 'short_answer') return answer.acceptedAnswers.join(' / ')
  return answer.expectedResponse
}

function questionAnswer(question: AssessmentExportQuestion) {
  if ('answer' in question && question.answer) return answerText(question.answer, question)
  return ''
}

function textMetadata(model: AssessmentExportModel) {
  const { labels, metadata } = model
  const common: Array<[string, string]> = [
    [labels.teacher, metadata.teacherName],
    [labels.school, metadata.schoolName],
    [labels.gradeLevel, metadata.gradeLevel],
    [labels.learningArea, metadata.learningArea],
    [labels.schoolYear, metadata.schoolYear],
    [labels.gradingTerm, metadata.gradingTerm],
  ]
  if (model.mode === 'teacher') common.push([labels.curriculumPeriods, metadata.curriculumPeriods ?? ''])
  if (model.mode !== 'answer_key') {
    common.push([labels.learnerName, metadata.learnerName || '____________________________'])
    common.push([labels.section, metadata.section || '____________________________'])
  }
  return common.filter(([, value]) => clean(value))
}

function questionLabel(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  const points = question.points && question.points > 0 ? ` (${question.points} ${model.labels.points})` : ''
  return `${question.itemNumber}.${points}`
}

function questionChoices(question: AssessmentExportQuestion, labels: AssessmentExportModel['labels']) {
  if (question.questionType !== 'multiple_choice') return []
  if (isStudentQuestion(question)) return question.choices
  if ('choices' in question) return question.choices.map((choice) => choice.text)
  return []
}

function renderQuestionLines(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  if (model.mode === 'answer_key') return [questionLabel(model, question), `${model.labels.answer}: ${questionAnswer(question)}`]
  const lines: string[] = [questionLabel(model, question), 'prompt' in question ? question.prompt : '']
  questionChoices(question, model.labels).forEach((choice, index) => lines.push(`  ${String.fromCharCode(65 + index)}. ${choice}`))
  const prefix = model.language === 'filipino' ? model.labels.responseLine : model.labels.answer
  const answerSpaceLines = 'answerSpaceLines' in question ? question.answerSpaceLines : 0
  for (let index = 0; index < answerSpaceLines; index += 1) lines.push(`${prefix}: ______________________________________________`)
  if ('competency' in question && question.competency) lines.push(`${model.labels.competency}: ${question.competency.text}`)
  if ('cognitiveCategory' in question && question.cognitiveCategory) lines.push(`${model.labels.cognitiveCategory}: ${question.cognitiveCategory.label}`)
  if ('answer' in question && question.answer) lines.push(`${model.labels.answer}: ${questionAnswer(question)}`)
  if ('rationale' in question && question.rationale) lines.push(`${model.labels.rationale}: ${question.rationale}`)
  return lines
}

function pdfFormat(paper: ExportPaperSize = 'a4'): 'a4' | 'letter' | 'legal' { return paper }

type PdfContext = {
  doc: jsPDF
  x: number
  y: number
  width: number
  bottom: number
  pageHeader: () => void
}

function pdfContinuationHeader(ctx: PdfContext, model: AssessmentExportModel) {
  const { doc, x, width } = ctx
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`${model.labels.documentTitle} — continued`, x + width / 2, 32, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(model.title, x + width / 2, 47, { align: 'center' })
  ctx.y = 66
}

function pdfHeader(ctx: PdfContext, model: AssessmentExportModel, initial = true) {
  if (!initial) { pdfContinuationHeader(ctx, model); return }
  const { doc, x, width } = ctx
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(model.labels.documentTitle, x + width / 2, 34, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(model.title, x + width / 2, 52, { align: 'center' })
  let y = 76
  const metadata = textMetadata(model)
  const columnWidth = width / 2 - 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  for (let index = 0; index < metadata.length; index += 2) {
    const row = metadata.slice(index, index + 2)
    const wrapped = row.map(([label, value]) => doc.splitTextToSize(`${label}: ${value}`, columnWidth) as string[])
    const rowHeight = Math.max(12, ...wrapped.map((lines) => lines.length * 10))
    if (y + rowHeight > ctx.bottom) {
      ctx.doc.addPage()
      pdfContinuationHeader(ctx, model)
      y = ctx.y
    }
    row.forEach((_, column) => doc.text(wrapped[column], x + column * width / 2, y))
    y += rowHeight + 2
  }
  ctx.y = y + 3
  if (model.mode === 'answer_key') return
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(model.labels.instructions, x, ctx.y); ctx.y += 12
  if (model.instructions) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const instructionLines = doc.splitTextToSize(model.instructions, width) as string[]
    const lineHeight = 11
    for (const line of instructionLines) {
      if (ctx.y + lineHeight > ctx.bottom) {
        ctx.doc.addPage()
        pdfContinuationHeader(ctx, model)
      }
      ctx.doc.text(line, x, ctx.y)
      ctx.y += lineHeight
    }
    ctx.y += 10
  }
}

function newPdfPage(ctx: PdfContext) {
  ctx.doc.addPage()
  ctx.pageHeader()
}

function drawPdfLines(ctx: PdfContext, lines: string[], size = 10, gapAfter = 8) {
  ctx.doc.setFontSize(size)
  const lineHeight = size * 1.35
  for (const line of lines) {
    if (ctx.y + lineHeight > ctx.bottom) newPdfPage(ctx)
    ctx.doc.text(line, ctx.x, ctx.y)
    ctx.y += lineHeight
  }
  ctx.y += gapAfter
}

function drawPdfQuestion(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion) {
  ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setTextColor(0, 0, 0)
  const wrapped: string[] = []
  renderQuestionLines(model, question).forEach((line, index) => {
    ctx.doc.setFontSize(index === 0 ? 10.5 : 10)
    const split = ctx.doc.splitTextToSize(line, ctx.width) as string[]
    wrapped.push(...split)
  })
  // Keep a short MCQ together when the remaining page has enough room; long
  // questions naturally continue line-by-line without clipping.
  const minimumHeight = wrapped.length * 13.5 + 12
  if (question.questionType === 'multiple_choice' && wrapped.length <= 8 && ctx.y + minimumHeight > ctx.bottom) newPdfPage(ctx)
  drawPdfLines(ctx, wrapped, 10, 12)
}

export function buildAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: pdfFormat(paperSize), compress: true })
  const margin = 42
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const ctx: PdfContext = {
    doc,
    x: margin,
    y: 0,
    width: pageWidth - margin * 2,
    bottom: pageHeight - 42,
    pageHeader: () => pdfHeader(ctx, model, false),
  }
  pdfHeader(ctx, model, true)
  model.questions.forEach((question) => drawPdfQuestion(ctx, model, question))
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 100)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 18, { align: 'right' })
  }
  return doc
}

export function downloadAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  buildAssessmentPdf(model, paperSize).save(assessmentExportFilename(model, 'pdf'))
}

function docxPaperSize(paper: ExportPaperSize = 'a4') {
  if (paper === 'letter') return { width: 12240, height: 15840 }
  if (paper === 'legal') return { width: 12240, height: 20160 }
  return { width: 11906, height: 16838 }
}

function docxText(text: string, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text: text || ' ', bold: options.bold, size: options.size ?? 20, color: options.color ?? TEXT })
}

function docxQuestion(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  const lines = renderQuestionLines(model, question)
  const keepQuestionTogether = lines.length <= 8 && (!('prompt' in question) || question.prompt.length <= 500)
  return lines.map((line, index) => new Paragraph({
    keepLines: true,
    // Keep short MCQ blocks together when practical. A long authored prompt
    // must be allowed to flow naturally instead of forcing the whole item to
    // the next page through a long keepNext chain.
    keepNext: keepQuestionTogether && index < lines.length - 1,
    spacing: { before: index === 0 ? 160 : 35, after: index === lines.length - 1 ? 120 : 0 },
    children: [docxText(line, { bold: index === 0, size: index === 0 ? 21 : 20 })],
  }))
}

export async function buildAssessmentDocxBlob(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 90 }, children: [docxText(model.labels.documentTitle, { bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [docxText(model.title, { bold: true, size: 23 })] }),
  ]
  textMetadata(model).forEach(([label, value]) => children.push(new Paragraph({ keepNext: true, spacing: { after: 30 }, children: [docxText(`${label}: `, { bold: true, size: 18 }), docxText(value, { size: 18 })] })))
  if (model.mode !== 'answer_key') {
    children.push(new Paragraph({ keepNext: true, spacing: { before: 180, after: 45 }, children: [docxText(model.labels.instructions, { bold: true, size: 20 })] }))
    if (model.instructions) {
      const keepInstructionsTogether = model.instructions.length <= 700 && model.instructions.split(/\r?\n/).length <= 8
      children.push(new Paragraph({ keepLines: keepInstructionsTogether, keepNext: keepInstructionsTogether, spacing: { after: 100 }, children: [docxText(model.instructions, { size: 20 })] }))
    }
  }
  model.questions.forEach((question) => children.push(...docxQuestion(model, question)))
  const document = new Document({
    creator: model.metadata.teacherName,
    title: model.title,
    description: model.labels.documentTitle,
    sections: [{ properties: { page: { size: docxPaperSize(paperSize), margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, children }],
  })
  return Packer.toBlob(document)
}

export async function downloadAssessmentDocx(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  downloadBlob(await buildAssessmentDocxBlob(model, paperSize), assessmentExportFilename(model, 'docx'))
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character))
}

export function assessmentPrintHtml(model: AssessmentExportModel) {
  const metadata = textMetadata(model).map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join('')
  const questions = model.questions.map((question) => {
    const lines = renderQuestionLines(model, question)
    const [number, ...body] = lines
    const longFlow = question.questionType === 'constructed_response' || ('prompt' in question && question.prompt.length > 500)
    const blockClass = longFlow ? 'assessment-question question-flow' : 'assessment-question question-short'
    return `<section class="${blockClass}"><strong>${escapeHtml(number)}</strong>${body.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</section>`
  }).join('')
  const directions = model.mode === 'answer_key' ? '' : `<h3>${escapeHtml(model.labels.instructions)}</h3><div class="assessment-instructions">${escapeHtml(model.instructions)}</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title><style>@page{margin:18mm}body{font-family:Arial,sans-serif;color:#000;line-height:1.35}.assessment-meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 18px}.assessment-question{margin:14px 0}.question-short{break-inside:avoid}.question-flow{break-inside:auto}.assessment-question div{white-space:pre-wrap}.assessment-instructions{margin:14px 0}</style></head><body><h1>${escapeHtml(model.labels.documentTitle)}</h1><h2>${escapeHtml(model.title)}</h2><div class="assessment-meta">${metadata}</div>${directions}${questions}</body></html>`
}

export function buildAssessmentPrintModel(model: AssessmentExportModel) { return model }

export function printAssessment(model: AssessmentExportModel) {
  if (typeof window === 'undefined') throw new Error('Browser print is only available in a browser context.')
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('The print window could not be opened.')
  // Keep a usable Window reference for printing, then sever the opener before
  // writing the locally generated, escaped document HTML.
  printWindow.opener = null
  printWindow.document.open(); printWindow.document.write(assessmentPrintHtml(model)); printWindow.document.close()
  printWindow.focus(); printWindow.print()
}

// Phase 3.7 custom assessment DOCX template compatibility is intentionally out
// of scope. These stable structured field/model boundaries are the supported
// handoff for a future explicitly approved custom-template phase.
