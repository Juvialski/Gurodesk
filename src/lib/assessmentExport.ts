import { AlignmentType, BorderStyle, Document, Header, ImageRun, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import type { AssessmentVisual } from '../types/assessmentVisual'
import type { AssessmentExportModel } from '../types/assessmentExport'
import type { ExportPaperSize } from '../types/export'
import { downloadBlob } from './docxTemplate'
import { normalizeAssessmentMathText } from './assessmentMathText'
import {
  buildAssessmentPaperPresentation,
  type AssessmentPaperQuestion,
  type AssessmentPaperPresentationModel,
} from './assessmentExportPresentation'
import { assessmentVisualSvgMarkup, drawAssessmentVisualPdf } from './assessmentVisualExport'

const TEXT = '000000'
const MUTED = '555555'
const PDF_LINE = 11
const PDF_QUESTION_GAP = 9

export type AssessmentLinePage = { lines: string[] }

export function paginateAssessmentLines(lines: string[], maxLines: number): AssessmentLinePage[] {
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) throw new Error('maxLines must be a positive whole number.')
  const pages: AssessmentLinePage[] = []
  for (let start = 0; start < lines.length; start += maxLines) pages.push({ lines: lines.slice(start, start + maxLines) })
  return pages
}
export const paginateAssessmentText = paginateAssessmentLines

function safeFilename(value: string) { return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'assessment' }
function normalizedText(value: string) { return normalizeAssessmentMathText(value) }

/** Built-in jsPDF Helvetica is WinAnsi, not a full Unicode math font. */
function pdfSafeText(value: string) {
  return normalizedText(value)
    .replace(/∠/gu, 'angle ')
    .replace(/∥/gu, ' parallel ')
    .replace(/⊥/gu, ' perpendicular ')
    .replace(/≤/gu, ' <= ')
    .replace(/≥/gu, ' >= ')
    .replace(/≠/gu, ' != ')
    .replace(/≈/gu, ' approx. ')
    .replace(/∞/gu, 'infinity')
    .replace(/√/gu, 'sqrt')
    .replace(/×/gu, ' x ')
    .replace(/÷/gu, ' / ')
    .replace(/±/gu, '+/-')
    .replace(/²/gu, '^2')
    .replace(/³/gu, '^3')
    .replace(/[–—]/gu, '-')
}

export function assessmentExportFilename(model: AssessmentExportModel, extension: 'pdf' | 'docx') {
  const suffix = model.mode === 'answer_key' ? ' - Answer Key' : model.mode === 'teacher' ? ' - Teacher Copy' : ''
  return `${safeFilename(`${model.metadata.gradeLevel ?? ''} ${model.metadata.learningArea ?? ''} - ${model.title}${suffix}`)}.${extension}`
}

function pdfFormat(paper: ExportPaperSize = 'a4'): 'a4' | 'letter' | 'legal' { return paper }
type PdfContext = { doc: jsPDF; x: number; y: number; width: number; bottom: number; pageHeader: (initial?: boolean) => void }

function wrappedPdfLines(doc: jsPDF, value: string, width: number, size = 9.5) {
  doc.setFontSize(size)
  return doc.splitTextToSize(pdfSafeText(value), width) as string[]
}

function pdfTextHeight(doc: jsPDF, value: string, width: number, size = 9.5, lineHeight = PDF_LINE) {
  return Math.max(1, wrappedPdfLines(doc, value, width, size).length) * lineHeight
}

function pdfHeader(ctx: PdfContext, paper: AssessmentPaperPresentationModel, initial = true) {
  const { doc, x, width } = ctx
  doc.setTextColor(0, 0, 0)
  if (!initial) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text(pdfSafeText(paper.header.continuationDocumentTitle), x + width / 2, 28, { align: 'center' })
    doc.setFontSize(8)
    doc.text(pdfSafeText(paper.header.continuationAssessmentTitle), x + width / 2, 41, { align: 'center' })
    ctx.y = 58
    return
  }

  let y = 22
  paper.header.identityLines.forEach((line) => {
    const emphasized = line.role === 'department' || line.role === 'school'
    doc.setFont('helvetica', emphasized ? 'bold' : 'normal')
    doc.setFontSize(line.role === 'department' ? 8.6 : 7.6)
    doc.text(pdfSafeText(line.text), x + width / 2, y, { align: 'center' })
    y += line.role === 'department' ? 10 : 9
  })
  y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(pdfSafeText(paper.header.documentTitle), x + width / 2, y, { align: 'center' })
  y += 16
  doc.setFontSize(11)
  doc.text(pdfSafeText(paper.header.assessmentTitle), x + width / 2, y, { align: 'center' })
  y += 17
  ctx.y = y
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  for (const row of paper.header.metadataRows) {
    const columnGap = 12
    const columnWidth = (width - columnGap * (row.length - 1)) / row.length
    let rowLines = 1
    row.forEach((field, index) => {
      const value = field.value || field.placeholder || ''
      const lines = wrappedPdfLines(doc, `${field.label}: ${value}`, columnWidth, 8.5)
      rowLines = Math.max(rowLines, lines.length)
      lines.forEach((line, lineIndex) => doc.text(line, x + index * (columnWidth + columnGap), ctx.y + lineIndex * 10))
    })
    ctx.y += rowLines * 10 + 3
  }
  if (paper.header.instructions) {
    ctx.y += 3
    doc.setFont('helvetica', 'bold'); doc.text(pdfSafeText(paper.header.instructionsLabel), x, ctx.y); ctx.y += 11
    doc.setFont('helvetica', 'normal')
    const instructionLines = wrappedPdfLines(doc, paper.header.instructions, width, 8.5)
    instructionLines.forEach((line) => { doc.text(line, x, ctx.y); ctx.y += 10 })
  }
  ctx.y += 11
}

