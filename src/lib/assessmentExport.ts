import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'
import { jsPDF } from 'jspdf'
import type { AssessmentAnswer } from '../types/assessment'
import type { AssessmentExportModel, AssessmentExportQuestion, AssessmentExportQuestionBase, AssessmentStudentExportQuestion } from '../types/assessmentExport'
import type { ExportPaperSize } from '../types/export'
import { downloadBlob } from './docxTemplate'

const TEXT = '000000'
const MUTED = '555555'

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

export function assessmentExportFilename(model: AssessmentExportModel, extension: 'pdf' | 'docx') {
  const suffix = model.mode === 'answer_key' ? ' - Answer Key' : model.mode === 'teacher' ? ' - Teacher Copy' : ''
  return `${safeFilename(`${model.metadata.gradeLevel ?? ''} ${model.metadata.learningArea ?? ''} - ${model.title}${suffix}`)}.${extension}`
}

function choiceVisibleLabel(index: number) { return String.fromCharCode(65 + index) }

function answerText(answer: AssessmentAnswer) {
  const value = answer as unknown as Record<string, unknown>
  if (answer.type === 'multiple_choice') {
    const choices = array(value.choices).map(object)
    const index = choices.findIndex((choice) => String(choice.id) === answer.choiceId)
    const choice = choices[index]
    return choice ? `${choiceVisibleLabel(index)}. ${String(choice.text ?? '')}` : 'Review choice mapping'
  }
  if (answer.type === 'true_false') return answer.value ? 'True' : 'False'
  if (answer.type === 'short_answer' || answer.type === 'identification') return array(value.acceptedAnswers).map(String).join(' / ')
  if (answer.type === 'fill_in_the_blank') return array(value.blanks).map((blank, index) => { const entry = object(blank); const points = Number(entry.pointsPossible); return `${String.fromCharCode(65 + index)}. ${array(entry.acceptedAnswers).map(String).join(' / ')}${Number.isFinite(points) ? ` — ${points} pt${points === 1 ? '' : 's'}` : ''}` }).join(' · ')
  if (answer.type === 'numerical_answer') return `${String(value.value ?? '')}${value.unit ? ` ${String(value.unit)}` : ''}${value.tolerance !== undefined ? ` (±${String(value.tolerance)})` : ''}`
  if (answer.type === 'problem_solving') return String(value.finalAnswer ?? '')
  if (answer.type === 'matching') {
    const prompts = array(value.prompts).map(object)
    const choices = array(value.choices).map(object)
    return array(value.mappings).map((mapping) => {
      const pair = object(mapping)
      const p = prompts.findIndex((entry) => String(entry.id) === String(pair.promptId))
      const c = choices.findIndex((entry) => String(entry.id) === String(pair.choiceId))
      const points = Number(pair.pointsPossible)
      return `${p >= 0 ? p + 1 : String(pair.promptId)} → ${c >= 0 ? choiceVisibleLabel(c) : String(pair.choiceId)}${Number.isFinite(points) ? ` — ${points} pt${points === 1 ? '' : 's'}` : ''}`
    }).join(', ')
  }
  if (answer.type === 'multiple_select') {
    const choices = array(value.choices).map(object)
    return array(value.choiceIds).map((id) => choiceVisibleLabel(choices.findIndex((choice) => String(choice.id) === String(id)))).filter((label) => label !== '@').join(', ')
  }
  if (answer.type === 'constructed_response') return String(value.expectedResponse ?? '')
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

function questionLabel(model: AssessmentExportModel, question: AssessmentExportQuestion) { return model.mode === 'student' && question.pointsPossible <= 1 ? `${question.itemNumber}.` : `${question.itemNumber}. (${question.pointsPossible} ${model.labels.points})` }

function choicesFor(question: AssessmentExportQuestion) { return 'choices' in question && Array.isArray(question.choices) ? question.choices : [] }
function promptsFor(question: AssessmentExportQuestion) { return 'prompts' in question && Array.isArray(question.prompts) ? question.prompts : [] }
function subpartsFor(question: AssessmentExportQuestion) { return 'subparts' in question && Array.isArray(question.subparts) ? question.subparts : [] }

function renderQuestionLines(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  if (model.mode === 'answer_key') {
    const lines = [questionLabel(model, question), `${model.labels.answer}: ${questionAnswer(question)}`]
    if ('scoringGuide' in question && question.scoringGuide) lines.push(`${model.labels.solution}: ${question.scoringGuide}`)
    return lines
  }
  if (!('prompt' in question)) return []
  const lines: string[] = [questionLabel(model, question), question.prompt]
  subpartsFor(question).forEach((part) => lines.push(`  (${part.label}) ${part.prompt} (${part.pointsPossible} ${model.labels.points})`))
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') choicesFor(question).forEach((choice, index) => lines.push(`  ${choiceVisibleLabel(index)}. ${typeof choice === 'string' ? choice : choice.text}`))
  if (question.questionType === 'matching') {
    if (promptsFor(question).length) lines.push(`${model.labels.columnA}:`)
    promptsFor(question).forEach((prompt, index) => lines.push(`  _____ ${index + 1}. ${typeof prompt === 'string' ? prompt : prompt.text}`))
    if (choicesFor(question).length) lines.push(`${model.labels.columnB}: ${choicesFor(question).map((choice, index) => `${choiceVisibleLabel(index)}. ${typeof choice === 'string' ? choice : choice.text}`).join('  ')}`)
  }
  const space = question.answerSpaceLines
  for (let index = 0; index < space; index += 1) lines.push(`${model.labels.responseLine}: ______________________________________________`)
  if ('responseInstructions' in question && question.responseInstructions) lines.push(question.responseInstructions)
  if ('answer' in question && question.answer) lines.push(`${model.labels.answer}: ${questionAnswer(question)}`)
  if ('scoringGuide' in question && question.scoringGuide) lines.push(`${model.labels.solution}: ${question.scoringGuide}`)
  if ('competency' in question && question.competency) lines.push(`${model.labels.competency}: ${question.competency.text}`)
  if ('cognitiveCategory' in question && question.cognitiveCategory) lines.push(`${model.labels.cognitiveCategory}: ${question.cognitiveCategory.label}`)
  if ('rationale' in question && question.rationale) lines.push(`${model.labels.rationale}: ${question.rationale}`)
  return lines
}

function pdfFormat(paper: ExportPaperSize = 'a4'): 'a4' | 'letter' | 'legal' { return paper }
type PdfContext = { doc: jsPDF; x: number; y: number; width: number; bottom: number; pageHeader: (initial?: boolean) => void }

function pdfHeader(ctx: PdfContext, model: AssessmentExportModel, initial = true) {
  const { doc, x, width } = ctx
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(initial ? 15 : 10); doc.text(initial ? model.labels.documentTitle : `${model.labels.documentTitle} — continued`, x + width / 2, initial ? 34 : 32, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(initial ? 12 : 8); doc.text(model.title, x + width / 2, initial ? 52 : 47, { align: 'center' })
  ctx.y = initial ? 70 : 66
  if (initial) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    textMetadata(model).forEach(([label, value], index) => {
      const row = index % 2 === 0 ? Math.floor(index / 2) : Math.floor(index / 2)
      const col = index % 2
      doc.text(`${label}: ${value}`, x + col * (width / 2), ctx.y + row * 12)
      if (col === 1 || index === textMetadata(model).length - 1) ctx.y += 12
    })
    if (model.instructions) { ctx.y += 8; doc.setFont('helvetica', 'bold'); doc.text(model.labels.instructions, x, ctx.y); ctx.y += 12; doc.setFont('helvetica', 'normal'); (doc.splitTextToSize(model.instructions, width) as string[]).forEach((line: string) => { doc.text(line, x, ctx.y); ctx.y += 10 }) }
  }
}

function newPdfPage(ctx: PdfContext) { ctx.doc.addPage(); ctx.pageHeader(false) }
function drawPdfLines(ctx: PdfContext, lines: string[], size = 9.5, gapAfter = 8) {
  ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(size); ctx.doc.setTextColor(0, 0, 0)
  lines.forEach((line) => { const wrapped = ctx.doc.splitTextToSize(line, ctx.width) as string[]; wrapped.forEach((part) => { if (ctx.y + 12 > ctx.bottom) newPdfPage(ctx); ctx.doc.text(part, ctx.x, ctx.y); ctx.y += 11 }); ctx.y += 1 })
  ctx.y += gapAfter
}

function drawPdfQuestion(ctx: PdfContext, model: AssessmentExportModel, question: AssessmentExportQuestion) { drawPdfLines(ctx, renderQuestionLines(model, question), 9.5, 5) }

export function buildAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const doc = new jsPDF({ unit: 'pt', format: pdfFormat(paperSize) })
  const margin = 42
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const ctx: PdfContext = { doc, x: margin, y: 70, width: pageWidth - margin * 2, bottom: pageHeight - margin, pageHeader: () => {} }
  ctx.pageHeader = (initial = false) => pdfHeader(ctx, model, initial)
  pdfHeader(ctx, model, true)
  model.questions.forEach((question) => drawPdfQuestion(ctx, model, question))
  return doc
}

