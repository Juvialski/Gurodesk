import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { jsPDF } from 'jspdf'
import type { Profile } from '../types/app'
import type { LessonPlanRecord } from '../types/lessonPlan'
import type {
  ExportPaperSize,
  LessonPlanExportModel,
  TeacherExportPreferences,
} from '../types/export'

const TEXT = '000000'
const MUTED = '444444'
const BORDER = '777777'

function clean(value: string | null | undefined) {
  return (value ?? '').trim()
}

function display(value: string | null | undefined, fallback = 'Not specified') {
  return clean(value) || fallback
}

function formatDate(value: string) {
  if (!value) return 'Not specified'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
}

function competencyAndStandards(plan: LessonPlanRecord) {
  const competency = plan.content.competency
  const lines: string[] = []
  const competencyText = clean(competency.text)
  if (competencyText) {
    lines.push(clean(competency.code) ? `${clean(competency.code)}: ${competencyText}` : competencyText)
  }
  const performanceStandard = clean(plan.content.performanceStandard)
  if (performanceStandard) lines.push(`Performance Standard: ${performanceStandard}`)
  return lines.join('\n')
}

export function buildLessonPlanExportModel(
  plan: LessonPlanRecord,
  profile: Profile,
  preferences: TeacherExportPreferences,
): LessonPlanExportModel {
  const content = plan.content
  const signatories = [
    {
      role: 'Prepared by',
      name: clean(preferences.preparedByName) || clean(profile.fullName),
      title: clean(preferences.preparedByTitle) || clean(profile.positionTitle),
    },
    {
      role: 'Reviewed by',
      name: clean(preferences.reviewedByName),
      title: clean(preferences.reviewedByTitle),
    },
    {
      role: 'Noted by',
      name: clean(preferences.notedByName),
      title: clean(preferences.notedByTitle),
    },
  ].filter((item) => item.name || item.role === 'Prepared by')

  return {
    documentTitle: 'ILAW LESSON PLAN',
    templateLabel: 'ILAW Standard',
    status: plan.status,
    identity: {
      teacherName: display(profile.fullName),
      positionTitle: display(profile.positionTitle),
      schoolName: display(profile.schoolName),
      region: display(profile.region),
      division: display(profile.division),
    },
    lesson: {
      title: display(content.lessonTitle),
      schoolYear: display(content.schoolYear),
      gradeLevel: display(content.gradeLevel),
      learningArea: display(content.learningArea),
      sections: content.sections.length ? content.sections.join(', ') : 'Not specified',
      curriculumPeriod: display(content.curriculumPeriodLabel),
      gradingTerm: display(content.gradingTermLabel),
      lessonDate: formatDate(content.lessonDate),
      weekLabel: display(content.weekLabel),
      sessions: `${content.numberOfSessions || 1}`,
      duration: `${content.durationMinutes || 60} minutes per session`,
    },
    ilaw: {
      intentions: [
        { key: 'competency-standards', heading: 'Learning Competency and Curriculum Standards', body: competencyAndStandards(plan) },
        { key: 'learning-objectives', heading: 'Learning Objectives', body: clean(content.intentions.learningObjectives) },
        { key: 'learner-context', heading: 'Learner Context', body: clean(content.learnerContext) },
      ],
      learningExperience: [
        { key: 'pre-lesson', heading: 'Pre-Lesson', body: clean(content.learningExperience.preLessonActivity) },
        { key: 'lesson-flow', heading: 'Lesson Flow', body: clean(content.learningExperience.lessonFlow) },
        { key: 'resources', heading: 'Learning Resources', body: clean(content.learningExperience.resources) },
        { key: 'contextualization', heading: 'Opportunities for Integration and Contextualization', body: clean(content.learningExperience.integrationContextualization) },
        { key: 'inclusion', heading: 'Inclusion and Accommodations', body: clean(content.learningExperience.inclusionAccommodations) },
        { key: 'home-alternative', heading: 'Learning Continuity / Home-Based Alternative', body: clean(content.learningExperience.homeBasedAlternative) },
      ],
      assessingLearning: [
        { key: 'formative', heading: 'Formative Assessment', body: clean(content.assessingLearning.formativeAssessments) },
        { key: 'evidence', heading: 'Evidence of Learning', body: clean(content.assessingLearning.evidenceOfLearning) },
      ],
      waysForward: [
        { key: 'extended', heading: 'Extended Learning Opportunities', body: clean(content.waysForward.extendedLearning) },
        { key: 'next-steps', heading: 'Next Steps / Intervention', body: clean(content.waysForward.nextSteps) },
        { key: 'reflection', heading: 'Reflection', body: clean(content.waysForward.reflection) },
      ],
    },
    references: clean(content.references),
    signatories,
  }
}

function safeFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'lesson-plan'
}

export function lessonPlanExportFilename(model: LessonPlanExportModel, extension: 'pdf' | 'docx') {
  const stem = `${model.lesson.gradeLevel} ${model.lesson.learningArea} - ${model.lesson.title}`
  return `${safeFilename(stem)}.${extension}`
}

function saveBlob(blob: Blob, filename: string) {
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

function docxPaperSize(paper: ExportPaperSize) {
  if (paper === 'letter') return { width: 12240, height: 15840 }
  if (paper === 'legal') return { width: 12240, height: 20160 }
  return { width: 11906, height: 16838 }
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
  }
}

function infoCell(label: string, value: string) {
  const lines = value.split(/\r?\n/)
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [
      new Paragraph({
        spacing: { after: 35 },
        children: [new TextRun({ text: label, bold: true, size: 17, color: TEXT })],
      }),
      ...lines.map((line) => new Paragraph({ children: [new TextRun({ text: line || ' ', size: 20, color: TEXT })] })),
    ],
  })
}

function docxSectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 260, after: 100 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 8, color: TEXT, space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: TEXT, space: 4 },
    },
    children: [new TextRun({ text, bold: true, color: TEXT, size: 23 })],
  })
}

function docxField(label: string, body: string) {
  if (!clean(body)) return []
  const lines = body.split(/\r?\n/)
  return [
    new Paragraph({
      spacing: { before: 120, after: 45 },
      children: [new TextRun({ text: label, bold: true, color: TEXT, size: 20 })],
    }),
    ...lines.map((line) => new Paragraph({
      spacing: { after: 55 },
      children: [new TextRun({ text: line || ' ', size: 20, color: TEXT })],
    })),
  ]
}