function newPdfPage(ctx: PdfContext) { ctx.doc.addPage(); ctx.pageHeader(false) }
function ensurePdfSpace(ctx: PdfContext, height: number) { if (ctx.y + height > ctx.bottom) newPdfPage(ctx) }

function drawWrappedPdfText(ctx: PdfContext, value: string, x: number, width: number, options: { size?: number; bold?: boolean; lineHeight?: number; after?: number } = {}) {
  const size = options.size ?? 9.5
  const lineHeight = options.lineHeight ?? PDF_LINE
  ctx.doc.setFont('helvetica', options.bold ? 'bold' : 'normal'); ctx.doc.setFontSize(size); ctx.doc.setTextColor(0, 0, 0)
  const lines = wrappedPdfLines(ctx.doc, value, width, size)
  lines.forEach((line) => { if (ctx.y + lineHeight > ctx.bottom) newPdfPage(ctx); ctx.doc.text(line, x, ctx.y); ctx.y += lineHeight })
  ctx.y += options.after ?? 0
}

function visualDimensions(ctx: PdfContext, question: AssessmentPaperQuestion, visual: AssessmentVisual) {
  const scaleKind = question.visualScale
  const maxWidth = scaleKind === 'cartesian' ? Math.min(ctx.width * 0.76, 350) : scaleKind === 'large' ? Math.min(ctx.width * 0.64, 300) : Math.min(ctx.width * 0.56, 255)
  const maxHeight = scaleKind === 'cartesian' ? 235 : scaleKind === 'large' ? 185 : 155
  const scale = Math.min(maxWidth / visual.width, maxHeight / visual.height)
  return { width: visual.width * scale, height: visual.height * scale }
}

function drawPdfVisual(ctx: PdfContext, question: AssessmentPaperQuestion, visual: AssessmentVisual, contentX: number) {
  const dimensions = visualDimensions(ctx, question, visual)
  ensurePdfSpace(ctx, dimensions.height + 12)
  const x = contentX + Math.max(0, (ctx.width - (contentX - ctx.x) - dimensions.width) / 2)
  drawAssessmentVisualPdf(ctx.doc, visual, { x, y: ctx.y + 1, width: dimensions.width, height: dimensions.height })
  ctx.y += dimensions.height + 9
}

function pdfQuestionLabel(question: AssessmentPaperQuestion) {
  return `${question.numberLabel}${question.pointLabel ? ` (${question.pointLabel})` : ''}`
}

function estimatePdfVisualHeight(ctx: PdfContext, question: AssessmentPaperQuestion) {
  return question.visual ? visualDimensions(ctx, question, question.visual).height + 9 : 0
}

function estimatePdfMatchingHeight(ctx: PdfContext, question: AssessmentPaperQuestion, contentWidth: number) {
  const half = (contentWidth - 18) / 2
  const left = question.matching.prompts.reduce((sum, prompt) => sum + pdfTextHeight(ctx.doc, `${prompt.label}. ${prompt.text}`, half - 10, 8.7, 10) + 2, 15)
  const right = question.matching.choices.reduce((sum, choice) => sum + pdfTextHeight(ctx.doc, `${choice.label}. ${choice.text}`, half - 10, 8.7, 10) + 2, 15)
  return Math.max(left, right) + 7
}

function estimatePdfQuestionCoreHeight(ctx: PdfContext, question: AssessmentPaperQuestion) {
  const contentWidth = ctx.width - 28
  let height = 15 + pdfTextHeight(ctx.doc, question.prompt, contentWidth, 9.5) + 5 + estimatePdfVisualHeight(ctx, question)
  height += question.subparts.reduce((sum, part) => sum + pdfTextHeight(ctx.doc, `(${part.label}) ${part.prompt}`, contentWidth - 12, 9, 10) + 2, 0)
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') height += question.choices.reduce((sum, choice) => sum + pdfTextHeight(ctx.doc, `${choice.label}. ${choice.text}`, contentWidth - 18, 9, 10) + 2, 0) + 3
  if (question.questionType === 'matching') height += estimatePdfMatchingHeight(ctx, question, contentWidth)
  return height
}

function estimatePdfQuestionHeight(ctx: PdfContext, paper: AssessmentPaperPresentationModel, question: AssessmentPaperQuestion) {
  if (paper.mode === 'answer_key') return 35 + estimatePdfVisualHeight(ctx, question) + question.annotations.reduce((height, annotation) => height + pdfTextHeight(ctx.doc, `${annotation.label}: ${annotation.text}`, ctx.width - 26, 9, 10), 0)
  const contentWidth = ctx.width - 28
  let height = estimatePdfQuestionCoreHeight(ctx, question)
  const responseKind = question.response.kind
  if (responseKind === 'true_false') height += 25
  else if (responseKind === 'single_line' || responseKind === 'numerical') height += Math.max(1, question.response.lines) * 25
  else if (responseKind === 'fill_structured') height += Math.max(1, question.response.blankLabels.length) * 22
  else if (responseKind === 'extended') height += question.response.lines * 18 + 10
  if (question.response.instructions) height += pdfTextHeight(ctx.doc, question.response.instructions, contentWidth, 8.2, 10) + 4
  if (paper.mode === 'teacher') height += question.annotations.reduce((sum, annotation) => sum + pdfTextHeight(ctx.doc, `${annotation.label}: ${annotation.text}`, contentWidth, 8.1, 9.5) + 2, 0)
  return height + PDF_QUESTION_GAP
}

