import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
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

const NAVY = '17365D'
const BLUE = 'DCE6F1'
const BORDER = 'B8C5D6'
const MUTED = '5B6574'

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

function sourceLabel(plan: LessonPlanRecord, include: boolean) {
  if (!include) return ''
  const source = clean(plan.content.competency.sourceTitle)
  const page = plan.content.competency.sourcePage
  if (!source && !page) return ''
  return [source, page ? `p. ${page}` : ''].filter(Boolean).join(' - ')
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
    documentTitle: 'ILAW Lesson Plan',
    templateLabel: 'GuroDesk ILAW Standard',
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
    competency: {
      label: clean(content.competency.code) || 'Verified competency',
      text: display(content.competency.text),
      performanceStandard: clean(content.performanceStandard),
      source: sourceLabel(plan, preferences.includeSourceProvenance),
    },
    ilaw: {
      intentions: [
        { key: 'learner-context', heading: 'Learner context / readiness', body: clean(content.learnerContext) },
        { key: 'learning-objectives', heading: 'Learning objectives', body: clean(content.intentions.learningObjectives) },
      ],
      learningExperience: [
        { key: 'resources', heading: 'Learning resources', body: clean(content.learningExperience.resources) },
        { key: 'home-alternative', heading: 'Home-based / Hinay alternative', body: clean(content.learningExperience.homeBasedAlternative) },
        { key: 'pre-lesson', heading: 'Pre-lesson activity', body: clean(content.learningExperience.preLessonActivity) },
        { key: 'lesson-flow', heading: 'Lesson flow', body: clean(content.learningExperience.lessonFlow) },
        { key: 'contextualization', heading: 'Integration & contextualization', body: clean(content.learningExperience.integrationContextualization) },
        { key: 'inclusion', heading: 'Inclusion / accommodations', body: clean(content.learningExperience.inclusionAccommodations) },
      ],
      assessingLearning: [
        { key: 'formative', heading: 'Formative assessments', body: clean(content.assessingLearning.formativeAssessments) },
        { key: 'evidence', heading: 'Evidence of learning', body: clean(content.assessingLearning.evidenceOfLearning) },
      ],
      waysForward: [
        { key: 'reflection', heading: 'Reflection', body: clean(content.waysForward.reflection) },
        { key: 'next-steps', heading: 'Next steps / intervention', body: clean(content.waysForward.nextSteps) },
        { key: 'extended', heading: 'Extended learning opportunities', body: clean(content.waysForward.extendedLearning) },
      ],
    },
    references: clean(content.references),
    signatories,
    aiDeclaration: preferences.includeAiDeclaration && content.aiDeclaration.used
      ? clean(content.aiDeclaration.statement)
      : '',
    generatedAt: new Date().toISOString(),
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
    top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  }
}

function cell(label: string, value: string) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 16, color: MUTED })],
      }),
      new Paragraph({ children: [new TextRun({ text: value, size: 20, color: '1F2937' })] }),
    ],
  })
}

function docxSectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 5 } },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 25 })],
  })
}

function docxField(label: string, body: string) {
  if (!clean(body)) return []
  const lines = body.split(/\r?\n/)
  return [
    new Paragraph({
      spacing: { before: 130, after: 55 },
      children: [new TextRun({ text: label, bold: true, color: NAVY, size: 20 })],
    }),
    ...lines.map((line) => new Paragraph({
      spacing: { after: 65 },
      children: [new TextRun({ text: line || ' ', size: 20, color: '202938' })],
    })),
  ]
}

