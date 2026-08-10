import { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import type { AssessmentAnswer, QuestionType } from '../types/assessment'
import type { AssessmentVisual } from '../types/assessmentVisual'
import type { AssessmentExportModel, AssessmentExportQuestion } from '../types/assessmentExport'
import type { ExportPaperSize } from '../types/export'
import { downloadBlob } from './docxTemplate'
import { normalizeAssessmentMathText } from './assessmentMathText'
import {
  assessmentQuestionKeepTogether,
  assessmentQuestionTypeLabel,
  assessmentResponseKind,
  assessmentSectionTitle,
  assessmentUsesContiguousTypeSections,
  assessmentVisualScale,
  recommendedAssessmentResponseLines,
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

function clean(value: string | null | undefined) { return (value ?? '').trim() }
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown) { return Array.isArray(value) ? value : [] }
function safeFilename(value: string) { return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'assessment' }
function visibleLabel(index: number) { return String.fromCharCode(65 + index) }
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

function answerText(answer: AssessmentAnswer) {
  const value = answer as unknown as Record<string, unknown>
  if (answer.type === 'multiple_choice') {
    const choices = array(value.choices).map(object)
    const index = choices.findIndex((choice) => String(choice.id) === answer.choiceId)
    const choice = choices[index]
    return choice ? `${visibleLabel(index)}. ${normalizedText(String(choice.text ?? ''))}` : 'Review choice mapping'
  }
  if (answer.type === 'true_false') return answer.value ? 'True' : 'False'
  if (answer.type === 'short_answer' || answer.type === 'identification') return array(value.acceptedAnswers).map((entry) => normalizedText(String(entry))).join(' / ')
  if (answer.type === 'fill_in_the_blank') return array(value.blanks).map((blank, index) => { const entry = object(blank); const points = Number(entry.pointsPossible); return `${visibleLabel(index)}. ${array(entry.acceptedAnswers).map((answerValue) => normalizedText(String(answerValue))).join(' / ')}${Number.isFinite(points) ? ` - ${points} pt${points === 1 ? '' : 's'}` : ''}` }).join(' | ')
  if (answer.type === 'numerical_answer') return `${String(value.value ?? '')}${value.unit ? ` ${normalizedText(String(value.unit))}` : ''}${value.tolerance !== undefined ? ` (+/-${String(value.tolerance)})` : ''}`
  if (answer.type === 'problem_solving') return normalizedText(String(value.finalAnswer ?? ''))
  if (answer.type === 'matching') {
    const prompts = array(value.prompts).map(object)
    const choices = array(value.choices).map(object)
    return array(value.mappings).map((mapping) => {
      const pair = object(mapping)
      const p = prompts.findIndex((entry) => String(entry.id) === String(pair.promptId))
      const c = choices.findIndex((entry) => String(entry.id) === String(pair.choiceId))
      const points = Number(pair.pointsPossible)
      return `${p >= 0 ? p + 1 : String(pair.promptId)} -> ${c >= 0 ? visibleLabel(c) : String(pair.choiceId)}${Number.isFinite(points) ? ` - ${points} pt${points === 1 ? '' : 's'}` : ''}`
    }).join(', ')
  }
  if (answer.type === 'multiple_select') {
    const choices = array(value.choices).map(object)
    return array(value.choiceIds).map((id) => { const index = choices.findIndex((choice) => String(choice.id) === String(id)); return index >= 0 ? visibleLabel(index) : '' }).filter(Boolean).join(', ')
  }
  if (answer.type === 'constructed_response') return normalizedText(String(value.expectedResponse ?? ''))
  if (answer.type === 'essay') return 'See rubric / scoring guide; there is no single exact response.'
  return ''
}

function questionAnswer(question: AssessmentExportQuestion) { return 'answer' in question && question.answer ? answerText(question.answer) : '' }

function textMetadata(model: AssessmentExportModel) {
  const { labels, metadata } = model
  const common: Array<[string, string]> = [[labels.teacher, metadata.teacherName], [labels.school, metadata.schoolName], [labels.gradeLevel, metadata.gradeLevel], [labels.learningArea, metadata.learningArea], [labels.schoolYear, metadata.schoolYear], [labels.gradingTerm, metadata.gradingTerm]]
  if (model.mode === 'teacher') common.push([labels.curriculumPeriods, metadata.curriculumPeriods ?? ''])
  if (model.mode !== 'answer_key') { common.push([labels.learnerName, metadata.learnerName || '____________________________']); common.push([labels.section, metadata.section || '____________________________']) }
  common.push([labels.totalItems, String(metadata.totalItems ?? model.questions.length)])
  common.push([labels.totalPoints, String(metadata.totalPoints ?? model.questions.reduce((sum, question) => sum + question.pointsPossible, 0))])
  return common.filter(([, value]) => clean(value))
}

function choicesFor(question: AssessmentExportQuestion) { return 'choices' in question && Array.isArray(question.choices) ? question.choices : [] }
function promptsFor(question: AssessmentExportQuestion) { return 'prompts' in question && Array.isArray(question.prompts) ? question.prompts : [] }
function blanksFor(question: AssessmentExportQuestion) { return 'blanks' in question && Array.isArray(question.blanks) ? question.blanks : [] }
function subpartsFor(question: AssessmentExportQuestion) { return 'subparts' in question && Array.isArray(question.subparts) ? question.subparts : [] }
function choiceText(choice: string | { text: string }) { return normalizedText(typeof choice === 'string' ? choice : choice.text) }

function pdfFormat(paper: ExportPaperSize = 'a4'): 'a4' | 'letter' | 'legal' { return paper }
type PdfContext = { doc: jsPDF; x: number; y: number; width: number; bottom: number; pageHeader: (initial?: boolean) => void }

function wrappedPdfLines(doc: jsPDF, value: string, width: number, size = 9.5) {
  doc.setFontSize(size)
  return doc.splitTextToSize(pdfSafeText(value), width) as string[]
}

function pdfTextHeight(doc: jsPDF, value: string, width: number, size = 9.5, lineHeight = PDF_LINE) {
  return Math.max(1, wrappedPdfLines(doc, value, width, size).length) * lineHeight
}

function pdfHeader(ctx: PdfContext, model: AssessmentExportModel, initial = true) {
  const { doc, x, width } = ctx
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(initial ? 15 : 10)
  doc.text(pdfSafeText(initial ? model.labels.documentTitle : `${model.labels.documentTitle} - continued`), x + width / 2, initial ? 34 : 30, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(initial ? 12 : 8)
  doc.text(pdfSafeText(model.title), x + width / 2, initial ? 51 : 44, { align: 'center' })
  ctx.y = initial ? 69 : 60
  if (!initial) return

  const metadata = textMetadata(model)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  const columnGap = 14
  const columnWidth = (width - columnGap) / 2
  for (let index = 0; index < metadata.length; index += 2) {
    const left = metadata[index]
    const right = metadata[index + 1]
    const leftLines = wrappedPdfLines(doc, `${left[0]}: ${left[1]}`, columnWidth, 8.5)
    const rightLines = right ? wrappedPdfLines(doc, `${right[0]}: ${right[1]}`, columnWidth, 8.5) : []
    const rowLines = Math.max(leftLines.length, rightLines.length, 1)
    leftLines.forEach((line, lineIndex) => doc.text(line, x, ctx.y + lineIndex * 10))
    rightLines.forEach((line, lineIndex) => doc.text(line, x + columnWidth + columnGap, ctx.y + lineIndex * 10))
    ctx.y += rowLines * 10 + 3
  }
  if (model.instructions) {
    ctx.y += 3
    doc.setFont('helvetica', 'bold'); doc.text(pdfSafeText(model.labels.instructions), x, ctx.y); ctx.y += 11
    doc.setFont('helvetica', 'normal')
    const instructionLines = wrappedPdfLines(doc, model.instructions, width, 8.5)
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

function visualDimensions(ctx: PdfContext, question: AssessmentExportQuestion, visual: AssessmentVisual) {
  const scaleKind = assessmentVisualScale(question)
  const maxWidth = scaleKind === 'cartesian' ? Math.min(ctx.width * 0.76, 350) : scaleKind === 'large' ? Math.min(ctx.width * 0.64, 300) : Math.min(ctx.width * 0.56, 255)
  const maxHeight = scaleKind === 'cartesian' ? 235 : scaleKind === 'large' ? 185 : 155
  const scale = Math.min(maxWidth / visual.width, maxHeight / visual.height)
  return { width: visual.width * scale, height: visual.height * scale }
}

function drawPdfVisual(ctx: PdfContext, question: AssessmentExportQuestion, visual: AssessmentVisual, contentX: number) {
  const dimensions = visualDimensions(ctx, question, visual)
  ensurePdfSpace(ctx, dimensions.height + 12)
  const x = contentX + Math.max(0, (ctx.width - (contentX - ctx.x) - dimensions.width) / 2)
  drawAssessmentVisualPdf(ctx.doc, visual, { x, y: ctx.y + 1, width: dimensions.width, height: dimensions.height })
  ctx.y += dimensions.height + 9
}

function pdfQuestionLabel(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  return model.mode === 'student' && question.pointsPossible <= 1 ? `${question.itemNumber}.` : `${question.itemNumber}. (${question.pointsPossible} ${model.labels.points})`
}

function estimatePdfVisualHeight(ctx: PdfContext, question: AssessmentExportQuestion) {
  return question.visual ? visualDimensions(ctx, question, question.visual).height + 9 : 0
}

function estimatePdfMatchingHeight(ctx: PdfContext, question: AssessmentExportQuestion, contentWidth: number) {
  const prompts = promptsFor(question); const choices = choicesFor(question)
  const half = (contentWidth - 18) / 2
  const left = prompts.reduce((sum, prompt, index) => sum + pdfTextHeight(ctx.doc, `${index + 1}. ${typeof prompt === 'string' ? prompt : prompt.text}`, half - 10, 8.7, 10) + 2, 15)
  const right = choices.reduce((sum, choice, index) => sum + pdfTextHeight(ctx.doc, `${visibleLabel(index)}. ${choiceText(choice)}`, half - 10, 8.7, 10) + 2, 15)
  return Math.max(left, right) + 7
}

function estimatePdfQuestionCoreHeight(ctx: PdfContext, question: AssessmentExportQuestion) {
  if (!('prompt' in question)) return 0
  const contentWidth = ctx.width - 28
  let height = 15 + pdfTextHeight(ctx.doc, question.prompt, contentWidth, 9.5) + 5 + estimatePdfVisualHeight(ctx, question)
  height += subpartsFor(question).reduce((sum, part) => sum + pdfTextHeight(ctx.doc, `(${part.label}) ${part.prompt}`, contentWidth - 12, 9, 10) + 2, 0)
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') height += choicesFor(question).reduce((sum, choice, index) => sum + pdfTextHeight(ctx.doc, `${visibleLabel(index)}. ${choiceText(choice)}`, contentWidth - 18, 9, 10) + 2, 0) + 3
  if (question.questionType === 'matching') height += estimatePdfMatchingHeight(ctx, question, contentWidth)
  return height
}

function estimatePdfQuestionHeight(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion) {
  if (model.mode === 'answer_key') return 35 + estimatePdfVisualHeight(ctx, question) + pdfTextHeight(ctx.doc, questionAnswer(question), ctx.width - 26, 9, 10)
  if (!('prompt' in question)) return 0
  const contentWidth = ctx.width - 28
  let height = estimatePdfQuestionCoreHeight(ctx, question)
  const responseKind = assessmentResponseKind(question)
  if (responseKind === 'true_false') height += 25
  else if (responseKind === 'single_line' || responseKind === 'numerical') height += 25
  else if (responseKind === 'fill_structured') height += Math.max(1, blanksFor(question).length) * 22
  else if (responseKind === 'extended') height += recommendedAssessmentResponseLines(question) * 18 + 10
  if ('responseInstructions' in question && question.responseInstructions) height += pdfTextHeight(ctx.doc, question.responseInstructions, contentWidth, 8.2, 10) + 4
  return height + PDF_QUESTION_GAP
}

function drawPdfSectionHeader(ctx: PdfContext, type: QuestionType, sectionIndex: number, firstQuestionCoreHeight = 0) {
  // A section heading should never be orphaned at the bottom of a page.
  ensurePdfSpace(ctx, 31 + Math.min(Math.max(firstQuestionCoreHeight, 24), 150))
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(10); ctx.doc.setTextColor(35, 58, 82)
  ctx.doc.text(pdfSafeText(assessmentSectionTitle(type, sectionIndex)), ctx.x, ctx.y)
  ctx.y += 5
  ctx.doc.setDrawColor(160, 174, 188); ctx.doc.setLineWidth(0.6); ctx.doc.line(ctx.x, ctx.y, ctx.x + ctx.width, ctx.y)
  ctx.y += 12
  ctx.doc.setTextColor(0, 0, 0)
}

function drawPdfQuestionHead(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion, contentX: number) {
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9.5); ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(pdfSafeText(pdfQuestionLabel(model, question)), ctx.x, ctx.y)
  if ('prompt' in question) drawWrappedPdfText(ctx, question.prompt, contentX, ctx.width - (contentX - ctx.x), { size: 9.5, after: 4 })
  else ctx.y += 12
}

function drawPdfChoiceList(ctx: PdfContext, question: AssessmentExportQuestion, contentX: number, contentWidth: number) {
  const square = question.questionType === 'multiple_select'
  choicesFor(question).forEach((choice, index) => {
    const label = `${visibleLabel(index)}. ${choiceText(choice)}`
    const lines = wrappedPdfLines(ctx.doc, label, contentWidth - (square ? 18 : 6), 9)
    ensurePdfSpace(ctx, lines.length * 10 + 2)
    if (square) { ctx.doc.rect(contentX, ctx.y - 7, 7, 7); lines.forEach((line, lineIndex) => ctx.doc.text(pdfSafeText(line), contentX + 13, ctx.y + lineIndex * 10)) }
    else lines.forEach((line, lineIndex) => ctx.doc.text(pdfSafeText(line), contentX + 4, ctx.y + lineIndex * 10))
    ctx.y += lines.length * 10 + 2
  })
  ctx.y += 3
}

function drawPdfMatching(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion, contentX: number, contentWidth: number) {
  const prompts = promptsFor(question); const choices = choicesFor(question)
  const gap = 18; const half = (contentWidth - gap) / 2; const startY = ctx.y
  const drawColumn = (x: number, heading: string, entries: string[]) => {
    let y = startY
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(8.7); ctx.doc.text(pdfSafeText(heading), x, y); y += 12
    ctx.doc.setFont('helvetica', 'normal')
    entries.forEach((entry) => {
      const lines = wrappedPdfLines(ctx.doc, entry, half - 8, 8.7)
      lines.forEach((line) => { ctx.doc.text(pdfSafeText(line), x, y); y += 10 })
      y += 2
    })
    return y
  }
  const leftEntries = prompts.map((prompt, index) => `_____ ${index + 1}. ${typeof prompt === 'string' ? prompt : prompt.text}`)
  const rightEntries = choices.map((choice, index) => `${visibleLabel(index)}. ${choiceText(choice)}`)
  const leftBottom = drawColumn(contentX, model.labels.columnA, leftEntries)
  const rightBottom = drawColumn(contentX + half + gap, model.labels.columnB, rightEntries)
  ctx.y = Math.max(leftBottom, rightBottom) + 5
}

function drawHorizontalAnswerLines(ctx: PdfContext, x: number, width: number, count: number, label?: string) {
  if (label) { ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8.5); ctx.doc.text(pdfSafeText(label), x, ctx.y); ctx.y += 8 }
  for (let index = 0; index < count; index += 1) {
    if (ctx.y + 17 > ctx.bottom) newPdfPage(ctx)
    ctx.doc.setDrawColor(125, 132, 140); ctx.doc.setLineWidth(0.45); ctx.doc.line(x, ctx.y + 7, x + width, ctx.y + 7); ctx.y += 17
  }
}

function drawPdfResponse(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion, contentX: number, contentWidth: number) {
  const kind = assessmentResponseKind(question)
  if (kind === 'none' || kind === 'fill_inline' || kind === 'matching') return
  if (kind === 'true_false') {
    ensurePdfSpace(ctx, 24); ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(9)
    ctx.doc.rect(contentX, ctx.y - 7, 8, 8); ctx.doc.text('True', contentX + 13, ctx.y)
    ctx.doc.rect(contentX + 70, ctx.y - 7, 8, 8); ctx.doc.text('False', contentX + 83, ctx.y); ctx.y += 20; return
  }
  if (kind === 'numerical') {
    ensurePdfSpace(ctx, 27); ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8.8)
    ctx.doc.text('Answer:', contentX, ctx.y); ctx.doc.line(contentX + 40, ctx.y + 2, contentX + contentWidth * 0.58, ctx.y + 2)
    ctx.doc.text('Unit:', contentX + contentWidth * 0.64, ctx.y); ctx.doc.line(contentX + contentWidth * 0.72, ctx.y + 2, contentX + contentWidth, ctx.y + 2); ctx.y += 22; return
  }
  if (kind === 'fill_structured') {
    const blanks = blanksFor(question)
    ;(blanks.length ? blanks : [{ label: 'A' }]).forEach((blank) => drawHorizontalAnswerLines(ctx, contentX, contentWidth, 1, `${model.labels.answer} ${blank.label}:`)); return
  }
  if (kind === 'single_line') { drawHorizontalAnswerLines(ctx, contentX, contentWidth, 1); return }
  if (kind === 'extended') {
    if ('responseInstructions' in question && question.responseInstructions) drawWrappedPdfText(ctx, question.responseInstructions, contentX, contentWidth, { size: 8.2, after: 4 })
    drawHorizontalAnswerLines(ctx, contentX, contentWidth, recommendedAssessmentResponseLines(question)); return
  }
}

function drawPdfTeacherAnnotations(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion, contentX: number, contentWidth: number) {
  if (model.mode === 'student' || model.mode === 'answer_key') return
  const annotations: Array<[string, string]> = []
  if ('answer' in question && question.answer) annotations.push([model.labels.answer, questionAnswer(question)])
  if ('scoringGuide' in question && question.scoringGuide) annotations.push([model.labels.solution, question.scoringGuide])
  if ('competency' in question && question.competency) annotations.push([model.labels.competency, question.competency.text])
  if ('cognitiveCategory' in question && question.cognitiveCategory) annotations.push([model.labels.cognitiveCategory, question.cognitiveCategory.label])
  if ('rationale' in question && question.rationale) annotations.push([model.labels.rationale, question.rationale])
  annotations.forEach(([label, value]) => drawWrappedPdfText(ctx, `${label}: ${value}`, contentX, contentWidth, { size: 8.1, lineHeight: 9.5, after: 2 }))
}

function drawPdfAnswerKeyQuestion(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion) {
  const contentX = ctx.x + 26; const contentWidth = ctx.width - 26
  ensurePdfSpace(ctx, estimatePdfQuestionHeight(ctx, model, question))
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9.2); ctx.doc.text(`${question.itemNumber}.`, ctx.x, ctx.y)
  drawWrappedPdfText(ctx, `${model.labels.answer}: ${questionAnswer(question)}`, contentX, contentWidth, { size: 9.2, after: 3 })
  if (question.visual) drawPdfVisual(ctx, question, question.visual, contentX)
  if ('scoringGuide' in question && question.scoringGuide) drawWrappedPdfText(ctx, `${model.labels.solution}: ${question.scoringGuide}`, contentX, contentWidth, { size: 8.4, lineHeight: 10, after: 4 })
  ctx.y += PDF_QUESTION_GAP
}