function drawPdfSectionHeader(ctx: PdfContext, title: string, directions?: string, firstQuestionCoreHeight = 0) {
  // A section heading should never be orphaned at the bottom of a page.
  const extraHeight = directions ? pdfTextHeight(ctx.doc, directions, ctx.width, 8.5, 10.5) + 6 : 0
  ensurePdfSpace(ctx, 31 + extraHeight + Math.min(Math.max(firstQuestionCoreHeight, 24), 150))
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(10); ctx.doc.setTextColor(35, 58, 82)
  ctx.doc.text(pdfSafeText(title), ctx.x, ctx.y)
  ctx.y += 5
  ctx.doc.setDrawColor(160, 174, 188); ctx.doc.setLineWidth(0.6); ctx.doc.line(ctx.x, ctx.y, ctx.x + ctx.width, ctx.y)
  ctx.y += 10
  if (directions) {
    ctx.doc.setFont('helvetica', 'italic'); ctx.doc.setFontSize(8.5); ctx.doc.setTextColor(71, 85, 105)
    drawWrappedPdfText(ctx, directions, ctx.x, ctx.width, { size: 8.5, lineHeight: 10.5, after: 8 })
  }
  ctx.doc.setTextColor(0, 0, 0)
}

function drawPdfQuestionHead(ctx: PdfContext, question: AssessmentPaperQuestion, contentX: number) {
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9.5); ctx.doc.setTextColor(0, 0, 0)
  const startY = ctx.y
  ctx.doc.text(pdfSafeText(question.numberLabel), ctx.x, startY)
  let pointReserve = 0
  if (question.pointLabel) {
    const pointText = `(${question.pointLabel})`
    ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8)
    pointReserve = ctx.doc.getTextWidth(pointText) + 8
    ctx.doc.text(pointText, ctx.x + ctx.width - pointReserve + 8, startY)
  }
  ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(9.5)
  const numberWidth = ctx.doc.getTextWidth(pdfSafeText(question.numberLabel)) + 8
  const actualContentX = Math.max(contentX, ctx.x + numberWidth)
  const promptWidth = ctx.width - (actualContentX - ctx.x) - pointReserve
  drawWrappedPdfText(ctx, question.prompt, actualContentX, promptWidth, { size: 9.5, after: 4 })
}

function drawPdfChoiceList(ctx: PdfContext, question: AssessmentPaperQuestion, contentX: number, contentWidth: number) {
  ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(9)
  question.choices.forEach((choice) => {
    let prefix = `${choice.label}. `
    if (choice.checkbox) { ctx.doc.rect(contentX + 5, ctx.y - 7, 7, 7); prefix = `   ${choice.label}. ` }
    drawWrappedPdfText(ctx, `${prefix}${choice.text}`, contentX + 5, contentWidth - 10, { size: 9, lineHeight: 10.5, after: 2 })
  })
}

function drawPdfMatching(ctx: PdfContext, question: AssessmentPaperQuestion, contentX: number, contentWidth: number) {
  const gap = 16
  const half = (contentWidth - gap) / 2
  const drawColumn = (x: number, header: string, entries: string[]) => {
    let y = ctx.y
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9); ctx.doc.text(pdfSafeText(header), x, y)
    y += 12; ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8.7)
    entries.forEach((entry) => {
      const lines = wrappedPdfLines(ctx.doc, entry, half - 8, 8.7)
      lines.forEach((line) => { ctx.doc.text(pdfSafeText(line), x, y); y += 10 })
      y += 2
    })
    return y
  }
  const leftEntries = question.matching.prompts.map((prompt) => `_____ ${prompt.label}. ${prompt.text}`)
  const rightEntries = question.matching.choices.map((choice) => `${choice.label}. ${choice.text}`)
  const leftBottom = drawColumn(contentX, question.matching.columnALabel, leftEntries)
  const rightBottom = drawColumn(contentX + half + gap, question.matching.columnBLabel, rightEntries)
  ctx.y = Math.max(leftBottom, rightBottom) + 5
}

function drawHorizontalAnswerLines(ctx: PdfContext, x: number, width: number, count: number, label?: string) {
  if (label) { ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8.5); ctx.doc.text(pdfSafeText(label), x, ctx.y); ctx.y += 8 }
  for (let index = 0; index < count; index += 1) {
    if (ctx.y + 17 > ctx.bottom) newPdfPage(ctx)
    ctx.doc.setDrawColor(125, 132, 140); ctx.doc.setLineWidth(0.45); ctx.doc.line(x, ctx.y + 7, x + width, ctx.y + 7); ctx.y += 17
  }
}

function drawPdfResponse(ctx: PdfContext, question: AssessmentPaperQuestion, contentX: number, contentWidth: number) {
  const { response } = question
  const kind = response.kind
  if (kind === 'none' || kind === 'fill_inline' || kind === 'matching' || kind === 'true_false') return
  if (kind === 'numerical') {
    ensurePdfSpace(ctx, 27); ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8.8)
    ctx.doc.text(pdfSafeText(`${response.answerLabel}:`), contentX, ctx.y); ctx.doc.line(contentX + 40, ctx.y + 2, contentX + contentWidth * 0.58, ctx.y + 2)
    ctx.doc.text(pdfSafeText(`${response.unitLabel}:`), contentX + contentWidth * 0.64, ctx.y); ctx.doc.line(contentX + contentWidth * 0.72, ctx.y + 2, contentX + contentWidth, ctx.y + 2); ctx.y += 22; return
  }
  if (kind === 'fill_structured') {
    response.blankLabels.forEach((label) => drawHorizontalAnswerLines(ctx, contentX, contentWidth, 1, `${response.answerLabel} ${label}:`)); return
  }
  if (kind === 'single_line') { drawHorizontalAnswerLines(ctx, contentX, contentWidth, Math.max(1, response.lines)); return }
  if (kind === 'extended') {
    if (response.instructions) drawWrappedPdfText(ctx, response.instructions, contentX, contentWidth, { size: 8.2, after: 4 })
    drawHorizontalAnswerLines(ctx, contentX, contentWidth, response.lines); return
  }
}