export async function downloadLessonPlanDocx(
  model: LessonPlanExportModel,
  preferences: TeacherExportPreferences,
) {
  const paper = docxPaperSize(preferences.paperSize)
  const gradeAndSection = `${model.lesson.gradeLevel}${model.lesson.sections && model.lesson.sections !== 'Not specified' ? ` - ${model.lesson.sections}` : ''}`
  const sessionSummary = `${model.lesson.sessions} session(s), ${model.lesson.duration}`
  const schedule = [model.lesson.lessonDate, model.lesson.weekLabel].filter((value) => value && value !== 'Not specified').join(' - ') || 'Not specified'

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: 'Republic of the Philippines', size: 18, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [new TextRun({ text: 'Department of Education', bold: true, size: 20, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 25 },
      children: [new TextRun({ text: model.identity.region, size: 17, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 25 },
      children: [new TextRun({ text: model.identity.division, size: 17, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: model.identity.schoolName, bold: true, size: 18, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [new TextRun({ text: model.documentTitle, bold: true, size: 28, color: TEXT })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: [
        new TableRow({ children: [infoCell('Lesson Title', model.lesson.title), infoCell('Learning Area/s', model.lesson.learningArea)] }),
        new TableRow({ children: [infoCell('Name of Teacher/s', model.identity.teacherName), infoCell('Grade Level and Section', gradeAndSection)] }),
        new TableRow({ children: [infoCell('No. of Sessions', sessionSummary), infoCell('Date / Week', schedule)] }),
        new TableRow({ children: [infoCell('School Year', model.lesson.schoolYear), infoCell('Term / Curriculum Period', `${model.lesson.gradingTerm} / ${model.lesson.curriculumPeriod}`)] }),
        new TableRow({ children: [infoCell('References', model.references || 'Not specified'), infoCell('Teacher Position', model.identity.positionTitle)] }),
      ],
    }),
    docxSectionHeading('I. INTENTIONS'),
    ...model.ilaw.intentions.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading('L. LEARNING EXPERIENCE'),
    ...model.ilaw.learningExperience.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading('A. ASSESSING LEARNING'),
    ...model.ilaw.assessingLearning.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading('W. WAYS FORWARD'),
    ...model.ilaw.waysForward.flatMap((item) => docxField(item.heading, item.body)),
  ]

  if (model.signatories.length) {
    children.push(docxSectionHeading('SIGNATURES'))
    for (const item of model.signatories) {
      children.push(
        new Paragraph({ spacing: { before: 230, after: 25 }, children: [new TextRun({ text: item.role, size: 18, color: MUTED })] }),
        new Paragraph({ spacing: { after: 25 }, children: [new TextRun({ text: item.name || '____________________________', bold: true, size: 20, color: TEXT })] }),
        new Paragraph({ spacing: { after: 75 }, children: [new TextRun({ text: item.title || ' ', size: 18, color: MUTED })] }),
      )
    }
  }

  const document = new Document({
    creator: model.identity.teacherName,
    title: `${model.lesson.title} - ILAW Lesson Plan`,
    description: 'ILAW lesson plan',
    sections: [{
      properties: {
        page: {
          size: paper,
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(document)
  saveBlob(blob, lessonPlanExportFilename(model, 'docx'))
}

function pdfFormat(paper: ExportPaperSize): 'a4' | 'letter' | 'legal' {
  return paper
}

type PdfContext = {
  doc: jsPDF
  x: number
  y: number
  width: number
  bottom: number
}

function pdfEnsure(ctx: PdfContext, needed = 48) {
  if (ctx.y + needed <= ctx.bottom) return
  ctx.doc.addPage()
  ctx.y = 54
}

function pdfText(ctx: PdfContext, text: string, options?: { bold?: boolean; size?: number; color?: [number, number, number]; indent?: number; gapAfter?: number }) {
  if (!clean(text)) return
  const size = options?.size ?? 10
  const indent = options?.indent ?? 0
  const gapAfter = options?.gapAfter ?? 7
  ctx.doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  ctx.doc.setFontSize(size)
  const color = options?.color ?? [0, 0, 0]
  ctx.doc.setTextColor(color[0], color[1], color[2])
  const lines = ctx.doc.splitTextToSize(text, ctx.width - indent) as string[]
  const lineHeight = size * 1.35
  for (const line of lines) {
    if (ctx.y + lineHeight > ctx.bottom) {
      ctx.doc.addPage()
      ctx.y = 54
    }
    ctx.doc.text(line, ctx.x + indent, ctx.y)
    ctx.y += lineHeight
  }
  ctx.y += gapAfter
}

function pdfSection(ctx: PdfContext, title: string) {
  pdfEnsure(ctx, 38)
  ctx.doc.setDrawColor(0, 0, 0)
  ctx.doc.setLineWidth(0.8)
  ctx.doc.line(ctx.x, ctx.y - 7, ctx.x + ctx.width, ctx.y - 7)
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(11)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(title, ctx.x, ctx.y + 7)
  ctx.y += 16
  ctx.doc.line(ctx.x, ctx.y, ctx.x + ctx.width, ctx.y)
  ctx.y += 12
}

function pdfLabelBody(ctx: PdfContext, label: string, body: string) {
  if (!clean(body)) return
  pdfText(ctx, label, { bold: true, size: 9.5, color: [0, 0, 0], gapAfter: 3 })
  pdfText(ctx, body, { size: 9.5, color: [0, 0, 0], gapAfter: 9 })
}

function pdfInfoRow(ctx: PdfContext, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
  const colWidth = ctx.width / 2
  const labelWidth = 82
  const pad = 6
  const leftLines = ctx.doc.splitTextToSize(leftValue, colWidth - labelWidth - pad * 2) as string[]
  const rightLines = ctx.doc.splitTextToSize(rightValue, colWidth - labelWidth - pad * 2) as string[]
  const rowHeight = Math.max(27, Math.max(leftLines.length, rightLines.length) * 11 + 10)
  pdfEnsure(ctx, rowHeight + 2)
  const top = ctx.y - 11
  ctx.doc.setDrawColor(90, 90, 90)
  ctx.doc.setLineWidth(0.45)
  ctx.doc.rect(ctx.x, top, ctx.width, rowHeight)
  ctx.doc.line(ctx.x + colWidth, top, ctx.x + colWidth, top + rowHeight)
  ctx.doc.setFillColor(242, 242, 242)
  ctx.doc.rect(ctx.x, top, labelWidth, rowHeight, 'F')
  ctx.doc.rect(ctx.x + colWidth, top, labelWidth, rowHeight, 'F')
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(8.2)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(leftLabel, ctx.x + pad, ctx.y + 3)
  ctx.doc.text(rightLabel, ctx.x + colWidth + pad, ctx.y + 3)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(8.6)
  ctx.doc.text(leftLines, ctx.x + labelWidth + pad, ctx.y + 3)
  ctx.doc.text(rightLines, ctx.x + colWidth + labelWidth + pad, ctx.y + 3)
  ctx.y = top + rowHeight + 11
}

function pdfWideRow(ctx: PdfContext, label: string, value: string) {
  const labelWidth = 82
  const pad = 6
  const lines = ctx.doc.splitTextToSize(value, ctx.width - labelWidth - pad * 2) as string[]
  const rowHeight = Math.max(28, lines.length * 11 + 10)
  pdfEnsure(ctx, rowHeight + 2)
  const top = ctx.y - 11
  ctx.doc.setDrawColor(90, 90, 90)
  ctx.doc.setLineWidth(0.45)
  ctx.doc.rect(ctx.x, top, ctx.width, rowHeight)
  ctx.doc.setFillColor(242, 242, 242)
  ctx.doc.rect(ctx.x, top, labelWidth, rowHeight, 'F')
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(8.2)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(label, ctx.x + pad, ctx.y + 3)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(8.6)
  ctx.doc.text(lines, ctx.x + labelWidth + pad, ctx.y + 3)
  ctx.y = top + rowHeight + 11
}

export function downloadLessonPlanPdf(
  model: LessonPlanExportModel,
  preferences: TeacherExportPreferences,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: pdfFormat(preferences.paperSize), compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const ctx: PdfContext = { doc, x: margin, y: 54, width: pageWidth - margin * 2, bottom: pageHeight - 54 }
  const gradeAndSection = `${model.lesson.gradeLevel}${model.lesson.sections && model.lesson.sections !== 'Not specified' ? ` - ${model.lesson.sections}` : ''}`
  const sessionSummary = `${model.lesson.sessions} session(s), ${model.lesson.duration}`
  const schedule = [model.lesson.lessonDate, model.lesson.weekLabel].filter((value) => value && value !== 'Not specified').join(' - ') || 'Not specified'

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text('Republic of the Philippines', pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Department of Education', pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 13
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(model.identity.region, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 12
  doc.text(model.identity.division, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 12
  doc.setFont('helvetica', 'bold')
  doc.text(model.identity.schoolName, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(model.documentTitle, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 24

  pdfInfoRow(ctx, 'Lesson Title', model.lesson.title, 'Learning Area/s', model.lesson.learningArea)
  pdfInfoRow(ctx, 'Name of Teacher/s', model.identity.teacherName, 'Grade Level and Section', gradeAndSection)
  pdfInfoRow(ctx, 'No. of Sessions', sessionSummary, 'Date / Week', schedule)
  pdfInfoRow(ctx, 'School Year', model.lesson.schoolYear, 'Term / Curriculum Period', `${model.lesson.gradingTerm} / ${model.lesson.curriculumPeriod}`)
  pdfWideRow(ctx, 'References', model.references || 'Not specified')
  ctx.y += 7

  const groups: Array<[string, LessonPlanExportModel['ilaw'][keyof LessonPlanExportModel['ilaw']]]> = [
    ['I. INTENTIONS', model.ilaw.intentions],
    ['L. LEARNING EXPERIENCE', model.ilaw.learningExperience],
    ['A. ASSESSING LEARNING', model.ilaw.assessingLearning],
    ['W. WAYS FORWARD', model.ilaw.waysForward],
  ]
  for (const [heading, fields] of groups) {
    pdfSection(ctx, heading)
    for (const field of fields) pdfLabelBody(ctx, field.heading, field.body)
  }

  if (model.signatories.length) {
    pdfSection(ctx, 'SIGNATURES')
    for (const item of model.signatories) {
      pdfText(ctx, item.role, { size: 8.5, color: [70, 70, 70], gapAfter: 2 })
      pdfText(ctx, item.name || '____________________________', { bold: true, size: 10, gapAfter: 2 })
      pdfText(ctx, item.title, { size: 8.5, color: [70, 70, 70], gapAfter: 12 })
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 22, { align: 'right' })
  }

  doc.save(lessonPlanExportFilename(model, 'pdf'))
}