function drawPdfQuestion(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion) {
  if (model.mode === 'answer_key') { drawPdfAnswerKeyQuestion(ctx, model, question); return }
  if (!('prompt' in question)) return
  const contentX = ctx.x + 28; const contentWidth = ctx.width - 28
  const estimated = estimatePdfQuestionHeight(ctx, model, question)
  if (assessmentQuestionKeepTogether(question)) ensurePdfSpace(ctx, Math.min(estimated, ctx.bottom - 60))
  else {
    // Long-response items may continue only in the writing area. Keep the
    // number, stem, visual, subparts, and any structured choices together.
    const coreHeight = estimatePdfQuestionCoreHeight(ctx, question)
    ensurePdfSpace(ctx, Math.min(coreHeight, ctx.bottom - 60))
  }
  drawPdfQuestionHead(ctx, model, question, contentX)
  if (question.visual) drawPdfVisual(ctx, question, question.visual, contentX)
  subpartsFor(question).forEach((part) => drawWrappedPdfText(ctx, `(${part.label}) ${part.prompt} (${part.pointsPossible} ${model.labels.points})`, contentX + 9, contentWidth - 9, { size: 9, lineHeight: 10, after: 2 }))
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') drawPdfChoiceList(ctx, question, contentX, contentWidth)
  if (question.questionType === 'matching') drawPdfMatching(ctx, model, question, contentX, contentWidth)
  drawPdfResponse(ctx, model, question, contentX, contentWidth)
  if (assessmentResponseKind(question) !== 'extended' && 'responseInstructions' in question && question.responseInstructions) drawWrappedPdfText(ctx, question.responseInstructions, contentX, contentWidth, { size: 8.2, after: 3 })
  drawPdfTeacherAnnotations(ctx, model, question, contentX, contentWidth)
  ctx.y += PDF_QUESTION_GAP
}