export function downloadAssessmentPdf(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') { buildAssessmentPdf(model, paperSize).save(assessmentExportFilename(model, 'pdf')) }

function docxPaperSize(paper: ExportPaperSize = 'a4') { return paper === 'letter' ? { width: 12240, height: 15840 } : paper === 'legal' ? { width: 12240, height: 20160 } : { width: 11906, height: 16838 } }
function docxText(text: string, options: { bold?: boolean; size?: number; color?: string } = {}) { return new TextRun({ text, bold: options.bold, size: options.size ?? 20, color: options.color ?? TEXT }) }
function docxQuestion(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  const lines = renderQuestionLines(model, question)
  return lines.map((line, index) => new Paragraph({ keepLines: true, keepNext: index < lines.length - 1, spacing: { after: index === 0 ? 45 : 70 }, children: [docxText(line, { bold: index === 0, size: index === 0 ? 20 : 18, color: index === 0 ? TEXT : MUTED })] }))
}

export async function buildAssessmentDocxBlob(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') {
  const children: Paragraph[] = [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [docxText(model.labels.documentTitle, { bold: true, size: 28 })] }), new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [docxText(model.title, { bold: true, size: 24 })] })]
  textMetadata(model).forEach(([label, value]) => children.push(new Paragraph({ keepNext: true, spacing: { after: 30 }, children: [docxText(`${label}: `, { bold: true, size: 18 }), docxText(value, { size: 18 })] })))
  if (model.instructions) { children.push(new Paragraph({ keepNext: true, spacing: { before: 180, after: 45 }, children: [docxText(model.labels.instructions, { bold: true, size: 20 })] })); children.push(new Paragraph({ keepLines: true, keepNext: true, spacing: { after: 100 }, children: [docxText(model.instructions, { size: 20 })] })) }
  model.questions.forEach((question) => children.push(...docxQuestion(model, question)))
  const size = docxPaperSize(paperSize)
  const document = new Document({ sections: [{ properties: { page: { size } }, children }] })
  return Packer.toBlob(document)
}