function drawPdfTeacherAnnotations(ctx: PdfContext, paper: AssessmentPaperPresentationModel, question: AssessmentPaperQuestion, contentX: number, contentWidth: number) {
  if (paper.mode !== 'teacher') return
  question.annotations.forEach((annotation) => drawWrappedPdfText(ctx, `${annotation.label}: ${annotation.text}`, contentX, contentWidth, { size: 8.1, lineHeight: 9.5, after: 2 }))
}

function drawPdfAnswerKeyQuestion(ctx: PdfContext, paper: AssessmentPaperPresentationModel, question: AssessmentPaperQuestion) {
  const contentX = ctx.x + 26; const contentWidth = ctx.width - 26
  ensurePdfSpace(ctx, estimatePdfQuestionHeight(ctx, paper, question))
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9.2); ctx.doc.text(pdfSafeText(pdfQuestionLabel(question)), ctx.x, ctx.y)
  question.annotations.forEach((annotation) => drawWrappedPdfText(ctx, `${annotation.label}: ${annotation.text}`, contentX, contentWidth, { size: annotation.kind === 'answer' ? 9.2 : 8.4, lineHeight: 10, after: 3 }))
  if (question.visual) drawPdfVisual(ctx, question, question.visual, contentX)
  ctx.y += PDF_QUESTION_GAP
}

function drawPdfQuestion(ctx: PdfContext, paper: AssessmentPaperPresentationModel, question: AssessmentPaperQuestion) {
  if (paper.mode === 'answer_key') { drawPdfAnswerKeyQuestion(ctx, paper, question); return }
  const contentX = ctx.x + 28; const contentWidth = ctx.width - 28
  const estimated = estimatePdfQuestionHeight(ctx, paper, question)
  if (question.keepTogether) ensurePdfSpace(ctx, Math.min(estimated, ctx.bottom - 60))
  else {
    // Long-response items may continue only in the writing area. Keep the
    // number, stem, visual, subparts, and any structured choices together.
    const coreHeight = estimatePdfQuestionCoreHeight(ctx, question)
    ensurePdfSpace(ctx, Math.min(coreHeight, ctx.bottom - 60))
  }
  drawPdfQuestionHead(ctx, question, contentX)
  if (question.visual) drawPdfVisual(ctx, question, question.visual, contentX)
  question.subparts.forEach((part) => drawWrappedPdfText(ctx, `(${part.label}) ${part.prompt} (${part.pointLabel})`, contentX + 9, contentWidth - 9, { size: 9, lineHeight: 10, after: 2 }))
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') drawPdfChoiceList(ctx, question, contentX, contentWidth)
  if (question.questionType === 'matching') drawPdfMatching(ctx, question, contentX, contentWidth)
  drawPdfResponse(ctx, question, contentX, contentWidth)
  if (question.response.kind !== 'extended' && question.response.instructions) drawWrappedPdfText(ctx, question.response.instructions, contentX, contentWidth, { size: 8.2, after: 3 })
  drawPdfTeacherAnnotations(ctx, paper, question, contentX, contentWidth)
  ctx.y += PDF_QUESTION_GAP
}

export function buildAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const paper = buildAssessmentPaperPresentation(model)
  const doc = new jsPDF({ unit: 'pt', format: pdfFormat(paperSize) })
  const margin = 42
  const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight()
  const ctx: PdfContext = { doc, x: margin, y: 70, width: pageWidth - margin * 2, bottom: pageHeight - margin, pageHeader: () => {} }
  ctx.pageHeader = (initial = false) => pdfHeader(ctx, paper, initial)
  pdfHeader(ctx, paper, true)
  paper.sections.forEach((section) => {
    if (section.title && section.questions[0]) drawPdfSectionHeader(ctx, section.title, section.directions, estimatePdfQuestionCoreHeight(ctx, section.questions[0]))
    section.questions.forEach((question) => drawPdfQuestion(ctx, paper, question))
  })
  return doc
}

export function downloadAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') { buildAssessmentPdf(model, paperSize).save(assessmentExportFilename(model, 'pdf')) }

function docxPaperSize(paper: ExportPaperSize = 'a4') { return paper === 'letter' ? { width: 12240, height: 15840 } : paper === 'legal' ? { width: 12240, height: 20160 } : { width: 11906, height: 16838 } }
function docxText(text: string, options: { bold?: boolean; size?: number; color?: string; italics?: boolean; leadingSpace?: boolean } = {}) {
  return new TextRun({ text: `${options.leadingSpace ? ' ' : ''}${normalizedText(text)}`, bold: options.bold, italics: options.italics, size: options.size ?? 20, color: options.color ?? TEXT })
}

const DOCX_BORDER = '777777'
const DOCX_LIGHT_BORDER = 'B7BEC7'
const TRANSPARENT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function docxTableBorders(color = DOCX_BORDER, size = 5) {
  return {
    top: { style: BorderStyle.SINGLE, size, color },
    bottom: { style: BorderStyle.SINGLE, size, color },
    left: { style: BorderStyle.SINGLE, size, color },
    right: { style: BorderStyle.SINGLE, size, color },
    insideHorizontal: { style: BorderStyle.SINGLE, size, color },
    insideVertical: { style: BorderStyle.SINGLE, size, color },
  }
}