export function buildAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const doc = new jsPDF({ unit: 'pt', format: pdfFormat(paperSize) })
  const margin = 42
  const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight()
  const ctx: PdfContext = { doc, x: margin, y: 70, width: pageWidth - margin * 2, bottom: pageHeight - margin, pageHeader: () => {} }
  ctx.pageHeader = (initial = false) => pdfHeader(ctx, model, initial)
  pdfHeader(ctx, model, true)
  const showSections = model.mode !== 'answer_key' && assessmentUsesContiguousTypeSections(model.questions)
  let priorType: QuestionType | null = null; let sectionIndex = -1
  model.questions.forEach((question) => {
    if (showSections && question.questionType !== priorType) {
      sectionIndex += 1
      drawPdfSectionHeader(ctx, question.questionType, sectionIndex, estimatePdfQuestionCoreHeight(ctx, question))
      priorType = question.questionType
    }
    drawPdfQuestion(ctx, model, question)
  })
  return doc
}

export function downloadAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') { buildAssessmentPdf(model, paperSize).save(assessmentExportFilename(model, 'pdf')) }

function docxPaperSize(paper: ExportPaperSize = 'a4') { return paper === 'letter' ? { width: 12240, height: 15840 } : paper === 'legal' ? { width: 12240, height: 20160 } : { width: 11906, height: 16838 } }
function docxText(text: string, options: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) { return new TextRun({ text: normalizedText(text), bold: options.bold, italics: options.italics, size: options.size ?? 20, color: options.color ?? TEXT }) }

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