export async function downloadLessonPlanDocx(
  model: LessonPlanExportModel,
  preferences: TeacherExportPreferences,
) {
  const paper = docxPaperSize(preferences.paperSize)
  const metadataRows = [
    ['School', model.identity.schoolName, 'School Year', model.lesson.schoolYear],
    ['Teacher', model.identity.teacherName, 'Grade Level', model.lesson.gradeLevel],
    ['Learning Area', model.lesson.learningArea, 'Sections', model.lesson.sections],
    ['Lesson Date', model.lesson.lessonDate, 'Week / Schedule', model.lesson.weekLabel],
    ['Curriculum-guide Period', model.lesson.curriculumPeriod, 'School Grading Term', model.lesson.gradingTerm],
    ['Sessions', model.lesson.sessions, 'Duration', model.lesson.duration],
  ]

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 55 },
      children: [new TextRun({ text: 'Republic of the Philippines', size: 18, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 35 },
      children: [new TextRun({ text: 'Department of Education', bold: true, size: 20, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [new TextRun({ text: model.identity.region, size: 17, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: model.identity.division, size: 17, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: model.documentTitle, bold: true, size: 30, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: model.lesson.title, bold: true, size: 24, color: '202938' })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: metadataRows.map(([a, b, c, d]) => new TableRow({ children: [cell(a, b), cell(c, d)] })),
    }),
    docxSectionHeading('Verified Curriculum Context'),
    ...docxField(model.competency.label, model.competency.text),
    ...docxField('Performance standard', model.competency.performanceStandard),
    ...docxField('Source provenance', model.competency.source),
    docxSectionHeading('I - Intentions'),
    ...model.ilaw.intentions.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading('L - Learning Experience'),
    ...model.ilaw.learningExperience.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading('A - Assessing Learning'),
    ...model.ilaw.assessingLearning.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading('W - Ways Forward'),
    ...model.ilaw.waysForward.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading('References'),
    ...docxField('Teacher-entered references', model.references),
  ]

  if (model.aiDeclaration) {
    children.push(
      docxSectionHeading('AI Use Declaration'),
      ...docxField('Teacher-reviewed assistance', model.aiDeclaration),
    )
  }

  if (model.signatories.length) {
    children.push(docxSectionHeading('Signatories'))
    for (const item of model.signatories) {
      children.push(
        new Paragraph({ spacing: { before: 240, after: 30 }, children: [new TextRun({ text: item.role, size: 18, color: MUTED })] }),
        new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: item.name || '____________________________', bold: true, size: 20, color: '202938' })] }),
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: item.title || ' ', size: 18, color: MUTED })] }),
      )
    }
  }

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 260 },
    children: [new TextRun({ text: 'Generated using the GuroDesk ILAW Standard template. GuroDesk is an independent tool and does not imply DepEd endorsement.', size: 14, color: '7A8493' })],
  }))

  const document = new Document({
    creator: 'GuroDesk',
    title: `${model.lesson.title} - ILAW Lesson Plan`,
    description: 'Teacher-reviewed ILAW lesson plan export',
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
  const color = options?.color ?? [32, 41, 56]
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
  pdfEnsure(ctx, 44)
  ctx.doc.setFillColor(23, 54, 93)
  ctx.doc.roundedRect(ctx.x, ctx.y - 12, ctx.width, 26, 4, 4, 'F')
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(11)
  ctx.doc.setTextColor(255, 255, 255)
  ctx.doc.text(title, ctx.x + 10, ctx.y + 5)
  ctx.y += 31
}

function pdfLabelBody(ctx: PdfContext, label: string, body: string) {
  if (!clean(body)) return
  pdfText(ctx, label, { bold: true, size: 9.5, color: [23, 54, 93], gapAfter: 3 })
  pdfText(ctx, body, { size: 9.5, gapAfter: 9 })
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

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(91, 101, 116)
  doc.text('Republic of the Philippines', pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(23, 54, 93)
  doc.text('Department of Education', pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 13
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(91, 101, 116)
  doc.text(model.identity.region, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 12
  doc.text(model.identity.division, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 25

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(23, 54, 93)
  doc.text(model.documentTitle, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 20
  doc.setFontSize(12)
  doc.setTextColor(32, 41, 56)
  const titleLines = doc.splitTextToSize(model.lesson.title, ctx.width)
  doc.text(titleLines, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += titleLines.length * 15 + 17

  const rows = [
    ['School', model.identity.schoolName],
    ['Teacher', `${model.identity.teacherName} - ${model.identity.positionTitle}`],
    ['Class', `${model.lesson.gradeLevel} ${model.lesson.learningArea} - ${model.lesson.sections}`],
    ['School Year', model.lesson.schoolYear],
    ['Curriculum / Grading', `${model.lesson.curriculumPeriod} / ${model.lesson.gradingTerm}`],
    ['Schedule', `${model.lesson.lessonDate}; ${model.lesson.weekLabel}; ${model.lesson.sessions} session(s); ${model.lesson.duration}`],
  ]
  for (const [label, value] of rows) {
    pdfEnsure(ctx, 28)
    doc.setFillColor(244, 247, 251)
    doc.rect(ctx.x, ctx.y - 11, ctx.width, 24, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(91, 101, 116)
    doc.text(label.toUpperCase(), ctx.x + 8, ctx.y + 3)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(32, 41, 56)
    const valueLines = doc.splitTextToSize(value, ctx.width - 150)
    doc.text(valueLines, ctx.x + 142, ctx.y + 3)
    ctx.y += Math.max(26, valueLines.length * 11 + 8)
  }
  ctx.y += 8

  pdfSection(ctx, 'Verified Curriculum Context')
  pdfLabelBody(ctx, model.competency.label, model.competency.text)
  pdfLabelBody(ctx, 'Performance standard', model.competency.performanceStandard)
  pdfLabelBody(ctx, 'Source provenance', model.competency.source)

  const groups: Array<[string, LessonPlanExportModel['ilaw'][keyof LessonPlanExportModel['ilaw']]]> = [
    ['I - Intentions', model.ilaw.intentions],
    ['L - Learning Experience', model.ilaw.learningExperience],
    ['A - Assessing Learning', model.ilaw.assessingLearning],
    ['W - Ways Forward', model.ilaw.waysForward],
  ]
  for (const [heading, fields] of groups) {
    pdfSection(ctx, heading)
    for (const field of fields) pdfLabelBody(ctx, field.heading, field.body)
  }

  pdfSection(ctx, 'References')
  pdfLabelBody(ctx, 'Teacher-entered references', model.references)

  if (model.aiDeclaration) {
    pdfSection(ctx, 'AI Use Declaration')
    pdfLabelBody(ctx, 'Teacher-reviewed assistance', model.aiDeclaration)
  }

  if (model.signatories.length) {
    pdfSection(ctx, 'Signatories')
    for (const item of model.signatories) {
      pdfText(ctx, item.role, { size: 8.5, color: [91, 101, 116], gapAfter: 2 })
      pdfText(ctx, item.name || '____________________________', { bold: true, size: 10, gapAfter: 2 })
      pdfText(ctx, item.title, { size: 8.5, color: [91, 101, 116], gapAfter: 12 })
    }
  }

  pdfEnsure(ctx, 40)
  pdfText(ctx, 'Generated using the GuroDesk ILAW Standard template. GuroDesk is an independent tool and does not imply DepEd endorsement.', { size: 7.5, color: [122, 132, 147], gapAfter: 0 })

  const pageCount = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(132, 142, 156)
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 22, { align: 'right' })
  }

  doc.save(lessonPlanExportFilename(model, 'pdf'))
}