export async function downloadAssessmentDocx(model: AssessmentExportModel, paperSize: ExportPaperSize = 'a4') { const blob = await buildAssessmentDocxBlob(model, paperSize); downloadBlob(blob, assessmentExportFilename(model, 'docx')) }

function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') }

function printQuestionMarkup(model: AssessmentExportModel, question: AssessmentExportQuestion) {
  const pointLabel = model.mode === 'student' && question.pointsPossible <= 1 ? '' : `<small>${question.pointsPossible} ${escapeHtml(model.labels.points)}</small>`
  if (model.mode === 'answer_key') {
    return `<section class="question-flow assessment-question-${question.questionType}"><h3>${question.itemNumber}. ${pointLabel}</h3><div class="answer">${escapeHtml(questionAnswer(question))}</div>${'scoringGuide' in question && question.scoringGuide ? `<p class="scoring-guide">${escapeHtml(question.scoringGuide)}</p>` : ''}</section>`
  }
  if (!('prompt' in question)) return ''
  const choices = choicesFor(question)
  const prompts = promptsFor(question)
  const subparts = subpartsFor(question)
  const choiceMarkup = question.questionType === 'matching'
    ? `<div class="matching"><b>${escapeHtml(model.labels.columnA)}</b>${prompts.map((prompt, index) => `<div>_____ ${index + 1}. ${escapeHtml(typeof prompt === 'string' ? prompt : prompt.text)}</div>`).join('')}<b>${escapeHtml(model.labels.columnB)}</b>${choices.map((choice, index) => `<div>${choiceVisibleLabel(index)}. ${escapeHtml(typeof choice === 'string' ? choice : choice.text)}</div>`).join('')}</div>`
    : choices.length ? `<ol type="A">${choices.map((choice: string | { text: string }) => `<li>${escapeHtml(typeof choice === 'string' ? choice : choice.text)}</li>`).join('')}</ol>` : ''
  const subpartMarkup = subparts.length ? `<ol type="a" class="subparts">${subparts.map((part) => `<li>${escapeHtml(part.prompt)} <small>(${part.pointsPossible} ${escapeHtml(model.labels.points)})</small></li>`).join('')}</ol>` : ''
  const blankMarkup = question.questionType === 'fill_in_the_blank' && 'blanks' in question && question.blanks?.length ? `<div class="blank-labels">${question.blanks.map((blank) => `<span>${escapeHtml(blank.label)}.</span>`).join(' ')}</div>` : ''
  const annotations = [
    'responseInstructions' in question && question.responseInstructions ? `<p class="annotation"><b>${escapeHtml(model.labels.instructions)}:</b> ${escapeHtml(question.responseInstructions)}</p>` : '',
    model.mode !== 'student' && 'answer' in question && question.answer ? `<div class="answer">${escapeHtml(questionAnswer(question))}</div>` : '',
    model.mode !== 'student' && 'scoringGuide' in question && question.scoringGuide ? `<p class="scoring-guide">${escapeHtml(question.scoringGuide)}</p>` : '',
    model.mode !== 'student' && 'competency' in question && question.competency ? `<p class="annotation"><b>${escapeHtml(model.labels.competency)}:</b> ${escapeHtml(question.competency.text)}</p>` : '',
    model.mode !== 'student' && 'cognitiveCategory' in question && question.cognitiveCategory ? `<p class="annotation"><b>${escapeHtml(model.labels.cognitiveCategory)}:</b> ${escapeHtml(question.cognitiveCategory.label)}</p>` : '',
    model.mode !== 'student' && 'rationale' in question && question.rationale ? `<p class="annotation"><b>${escapeHtml(model.labels.rationale)}:</b> ${escapeHtml(question.rationale)}</p>` : '',
  ].join('')
  return `<section class="question-flow assessment-question-${question.questionType}"><h3>${question.itemNumber}. ${pointLabel}</h3><p>${escapeHtml(question.prompt)}</p>${subpartMarkup}${choiceMarkup}${blankMarkup}<div class="response-space">${'<div>________________________________________</div>'.repeat(Math.max(0, question.answerSpaceLines))}</div>${annotations}</section>`
}