function docxLabelValueCell(label: string, value: string, width = 50) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 75, bottom: 75, left: 105, right: 105 },
    children: [new Paragraph({ children: [docxText(`${label}: `, { bold: true, size: 18 }), docxText(value || '____________________', { size: 18 })] })],
  })
}

function wordScoreLabel(model: AssessmentExportModel) { return model.language === 'filipino' ? 'Iskor' : 'Score' }
function wordRepublicLabel(model: AssessmentExportModel) { return model.language === 'filipino' ? 'Republika ng Pilipinas' : 'Republic of the Philippines' }
function wordDepartmentLabel(model: AssessmentExportModel) { return model.language === 'filipino' ? 'Kagawaran ng Edukasyon' : 'Department of Education' }

function docxIdentityHeader(model: AssessmentExportModel): Paragraph[] {
  const rows = [
    wordRepublicLabel(model),
    wordDepartmentLabel(model),
    model.metadata.region,
    model.metadata.division,
    model.metadata.schoolName,
  ].filter((value) => clean(value))
  return rows.map((value, index) => new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { after: index === rows.length - 1 ? 90 : 20 },
    children: [docxText(value, { bold: index === 1 || index === rows.length - 1, size: index === 1 ? 20 : 17 })],
  }))
}

function docxAssessmentInfoTable(model: AssessmentExportModel) {
  const totalPoints = String(model.metadata.totalPoints ?? model.questions.reduce((sum, question) => sum + question.pointsPossible, 0))
  const totalItems = String(model.metadata.totalItems ?? model.questions.length)
  const rows: TableRow[] = []
  if (model.mode !== 'answer_key') {
    rows.push(new TableRow({ children: [
      docxLabelValueCell(model.labels.learnerName, model.metadata.learnerName || '', 58),
      docxLabelValueCell(model.labels.section, model.metadata.section || '', 42),
    ] }))
  } else {
    rows.push(new TableRow({ children: [
      docxLabelValueCell(model.labels.teacher, model.metadata.teacherName, 58),
      docxLabelValueCell(model.labels.school, model.metadata.schoolName, 42),
    ] }))
  }
  rows.push(new TableRow({ children: [
    docxLabelValueCell(model.labels.gradeLevel, model.metadata.gradeLevel, 50),
    docxLabelValueCell(model.labels.learningArea, model.metadata.learningArea, 50),
  ] }))
  rows.push(new TableRow({ children: [
    docxLabelValueCell(model.labels.gradingTerm, model.metadata.gradingTerm, 50),
    docxLabelValueCell(model.labels.schoolYear, model.metadata.schoolYear, 50),
  ] }))
  rows.push(new TableRow({ children: [
    docxLabelValueCell(model.labels.totalItems, totalItems, 34),
    docxLabelValueCell(model.labels.totalPoints, totalPoints, 33),
    docxLabelValueCell(wordScoreLabel(model), model.mode === 'student' ? `________ / ${totalPoints}` : totalPoints, 33),
  ] }))
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: docxTableBorders(DOCX_LIGHT_BORDER, 4), rows })
}