function docxCell(text: string, options: { bold?: boolean; width?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; muted?: boolean } = {}) {
  return new TableCell({
    ...(options.width ? { width: { size: options.width, type: WidthType.PERCENTAGE } } : {}),
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: [new Paragraph({ alignment: options.align, children: [docxText(text || ' ', { bold: options.bold, size: 18, color: options.muted ? MUTED : TEXT })] })],
  })
}

function docxLabelValueCell(label: string, value: string, columnSpan = 3) {
  return new TableCell({
    columnSpan,
    margins: { top: 75, bottom: 75, left: 105, right: 105 },
    children: [new Paragraph({ children: [docxText(`${label}:`, { bold: true, size: 18 }), docxText(value || '____________________', { size: 18, leadingSpace: true })] })],
  })
}

function docxIdentityHeader(paper: AssessmentPaperPresentationModel): Paragraph[] {
  return paper.header.identityLines.map((line, index) => new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { after: index === paper.header.identityLines.length - 1 ? 90 : 20 },
    children: [docxText(line.text, { bold: line.role === 'department' || line.role === 'school', size: line.role === 'department' ? 20 : 17 })],
  }))
}

function docxAssessmentInfoTable(paper: AssessmentPaperPresentationModel) {
  const rows = paper.header.metadataRows.map((row) => {
    if (row.length === 2) {
      return new TableRow({
        cantSplit: true,
        children: [
          docxLabelValueCell(row[0].label, row[0].value || row[0].placeholder || '', 3),
          docxLabelValueCell(row[1].label, row[1].value || row[1].placeholder || '', 3),
        ],
      })
    }
    if (row.length === 3) {
      return new TableRow({
        cantSplit: true,
        children: [
          docxLabelValueCell(row[0].label, row[0].value || row[0].placeholder || '', 2),
          docxLabelValueCell(row[1].label, row[1].value || row[1].placeholder || '', 2),
          docxLabelValueCell(row[2].label, row[2].value || row[2].placeholder || '', 2),
        ],
      })
    }
    return new TableRow({
      cantSplit: true,
      children: [docxLabelValueCell(row[0].label, row[0].value || row[0].placeholder || '', 6)],
    })
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [1666, 1667, 1667, 1666, 1667, 1667],
    borders: docxTableBorders(DOCX_LIGHT_BORDER, 3),
    rows,
  })
}

function docxContinuationHeader(paper: AssessmentPaperPresentationModel) {
  return new Header({ children: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [docxText(paper.header.continuationDocumentTitle, { bold: true, size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [docxText(paper.header.continuationAssessmentTitle, { size: 16, color: MUTED })] }),
  ] })
}

function docxSectionHeading(text: string, directions?: string) {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      keepNext: true,
      spacing: { before: 200, after: directions ? 40 : 90 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 7, color: TEXT, space: 4 } },
      children: [docxText(text, { bold: true, size: 21 })],
    }),
  ]
  if (directions) {
    paragraphs.push(new Paragraph({
      keepNext: true,
      spacing: { before: 40, after: 100 },
      children: [docxText(directions, { size: 18, italics: true, color: MUTED })],
    }))
  }
  return paragraphs
}

function pngFallbackBytes() {
  const binary = atob(TRANSPARENT_PNG_BASE64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function svgPngFallback(svg: string, width: number, height: number) {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined') return pngFallbackBytes()
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image decode error'))
    })
    image.src = url
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * 2))
    canvas.height = Math.max(1, Math.round(height * 2))
    const context = canvas.getContext('2d')
    if (!context) return pngFallbackBytes()
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!pngBlob) return pngFallbackBytes()
    return new Uint8Array(await pngBlob.arrayBuffer())
  } catch {
    return pngFallbackBytes()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function docxVisualDimensions(question: AssessmentPaperQuestion, visual: AssessmentVisual) {
  const scaleKind = question.visualScale
  const maxWidth = scaleKind === 'cartesian' ? 440 : scaleKind === 'large' ? 390 : 350
  const maxHeight = scaleKind === 'cartesian' ? 285 : scaleKind === 'large' ? 250 : 220
  const scale = Math.min(maxWidth / visual.width, maxHeight / visual.height, 1)
  return { width: Math.max(1, Math.round(visual.width * scale)), height: Math.max(1, Math.round(visual.height * scale)) }
}

async function docxVisualParagraph(question: AssessmentPaperQuestion, visual: AssessmentVisual): Promise<Paragraph> {
  const dimensions = docxVisualDimensions(question, visual)
  const svg = assessmentVisualSvgMarkup(visual)
  const svgBinary = new TextEncoder().encode(svg)
  const pngFallback = await svgPngFallback(svg, dimensions.width, dimensions.height)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepLines: true,
    keepNext: true,
    spacing: { before: 55, after: 70 },
    children: [new ImageRun({
      type: 'svg',
      data: svgBinary,
      fallback: { type: 'png', data: pngFallback },
      transformation: dimensions,
      altText: { title: 'Assessment diagram', description: visual.altText, name: visual.id },
    })],
  })
}