export function assessmentPrintHtml(model: AssessmentExportModel) {
  const metadata = textMetadata(model).map(([label, value]) => `<span>${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join('')
  const questions = model.questions.map((question) => printQuestionMarkup(model, question)).join('')
  return `<article class="assessment-document assessment-document-${model.mode}"><header><strong>${escapeHtml(model.labels.documentTitle)}</strong><h1>${escapeHtml(model.title)}</h1><div class="metadata">${metadata}</div>${model.instructions ? `<div class="instructions"><b>${escapeHtml(model.labels.instructions)}</b><p>${escapeHtml(model.instructions)}</p></div>` : ''}</header><main>${questions}</main></article>`
}

export function buildAssessmentPrintModel(model: AssessmentExportModel) { return model }
export function printAssessment(model: AssessmentExportModel) { const html = assessmentPrintHtml(model); const popup = window.open('', '_blank', 'noopener,noreferrer'); if (!popup) throw new Error('The browser blocked the print window. Allow popups to print this assessment.'); popup.document.write(`<!doctype html><html><head><title>${escapeHtml(model.title)}</title><style>body{font-family:Arial,sans-serif;margin:24px}.question-flow{break-inside:avoid;margin:0 0 20px}.response-space{color:#666;line-height:1.8}.metadata{display:flex;gap:12px;flex-wrap:wrap}</style></head><body>${html}</body></html>`); popup.document.close(); popup.focus(); popup.print() }

// Phase 3.7 custom assessment DOCX template hooks remain intentionally
// deterministic: assessment content is rendered from saved structured data.