function docxSectionHeading(text: string) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 90 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 7, color: TEXT, space: 4 } },
    children: [docxText(text, { bold: true, size: 21 })],
  })
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
    const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to rasterize assessment SVG fallback.')) })
    image.src = url
    await loaded
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) return pngFallbackBytes()
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.scale(scale, scale)
    context.drawImage(image, 0, 0, width, height)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    return png ? new Uint8Array(await png.arrayBuffer()) : pngFallbackBytes()
  } catch {
    return pngFallbackBytes()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function docxVisualDimensions(question: AssessmentExportQuestion, visual: AssessmentVisual) {
  const scaleKind = assessmentVisualScale(question)
  const maxWidth = scaleKind === 'cartesian' ? 440 : scaleKind === 'large' ? 390 : 350
  const maxHeight = scaleKind === 'cartesian' ? 285 : scaleKind === 'large' ? 250 : 220
  const scale = Math.min(maxWidth / visual.width, maxHeight / visual.height, 1)
  return { width: Math.max(1, Math.round(visual.width * scale)), height: Math.max(1, Math.round(visual.height * scale)) }
}

async function docxVisualParagraph(question: AssessmentExportQuestion, visual: AssessmentVisual) {
  const svg = assessmentVisualSvgMarkup(visual)
  if (!svg) return new Paragraph({ spacing: { after: 70 }, children: [docxText(`[Diagram unavailable: ${visual.altText}]`, { size: 16, color: MUTED })] })
  const dimensions = docxVisualDimensions(question, visual)
  const fallback = await svgPngFallback(svg, dimensions.width, dimensions.height)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 45, after: 90 },
    children: [new ImageRun({
      type: 'svg',
      data: new TextEncoder().encode(svg),
      fallback: { type: 'png', data: fallback },
      transformation: dimensions,
      altText: { title: 'Assessment diagram', description: visual.altText, name: visual.id },
    })],
  })
}