function docxMatchingTable(question: AssessmentPaperQuestion) {
  const rows: TableRow[] = [new TableRow({ cantSplit: true, children: [docxCell(question.matching.columnALabel, { bold: true, width: 54, align: AlignmentType.CENTER }), docxCell(question.matching.columnBLabel, { bold: true, width: 46, align: AlignmentType.CENTER })] })]
  const count = Math.max(question.matching.prompts.length, question.matching.choices.length)
  for (let index = 0; index < count; index += 1) {
    const prompt = question.matching.prompts[index]
    const choice = question.matching.choices[index]
    const promptText = prompt ? `_____ ${prompt.label}. ${prompt.text}` : ' '
    const choiceTextValue = choice ? `${choice.label}. ${choice.text}` : ' '
    rows.push(new TableRow({ cantSplit: true, children: [docxCell(promptText, { width: 54 }), docxCell(choiceTextValue, { width: 46 })] }))
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: docxTableBorders(DOCX_LIGHT_BORDER, 3), rows })
}

function docxWritingLine(spacingAfter = 70, size = 17) {
  return new Paragraph({
    keepLines: true,
    spacing: { before: 55, after: spacingAfter },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '777777', space: 1 } },
    children: [docxText(' ', { size, color: '777777' })],
  })
}

function docxNoBorders() {
  const edge = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: edge, bottom: edge, left: edge, right: edge, insideHorizontal: edge, insideVertical: edge }
}

async function docxQuestion(paper: AssessmentPaperPresentationModel, question: AssessmentPaperQuestion): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = []
  if (paper.mode === 'answer_key') {
    children.push(new Paragraph({ keepNext: Boolean(question.visual), spacing: { before: 70, after: 35 }, children: [docxText(pdfQuestionLabel(question), { bold: true, size: 19 })] }))
    question.annotations.forEach((annotation) => children.push(new Paragraph({ keepNext: annotation.kind === 'answer' && Boolean(question.visual), spacing: { after: annotation.kind === 'answer' ? 35 : 70 }, children: [docxText(`${annotation.label}:`, { bold: true, size: annotation.kind === 'answer' ? 19 : 17 }), docxText(annotation.text, { size: annotation.kind === 'answer' ? 19 : 17, color: annotation.kind === 'answer' ? TEXT : MUTED, leadingSpace: true })] })))
    if (question.visual) children.push(await docxVisualParagraph(question, question.visual))
    return children
  }
  children.push(new Paragraph({
    keepNext: question.keepTogether,
    keepLines: true,
    spacing: { before: 65, after: 45 },
    children: [docxText(question.numberLabel, { bold: true, size: 20 }), docxText(question.prompt, { size: 20, leadingSpace: true }), ...(question.pointLabel ? [docxText(`(${question.pointLabel})`, { size: 16, color: MUTED, leadingSpace: true })] : [])],
  }))
  if (question.visual) children.push(await docxVisualParagraph(question, question.visual))
  question.subparts.forEach((part) => children.push(new Paragraph({ keepNext: true, keepLines: true, spacing: { after: 30 }, children: [docxText(`(${part.label}) ${part.prompt} (${part.pointLabel})`, { size: 18 })] })))
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') question.choices.forEach((choice, index) => children.push(new Paragraph({ keepNext: index < question.choices.length - 1, spacing: { after: 28 }, indent: { left: 260 }, children: [docxText(`${choice.checkbox ? '☐ ' : ''}${choice.label}. ${choice.text}`, { size: 18 })] })))
  if (question.questionType === 'matching') children.push(docxMatchingTable(question))
  const { response } = question
  const kind = response.kind
  if (kind === 'true_false') {
    // DepEd True/False uses the preceding blank line before the question number.
  }
  else if (kind === 'numerical') children.push(new Paragraph({ spacing: { before: 45, after: 70 }, children: [docxText(`${response.answerLabel}: ____________________    ${response.unitLabel}: __________`, { size: 18 })] }))
  else if (kind === 'single_line') for (let index = 0; index < Math.max(1, response.lines); index += 1) children.push(docxWritingLine())
  else if (kind === 'fill_structured') response.blankLabels.forEach((label) => children.push(new Paragraph({ spacing: { before: 35, after: 55 }, children: [docxText(`${response.answerLabel} ${label}: ____________________________________`, { size: 18 })] })))
  else if (kind === 'extended') {
    if (response.instructions) children.push(new Paragraph({ spacing: { before: 35, after: 50 }, children: [docxText(response.instructions, { size: 17, color: MUTED, italics: true })] }))
    for (let index = 0; index < response.lines; index += 1) children.push(docxWritingLine(55, 16))
  }
  question.annotations.forEach((annotation) => children.push(new Paragraph({ spacing: { before: annotation.kind === 'answer' ? 55 : 0, after: annotation.kind === 'answer' ? 25 : annotation.kind === 'solution' ? 35 : annotation.kind === 'rationale' ? 80 : 25 }, children: [docxText(`${annotation.label}:`, { bold: annotation.kind === 'answer' || annotation.kind === 'competency', size: annotation.kind === 'answer' ? 17 : annotation.kind === 'solution' ? 16 : 15, color: annotation.kind === 'answer' ? TEXT : MUTED }), docxText(annotation.text, { size: annotation.kind === 'answer' ? 17 : annotation.kind === 'solution' ? 16 : 15, color: annotation.kind === 'answer' ? TEXT : MUTED, leadingSpace: true })] })))
  if (question.questionType !== 'matching') return children
  // A matching block is small but structurally indivisible. Keep its stem and
  // native inner table inside one non-splitting outer row so Word/LibreOffice
  // move the whole block instead of orphaning the final choice on a new page.
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: docxNoBorders(),
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({ margins: { top: 0, bottom: 0, left: 0, right: 0 }, borders: docxNoBorders(), children })],
    })],
  })]
}