function docxMatchingTable(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  const prompts = promptsFor(question)
  const choices = choicesFor(question)
  const rows: TableRow[] = [new TableRow({ children: [docxCell(model.labels.columnA, { bold: true, width: 54, align: AlignmentType.CENTER }), docxCell(model.labels.columnB, { bold: true, width: 46, align: AlignmentType.CENTER })] })]
  const count = Math.max(prompts.length, choices.length)
  for (let index = 0; index < count; index += 1) {
    const prompt = prompts[index]
    const choice = choices[index]
    const promptText = prompt ? `_____ ${index + 1}. ${typeof prompt === 'string' ? prompt : prompt.text}` : ' '
    const choiceTextValue = choice ? `${visibleLabel(index)}. ${choiceText(choice)}` : ' '
    rows.push(new TableRow({ children: [docxCell(promptText, { width: 54 }), docxCell(choiceTextValue, { width: 46 })] }))
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: docxTableBorders(DOCX_LIGHT_BORDER, 3), rows })
}

async function docxQuestion(model: AssessmentExportModel, question: AssessmentExportQuestion): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = []
  if (model.mode === 'answer_key') {
    children.push(new Paragraph({ keepNext: Boolean(question.visual), spacing: { before: 70, after: 35 }, children: [docxText(`${question.itemNumber}. ${model.labels.answer}: `, { bold: true, size: 19 }), docxText(questionAnswer(question), { size: 19 })] }))
    if (question.visual) children.push(await docxVisualParagraph(question, question.visual))
    if ('scoringGuide' in question && question.scoringGuide) children.push(new Paragraph({ spacing: { after: 110 }, children: [docxText(`${model.labels.solution}: ${question.scoringGuide}`, { size: 17, color: MUTED })] }))
    return children
  }
  if (!('prompt' in question)) return children
  children.push(new Paragraph({
    keepNext: assessmentQuestionKeepTogether(question),
    keepLines: true,
    spacing: { before: 65, after: 45 },
    children: [docxText(`${question.itemNumber}. `, { bold: true, size: 20 }), docxText(question.prompt, { size: 20 }), ...((model.mode !== 'student' || question.pointsPossible > 1) ? [docxText(` (${question.pointsPossible} ${model.labels.points})`, { size: 16, color: MUTED })] : [])],
  }))
  if (question.visual) children.push(await docxVisualParagraph(question, question.visual))
  subpartsFor(question).forEach((part) => children.push(new Paragraph({ keepNext: true, keepLines: true, spacing: { after: 30 }, children: [docxText(`(${part.label}) ${part.prompt} (${part.pointsPossible} ${model.labels.points})`, { size: 18 })] })))
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') choicesFor(question).forEach((choice, index) => children.push(new Paragraph({ keepNext: index < choicesFor(question).length - 1, spacing: { after: 28 }, indent: { left: 260 }, children: [docxText(`${question.questionType === 'multiple_select' ? '☐ ' : ''}${visibleLabel(index)}. ${choiceText(choice)}`, { size: 18 })] })))
  if (question.questionType === 'matching') children.push(docxMatchingTable(model, question))
  const kind = assessmentResponseKind(question)
  if (kind === 'true_false') children.push(new Paragraph({ spacing: { before: 45, after: 70 }, children: [docxText('☐ True      ☐ False', { size: 18 })] }))
  else if (kind === 'numerical') children.push(new Paragraph({ spacing: { before: 45, after: 70 }, children: [docxText(`${model.labels.answer}: ____________________    ${model.language === 'filipino' ? 'Yunit' : 'Unit'}: __________`, { size: 18 })] }))
  else if (kind === 'single_line') children.push(new Paragraph({ spacing: { before: 45, after: 70 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '777777', space: 2 } }, children: [docxText(' ', { size: 18 })] }))
  else if (kind === 'fill_structured') blanksFor(question).forEach((blank) => children.push(new Paragraph({ spacing: { before: 35, after: 55 }, children: [docxText(`${model.labels.answer} ${blank.label}: ____________________________________`, { size: 18 })] })))
  else if (kind === 'extended') {
    if ('responseInstructions' in question && question.responseInstructions) children.push(new Paragraph({ spacing: { before: 35, after: 50 }, children: [docxText(question.responseInstructions, { size: 17, color: MUTED, italics: true })] }))
    for (let index = 0; index < recommendedAssessmentResponseLines(question); index += 1) children.push(new Paragraph({ spacing: { after: 85 }, border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: '8D939A', space: 2 } }, children: [docxText(' ', { size: 17 })] }))
  }
  if (model.mode !== 'student' && 'answer' in question && question.answer) children.push(new Paragraph({ spacing: { before: 55, after: 25 }, children: [docxText(`${model.labels.answer}: `, { bold: true, size: 17 }), docxText(questionAnswer(question), { size: 17 })] }))
  if (model.mode !== 'student' && 'scoringGuide' in question && question.scoringGuide) children.push(new Paragraph({ spacing: { after: 35 }, children: [docxText(`${model.labels.solution}: ${question.scoringGuide}`, { size: 16, color: MUTED })] }))
  if (model.mode !== 'student' && 'competency' in question && question.competency) children.push(new Paragraph({ spacing: { after: 25 }, children: [docxText(`${model.labels.competency}: `, { bold: true, size: 15, color: MUTED }), docxText(question.competency.text, { size: 15, color: MUTED })] }))
  if (model.mode !== 'student' && 'cognitiveCategory' in question && question.cognitiveCategory) children.push(new Paragraph({ spacing: { after: 25 }, children: [docxText(`${model.labels.cognitiveCategory}: ${question.cognitiveCategory.label}`, { size: 15, color: MUTED })] }))
  if (model.mode !== 'student' && 'rationale' in question && question.rationale) children.push(new Paragraph({ spacing: { after: 80 }, children: [docxText(`${model.labels.rationale}: ${question.rationale}`, { size: 15, color: MUTED })] }))
  return children
}