export async function buildAssessmentDocxBlob(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const paper = buildAssessmentPaperPresentation(model)
  const children: Array<Paragraph | Table> = [
    ...docxIdentityHeader(paper),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 35, after: 35 }, children: [docxText(paper.header.documentTitle, { bold: true, size: 27 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 120 }, children: [docxText(paper.header.assessmentTitle, { bold: true, size: 23 })] }),
    docxAssessmentInfoTable(paper),
  ]
  if (paper.header.instructions) {
    children.push(new Paragraph({ keepNext: true, spacing: { before: 170, after: 40 }, children: [docxText(`${paper.header.instructionsLabel}:`, { bold: true, size: 19 })] }))
    children.push(new Paragraph({ keepLines: true, spacing: { after: 110 }, children: [docxText(paper.header.instructions, { size: 19 })] }))
  }
  for (const section of paper.sections) {
    if (section.title) children.push(...docxSectionHeading(section.title, section.directions))
    for (const question of section.questions) children.push(...await docxQuestion(paper, question))
  }
  const size = docxPaperSize(paperSize)
  const document = new Document({
    creator: model.metadata.teacherName || undefined,
    title: `${model.title}${model.mode === 'answer_key' ? ' - Answer Key' : model.mode === 'teacher' ? ' - Teacher Copy' : ''}`,
    sections: [{
      properties: { titlePage: true, page: { size, margin: { top: 720, right: 720, bottom: 720, left: 720, header: 360 } } },
      headers: { first: new Header({ children: [new Paragraph({ children: [] })] }), default: docxContinuationHeader(paper) },
      children,
    }],
  })
  return Packer.toBlob(document)
}

export async function downloadAssessmentDocx(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') { const blob = await buildAssessmentDocxBlob(model, paperSize); downloadBlob(blob, assessmentExportFilename(model, 'docx')) }

function escapeHtml(value: string) { return normalizedText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') }
function printVisualMarkup(question: AssessmentPaperQuestion) {
  if (!question.visual) return ''
  const markup = assessmentVisualSvgMarkup(question.visual)
  return markup ? markup.replace('<svg ', `<svg class="assessment-print-visual" data-visual-scale="${question.visualScale}" `) : ''
}

function printQuestionMarkup(paper: AssessmentPaperPresentationModel, question: AssessmentPaperQuestion) {
  const pointLabel = question.pointLabel ? `<small>${escapeHtml(question.pointLabel)}</small>` : ''
  const annotationMarkup = question.annotations.map((annotation) => `<${annotation.kind === 'answer' ? 'div' : 'p'} class="${annotation.kind === 'answer' ? 'answer' : annotation.kind === 'solution' ? 'scoring-guide' : 'annotation'}" data-annotation-kind="${annotation.kind}"><b>${escapeHtml(annotation.label)}:</b> ${escapeHtml(annotation.text)}</${annotation.kind === 'answer' ? 'div' : 'p'}>`).join('')
  if (paper.mode === 'answer_key') return `<section class="question-flow assessment-question-${question.questionType}"><h3>${escapeHtml(question.numberLabel)} ${pointLabel}</h3>${annotationMarkup}${printVisualMarkup(question)}</section>`
  const choiceMarkup = question.questionType === 'matching'
    ? `<div class="matching-grid"><div><b>${escapeHtml(question.matching.columnALabel)}</b>${question.matching.prompts.map((prompt) => `<div>_____ ${escapeHtml(prompt.label)}. ${escapeHtml(prompt.text)}</div>`).join('')}</div><div><b>${escapeHtml(question.matching.columnBLabel)}</b>${question.matching.choices.map((choice) => `<div>${escapeHtml(choice.label)}. ${escapeHtml(choice.text)}</div>`).join('')}</div></div>`
    : (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') ? `<div class="choice-list">${question.choices.map((choice) => `<div class="choice-row">${escapeHtml(choice.label)}. ${choice.checkbox ? '<span class="check-box"></span>' : ''}${escapeHtml(choice.text)}</div>`).join('')}</div>` : ''
  const subpartMarkup = question.subparts.length ? `<ol type="a" class="subparts">${question.subparts.map((part) => `<li>${escapeHtml(part.prompt)} <small>(${escapeHtml(part.pointLabel)})</small></li>`).join('')}</ol>` : ''
  const { response } = question
  const kind = response.kind
  let responseMarkup = ''
  if (kind === 'true_false') responseMarkup = ''
  else if (kind === 'numerical') responseMarkup = `<div class="numeric-response">${escapeHtml(response.answerLabel)}: ____________________ &nbsp;&nbsp; ${escapeHtml(response.unitLabel)}: __________</div>`
  else if (kind === 'single_line') responseMarkup = `<div class="response-lines">${'<div class="response-line"></div>'.repeat(Math.max(1, response.lines))}</div>`
  else if (kind === 'fill_structured') responseMarkup = `<div class="response-lines">${response.blankLabels.map((label) => `<div>${escapeHtml(response.answerLabel)} ${escapeHtml(label)}: ____________________________________</div>`).join('')}</div>`
  else if (kind === 'extended') responseMarkup = `${response.instructions ? `<p class="response-instructions">${escapeHtml(response.instructions)}</p>` : ''}<div class="response-lines">${'<div class="response-line"></div>'.repeat(response.lines)}</div>`
  else if (response.instructions) responseMarkup = `<p class="response-instructions">${escapeHtml(response.instructions)}</p>`
  const coreMarkup = `<div class="question-core"><h3>${escapeHtml(question.numberLabel)} ${pointLabel}</h3><p>${escapeHtml(question.prompt)}</p>${printVisualMarkup(question)}${subpartMarkup}${choiceMarkup}</div>`
  return `<section class="question-flow assessment-question-${question.questionType}">${coreMarkup}${responseMarkup}${annotationMarkup}</section>`
}

export function assessmentPrintHtml(model: AssessmentExportModel) {
  const paper = buildAssessmentPaperPresentation(model)
  const identity = paper.header.identityLines.map((line) => `<span class="identity-${line.role}">${escapeHtml(line.text)}</span>`).join('')
  const metadata = paper.header.metadataRows.map((row) => `<div class="metadata-row" data-columns="${row.length}">${row.map((field) => `<span><b>${escapeHtml(field.label)}:</b> ${escapeHtml(field.value || field.placeholder || '')}</span>`).join('')}</div>`).join('')
  const questions = paper.sections.map((section) => `${section.title ? `<div class="assessment-section-head"><h2 class="assessment-section-heading">${escapeHtml(section.title)}</h2>${section.directions ? `<p class="assessment-section-directions">${escapeHtml(section.directions)}</p>` : ''}</div>` : ''}${section.questions.map((question) => printQuestionMarkup(paper, question)).join('')}`).join('')
  return `<article class="assessment-document assessment-document-${paper.mode}" data-paper-model="assessment-paper-v1" data-continuation-document-title="${escapeHtml(paper.header.continuationDocumentTitle)}" data-continuation-assessment-title="${escapeHtml(paper.header.continuationAssessmentTitle)}"><div class="continuation-header"><strong>${escapeHtml(paper.header.continuationDocumentTitle)}</strong><span>${escapeHtml(paper.header.continuationAssessmentTitle)}</span></div><header><div class="identity">${identity}</div><strong class="document-title">${escapeHtml(paper.header.documentTitle)}</strong><h1>${escapeHtml(paper.header.assessmentTitle)}</h1><div class="metadata">${metadata}</div>${paper.header.instructions ? `<div class="instructions"><b>${escapeHtml(paper.header.instructionsLabel)}</b><p>${escapeHtml(paper.header.instructions)}</p></div>` : ''}</header><main>${questions}</main></article>`
}

export function buildAssessmentPrintModel(model: AssessmentExportModel) { return buildAssessmentPaperPresentation(model) }
export function printAssessment(model: AssessmentExportModel) {
  const html = assessmentPrintHtml(model); const popup = window.open('', '_blank', 'noopener,noreferrer')
  if (!popup) throw new Error('The browser blocked the print window. Allow popups to print this assessment.')
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(model.title)}</title><style>@page{margin:18mm 12mm 12mm}body{font-family:Arial,sans-serif;margin:24px}.assessment-document{max-width:850px;margin:auto}.identity{display:grid;justify-items:center;gap:2px;font-size:11px}.identity-department,.identity-school{font-weight:700}.document-title{display:block;margin-top:12px;text-align:center}h1{text-align:center}.metadata{display:grid;border:1px solid #cbd2d9}.metadata-row{display:grid}.metadata-row[data-columns="1"]{grid-template-columns:1fr}.metadata-row[data-columns="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}.metadata-row[data-columns="3"]{grid-template-columns:repeat(3,minmax(0,1fr))}.metadata-row+.metadata-row{border-top:1px solid #d8dde2}.metadata-row span{padding:7px 9px;font-size:11px}.metadata-row span+span{border-left:1px solid #d8dde2}.continuation-header{display:none}.instructions{margin:18px 0 16px;padding:10px 12px;border:1px solid #d8dde2}.assessment-section-heading{break-after:avoid;margin:20px 0 10px;border-bottom:1px solid #9aa7b4;padding-bottom:5px;font-size:14px}.question-flow{margin:0 0 20px}.question-core{break-inside:avoid}.assessment-question-multiple_choice,.assessment-question-true_false,.assessment-question-short_answer,.assessment-question-identification,.assessment-question-fill_in_the_blank,.assessment-question-numerical_answer,.assessment-question-matching,.assessment-question-multiple_select{break-inside:avoid}.response-lines{display:grid;gap:8px;width:100%;margin:7px 0 10px}.response-line{width:100%;height:18px;border-bottom:1px solid #7d858d}.assessment-print-visual{display:block;width:min(100%,330px);max-height:220px;margin:6px auto 10px;break-inside:avoid}.assessment-print-visual[data-visual-scale=large]{width:min(100%,390px);max-height:250px}.assessment-print-visual[data-visual-scale=cartesian]{width:min(100%,480px);max-height:320px}.matching-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.matching-grid>div{display:grid;gap:4px}.check-box{display:inline-block;width:10px;height:10px;border:1px solid #333;margin:0 5px 0 0;vertical-align:middle}.true-false,.numeric-response{margin:8px 0 10px}.choice-list{display:grid;gap:3px;margin:5px 0 7px;line-height:1.45}.choice-row{padding-left:3px}.response-instructions,.annotation,.scoring-guide{color:#5f6c79;font-size:11px}@media print{body{margin:0}.continuation-header{position:fixed;top:-13mm;left:0;right:0;display:grid;justify-items:center;font-size:8pt}.continuation-header span{color:#555;font-size:7.5pt}.assessment-document>header{position:relative;z-index:1;background:#fff}.question-flow{orphans:3;widows:3}.assessment-section-heading{break-after:avoid}.assessment-question-constructed_response,.assessment-question-problem_solving,.assessment-question-essay{break-inside:auto}}</style></head><body>${html}</body></html>`)
  popup.document.close(); popup.focus(); popup.print()
}

// Phase 3.7 custom assessment DOCX template hooks remain intentionally
// deterministic: assessment content is rendered from saved structured data.