export async function buildAssessmentDocxBlob(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const children: Array<Paragraph | Table> = [
    ...docxIdentityHeader(model),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 35, after: 35 }, children: [docxText(model.labels.documentTitle, { bold: true, size: 27 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 120 }, children: [docxText(model.title, { bold: true, size: 23 })] }),
    docxAssessmentInfoTable(model),
  ]
  if (model.instructions) {
    children.push(new Paragraph({ keepNext: true, spacing: { before: 170, after: 40 }, children: [docxText(`${model.labels.instructions}:`, { bold: true, size: 19 })] }))
    children.push(new Paragraph({ keepLines: true, spacing: { after: 110 }, children: [docxText(model.instructions, { size: 19 })] }))
  }
  const showSections = model.mode !== 'answer_key' && assessmentUsesContiguousTypeSections(model.questions)
  let priorType: QuestionType | null = null
  let sectionIndex = -1
  for (const question of model.questions) {
    if (showSections && question.questionType !== priorType) {
      sectionIndex += 1
      children.push(docxSectionHeading(assessmentSectionTitle(question.questionType, sectionIndex)))
      priorType = question.questionType
    }
    children.push(...await docxQuestion(model, question))
  }
  const size = docxPaperSize(paperSize)
  const document = new Document({
    creator: model.metadata.teacherName || undefined,
    title: `${model.title}${model.mode === 'answer_key' ? ' - Answer Key' : model.mode === 'teacher' ? ' - Teacher Copy' : ''}`,
    sections: [{ properties: { page: { size, margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  })
  return Packer.toBlob(document)
}

export async function downloadAssessmentDocx(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') { const blob = await buildAssessmentDocxBlob(model, paperSize); downloadBlob(blob, assessmentExportFilename(model, 'docx')) }

function escapeHtml(value: string) { return normalizedText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') }
function printVisualMarkup(visual: AssessmentVisual) { const markup = assessmentVisualSvgMarkup(visual); return markup ? markup.replace('<svg ', '<svg class="assessment-print-visual" ') : '' }

function printQuestionMarkup(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  const pointLabel = model.mode === 'student' && question.pointsPossible <= 1 ? '' : `<small>${question.pointsPossible} ${escapeHtml(model.labels.points)}</small>`
  if (model.mode === 'answer_key') return `<section class="question-flow assessment-question-${question.questionType}"><h3>${question.itemNumber}. ${pointLabel}</h3><div class="answer">${escapeHtml(questionAnswer(question))}</div>${question.visual ? printVisualMarkup(question.visual) : ''}${'scoringGuide' in question && question.scoringGuide ? `<p class="scoring-guide">${escapeHtml(question.scoringGuide)}</p>` : ''}</section>`
  if (!('prompt' in question)) return ''
  const choices = choicesFor(question); const prompts = promptsFor(question); const subparts = subpartsFor(question)
  const choiceMarkup = question.questionType === 'matching'
    ? `<div class="matching-grid"><div><b>${escapeHtml(model.labels.columnA)}</b>${prompts.map((prompt, index) => `<div>_____ ${index + 1}. ${escapeHtml(typeof prompt === 'string' ? prompt : prompt.text)}</div>`).join('')}</div><div><b>${escapeHtml(model.labels.columnB)}</b>${choices.map((choice, index) => `<div>${visibleLabel(index)}. ${escapeHtml(choiceText(choice))}</div>`).join('')}</div></div>`
    : (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') ? `<div class="choice-list">${choices.map((choice, index) => `<div class="choice-row">${escapeHtml(visibleLabel(index))}. ${question.questionType === 'multiple_select' ? '<span class="check-box"></span>' : ''}${escapeHtml(choiceText(choice))}</div>`).join('')}</div>` : ''
  const subpartMarkup = subparts.length ? `<ol type="a" class="subparts">${subparts.map((part) => `<li>${escapeHtml(part.prompt)} <small>(${part.pointsPossible} ${escapeHtml(model.labels.points)})</small></li>`).join('')}</ol>` : ''
  const kind = assessmentResponseKind(question)
  let responseMarkup = ''
  if (kind === 'true_false') responseMarkup = '<div class="true-false"><span class="check-box"></span> True <span class="check-box"></span> False</div>'
  else if (kind === 'numerical') responseMarkup = '<div class="numeric-response">Answer: ____________________ &nbsp;&nbsp; Unit: __________</div>'
  else if (kind === 'single_line') responseMarkup = '<div class="response-lines"><div>______________________________________________</div></div>'
  else if (kind === 'fill_structured') responseMarkup = `<div class="response-lines">${(blanksFor(question).length ? blanksFor(question) : [{ label: 'A' }]).map((blank) => `<div>${escapeHtml(model.labels.answer)} ${escapeHtml(blank.label)}: ____________________________________</div>`).join('')}</div>`
  else if (kind === 'extended') responseMarkup = `<div class="response-lines">${'<div>__________________________________________________________</div>'.repeat(recommendedAssessmentResponseLines(question))}</div>`
  const annotations = [
    kind === 'extended' && 'responseInstructions' in question && question.responseInstructions ? `<p class="annotation">${escapeHtml(question.responseInstructions)}</p>` : '',
    model.mode !== 'student' && 'answer' in question && question.answer ? `<div class="answer">${escapeHtml(questionAnswer(question))}</div>` : '',
    model.mode !== 'student' && 'scoringGuide' in question && question.scoringGuide ? `<p class="scoring-guide">${escapeHtml(question.scoringGuide)}</p>` : '',
    model.mode !== 'student' && 'competency' in question && question.competency ? `<p class="annotation"><b>${escapeHtml(model.labels.competency)}:</b> ${escapeHtml(question.competency.text)}</p>` : '',
    model.mode !== 'student' && 'cognitiveCategory' in question && question.cognitiveCategory ? `<p class="annotation"><b>${escapeHtml(model.labels.cognitiveCategory)}:</b> ${escapeHtml(question.cognitiveCategory.label)}</p>` : '',
    model.mode !== 'student' && 'rationale' in question && question.rationale ? `<p class="annotation"><b>${escapeHtml(model.labels.rationale)}:</b> ${escapeHtml(question.rationale)}</p>` : '',
  ].join('')
  const coreMarkup = `<div class="question-core"><h3>${question.itemNumber}. ${pointLabel}</h3><p>${escapeHtml(question.prompt)}</p>${question.visual ? printVisualMarkup(question.visual) : ''}${subpartMarkup}${choiceMarkup}</div>`
  return `<section class="question-flow assessment-question-${question.questionType}">${coreMarkup}${responseMarkup}${annotations}</section>`
}

export function assessmentPrintHtml(model: AssessmentExportModel) {
  const metadata = textMetadata(model).map(([label, value]) => `<span>${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join('')
  const showSections = model.mode !== 'answer_key' && assessmentUsesContiguousTypeSections(model.questions)
  let priorType: QuestionType | null = null; let sectionIndex = -1
  const questions = model.questions.map((question) => {
    let heading = ''
    if (showSections && question.questionType !== priorType) { sectionIndex += 1; heading = `<h2 class="assessment-section-heading">${escapeHtml(assessmentSectionTitle(question.questionType, sectionIndex))}</h2>`; priorType = question.questionType }
    return `${heading}${printQuestionMarkup(model, question)}`
  }).join('')
  return `<article class="assessment-document assessment-document-${model.mode}"><header><strong>${escapeHtml(model.labels.documentTitle)}</strong><h1>${escapeHtml(model.title)}</h1><div class="metadata">${metadata}</div>${model.instructions ? `<div class="instructions"><b>${escapeHtml(model.labels.instructions)}</b><p>${escapeHtml(model.instructions)}</p></div>` : ''}</header><main>${questions}</main></article>`
}

export function buildAssessmentPrintModel(model: AssessmentExportModel) { return model }
export function printAssessment(model: AssessmentExportModel) {
  const html = assessmentPrintHtml(model); const popup = window.open('', '_blank', 'noopener,noreferrer')
  if (!popup) throw new Error('The browser blocked the print window. Allow popups to print this assessment.')
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(model.title)}</title><style>body{font-family:Arial,sans-serif;margin:24px}.assessment-section-heading{break-after:avoid;margin:20px 0 10px;border-bottom:1px solid #9aa7b4;padding-bottom:5px;font-size:14px}.question-flow{margin:0 0 20px}.question-core{break-inside:avoid}.assessment-question-multiple_choice,.assessment-question-true_false,.assessment-question-short_answer,.assessment-question-identification,.assessment-question-fill_in_the_blank,.assessment-question-numerical_answer,.assessment-question-matching,.assessment-question-multiple_select{break-inside:avoid}.response-lines{color:#666;line-height:1.8}.metadata{display:flex;gap:12px;flex-wrap:wrap}.assessment-print-visual{display:block;width:min(100%,330px);max-height:220px;margin:6px auto 10px;break-inside:avoid}.assessment-question-problem_solving .assessment-print-visual,.assessment-question-constructed_response .assessment-print-visual,.assessment-question-essay .assessment-print-visual{max-width:380px}.matching-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.matching-grid>div{display:grid;gap:4px}.check-box{display:inline-block;width:10px;height:10px;border:1px solid #333;margin:0 5px 0 0;vertical-align:middle}.true-false,.numeric-response{margin:8px 0 10px}.choice-list{display:grid;gap:3px;margin:5px 0 7px;line-height:1.45}.choice-row{padding-left:3px}@media print{.question-flow{orphans:3;widows:3}.assessment-section-heading{break-after:avoid}.assessment-question-constructed_response,.assessment-question-problem_solving,.assessment-question-essay{break-inside:auto}}</style></head><body>${html}</body></html>`)
  popup.document.close(); popup.focus(); popup.print()
}

// Phase 3.7 custom assessment DOCX template hooks remain intentionally
// deterministic: assessment content is rendered from saved structured data.
