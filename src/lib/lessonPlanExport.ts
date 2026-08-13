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
import type { TeacherLessonPreferences } from '../types/teachingSetup'
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

function formatDate(value: string, language: 'english' | 'filipino') {
  if (!value) return 'Not specified'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(language === 'filipino' ? 'fil-PH' : 'en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
}

const ENGLISH_LABELS = {
  republic: 'Republic of the Philippines',
  department: 'Department of Education',
  documentTitle: 'ILAW LESSON PLAN',
  teacher: 'Teacher',
  gradeSection: 'Grade Level / Section',
  learningArea: 'Learning Area',
  lessonTitle: 'Lesson Title',
  date: 'Date',
  weekSchedule: 'Week / Schedule',
  schoolYear: 'School Year',
  gradingTerm: 'Grading Term',
  curriculumPeriod: 'Curriculum Period',
  sessionsDuration: 'Sessions / Duration',
  references: 'References',
  intentions: 'INTENTIONS',
  learningExperience: 'LEARNING EXPERIENCE',
  assessingLearning: 'ASSESSING LEARNING',
  waysForward: 'WAYS FORWARD',
  signatures: 'SIGNATURES',
  preparedBy: 'Prepared by',
  reviewedBy: 'Reviewed by',
  notedBy: 'Noted by',
  sessionUnit: 'session(s)',
  draftCopy: 'DRAFT COPY',
  archivedCopy: 'ARCHIVED COPY',
} as const

const FILIPINO_LABELS = {
  republic: 'Republika ng Pilipinas',
  department: 'Kagawaran ng Edukasyon',
  documentTitle: 'ILAW BANGHAY-ARALIN',
  teacher: 'Guro',
  gradeSection: 'Baitang / Seksyon',
  learningArea: 'Larangan ng Pagkatuto',
  lessonTitle: 'Pamagat ng Aralin',
  date: 'Petsa',
  weekSchedule: 'Linggo / Iskedyul',
  schoolYear: 'Taong Panuruan',
  gradingTerm: 'Termino ng Pagmamarka',
  curriculumPeriod: 'Panahon sa Kurikulum',
  sessionsDuration: 'Mga Sesyon / Tagal',
  references: 'Mga Sanggunian',
  intentions: 'MGA LAYUNIN',
  learningExperience: 'KARANASAN SA PAGKATUTO',
  assessingLearning: 'PAGTATAYA SA PAGKATUTO',
  waysForward: 'MGA SUSUNOD NA HAKBANG',
  signatures: 'MGA LAGDA',
  preparedBy: 'Inihanda ni',
  reviewedBy: 'Sinuri ni',
  notedBy: 'Pinagtibay ni',
  sessionUnit: 'sesyon',
  draftCopy: 'BORADOR',
  archivedCopy: 'NAKA-ARCHIVE NA KOPYA',
} as const

const ENGLISH_FIELD_LABELS = {
  lessonFocus: 'Lesson Topic / Focus',
  competencyStandards: 'Learning Competency and Curriculum Standards',
  learningObjectives: 'Learning Objectives',
  learnerContext: 'Learner Context',
  teachingApproaches: 'Teaching Approaches',
  preLesson: 'Pre-Lesson',
  lessonFlow: 'Lesson Flow',
  resources: 'Learning Resources',
  contextualization: 'Opportunities for Integration and Contextualization',
  inclusion: 'Inclusion and Accommodations',
  homeAlternative: 'Learning Continuity / Home-Based Alternative',
  formative: 'Formative Assessment',
  evidence: 'Evidence of Learning',
  extended: 'Extended Learning Opportunities',
  nextSteps: 'Next Steps / Intervention',
  reflection: 'Reflection',
  performanceStandard: 'Performance Standard',
  contentStandard: 'Content Standard',
  primaryCompetency: 'Primary competency',
  additionalCompetency: 'Additional competency',
  noCurriculumAlignment: 'No verified curriculum competency attached',
  lessonPurpose: 'Lesson purpose',
  alignmentNote: 'Alignment note',
} as const

const FILIPINO_FIELD_LABELS = {
  lessonFocus: 'Paksa / Pokus ng Aralin',
  competencyStandards: 'Kasanayang Pampagkatuto at mga Pamantayan sa Kurikulum',
  learningObjectives: 'Mga Layunin sa Pagkatuto',
  learnerContext: 'Konteksto ng mga Mag-aaral',
  teachingApproaches: 'Mga Pamamaraan sa Pagtuturo',
  preLesson: 'Bago ang Aralin',
  lessonFlow: 'Daloy ng Aralin',
  resources: 'Mga Kagamitang Panturo',
  contextualization: 'Mga Pagkakataon para sa Integrasyon at Kontekstuwalisasyon',
  inclusion: 'Inklusyon at mga Angkop na Suporta',
  homeAlternative: 'Pagpapatuloy ng Pagkatuto / Alternatibong Gawaing Pantahanan',
  formative: 'Pormatibong Pagtataya',
  evidence: 'Katibayan ng Pagkatuto',
  extended: 'Karagdagang Pagkakataon sa Pagkatuto',
  nextSteps: 'Mga Susunod na Hakbang / Interbensyon',
  reflection: 'Pagninilay',
  performanceStandard: 'Pamantayan sa Pagganap',
  contentStandard: 'Pamantayang Pangnilalaman',
  primaryCompetency: 'Pangunahing kasanayan',
  additionalCompetency: 'Karagdagang kasanayan',
  noCurriculumAlignment: 'Walang kalakip na beripikadong kasanayan sa kurikulum',
  lessonPurpose: 'Layunin ng aralin',
  alignmentNote: 'Tala sa pagkakahanay',
} as const

function looksFilipino(text: string) {
  const normalized = ` ${text.toLowerCase().replace(/[^a-záéíóúñ\s-]/g, ' ')} `
  const markers = [' ang ', ' mga ', ' ng ', ' sa ', ' ay ', ' upang ', ' mag-aaral', ' aralin', ' gawain', ' pagkatuto', ' natutukoy', ' naipapaliwanag', ' nakagagawa']
  return markers.reduce((score, marker) => score + (normalized.includes(marker) ? 1 : 0), 0) >= 3
}

function resolveExportLanguage(
  plan: LessonPlanRecord,
  preferences: TeacherExportPreferences,
  lessonPreferences?: TeacherLessonPreferences | null,
): 'english' | 'filipino' {
  if (preferences.documentLanguage === 'filipino') return 'filipino'
  if (preferences.documentLanguage === 'english') return 'english'
  if (plan.content.lessonLanguage === 'Filipino') return 'filipino'
  if (plan.content.lessonLanguage === 'English') return 'english'

  const lessonText = [
    plan.content.learningArea,
    plan.content.lessonFocus,
    plan.content.lessonTitle,
    plan.content.intentions.learningObjectives,
    plan.content.learningExperience.preLessonActivity,
    plan.content.learningExperience.lessonFlow,
    plan.content.assessingLearning.formativeAssessments,
    plan.content.waysForward.nextSteps,
  ].filter(Boolean).join('\n')

  if (plan.content.learningArea.toLowerCase().includes('filipino')) return 'filipino'
  if (looksFilipino(lessonText)) return 'filipino'
  if (lessonPreferences?.languagePreference === 'Filipino') return 'filipino'
  return 'english'
}

function competencyAndStandards(plan: LessonPlanRecord, language: 'english' | 'filipino') {
  const labels = language === 'filipino' ? FILIPINO_FIELD_LABELS : ENGLISH_FIELD_LABELS
  const competency = plan.content.competency
  const alignments = plan.content.curriculumAlignments?.length
    ? plan.content.curriculumAlignments
    : clean(competency.text) ? [competency] : []
  const lines: string[] = []
  const primaryId = plan.content.primaryCompetencyId || competency.id || null
  let additionalIndex = 0

  for (const [index, alignment] of alignments.entries()) {
    const competencyText = clean(alignment.text)
    if (!competencyText) continue
    const isPrimary = alignment.id === primaryId || (!primaryId && index === 0)
    if (!isPrimary) additionalIndex += 1
    const prefix = isPrimary ? labels.primaryCompetency : `${labels.additionalCompetency} ${additionalIndex}`
    const statement = clean(alignment.code) ? `${clean(alignment.code)}: ${competencyText}` : competencyText
    lines.push(`${prefix}: ${statement}`)
  }

  if (!lines.length) {
    const purpose = plan.content.alignmentPurpose && plan.content.alignmentPurpose !== 'regular'
      ? plan.content.alignmentPurpose.replaceAll('_', ' ')
      : ''
    lines.push(purpose
      ? `${labels.noCurriculumAlignment}. ${labels.lessonPurpose}: ${purpose}.`
      : `${labels.noCurriculumAlignment}.`)
    if (clean(plan.content.alignmentNote)) {
      lines.push(`${labels.alignmentNote}: ${clean(plan.content.alignmentNote)}`)
    }
  }

  const contentStandards = [...new Set(alignments.flatMap((alignment) => alignment.contentStandards ?? []).map(clean).filter(Boolean))]
  for (const standard of contentStandards) lines.push(`${labels.contentStandard}: ${standard}`)

  const performanceStandards = [...new Set([
    ...alignments.flatMap((alignment) => alignment.performanceStandards ?? []),
    plan.content.performanceStandard,
  ].map(clean).filter(Boolean))]
  for (const standard of performanceStandards) lines.push(`${labels.performanceStandard}: ${standard}`)
  return lines.join('\n')
}

export function buildLessonPlanExportModel(
  plan: LessonPlanRecord,
  profile: Profile,
  preferences: TeacherExportPreferences,
  lessonPreferences?: TeacherLessonPreferences | null,
): LessonPlanExportModel {
  const content = plan.content
  const language = resolveExportLanguage(plan, preferences, lessonPreferences)
  const labels = language === 'filipino' ? FILIPINO_LABELS : ENGLISH_LABELS
  const fieldLabels = language === 'filipino' ? FILIPINO_FIELD_LABELS : ENGLISH_FIELD_LABELS
  const signatories = [
    {
      role: labels.preparedBy,
      name: clean(preferences.preparedByName) || clean(profile.fullName),
      title: clean(preferences.preparedByTitle) || clean(profile.positionTitle),
    },
    {
      role: labels.reviewedBy,
      name: clean(preferences.reviewedByName),
      title: clean(preferences.reviewedByTitle),
    },
    {
      role: labels.notedBy,
      name: clean(preferences.notedByName),
      title: clean(preferences.notedByTitle),
    },
  ].filter((item) => item.name || item.role === labels.preparedBy)

  return {
    documentTitle: labels.documentTitle,
    templateLabel: 'ILAW Standard',
    language,
    labels,
    status: plan.status,
    identity: {
      teacherName: display(profile.fullName, ''),
      positionTitle: clean(profile.positionTitle),
      schoolName: clean(profile.schoolName),
      region: clean(profile.region),
      division: clean(profile.division),
    },
    lesson: {
      title: display(content.lessonTitle || content.lessonFocus),
      schoolYear: display(content.schoolYear),
      gradeLevel: display(content.gradeLevel),
      learningArea: display(content.learningArea),
      sections: content.sections.length ? content.sections.join(', ') : 'Not specified',
      curriculumPeriod: display(content.curriculumPeriodLabel),
      gradingTerm: display(content.gradingTermLabel),
      lessonDate: formatDate(content.lessonDate, language),
      weekLabel: display(content.weekLabel),
      sessions: `${content.numberOfSessions || 1}`,
      duration: language === 'filipino'
        ? `${content.durationMinutes || 60} minuto bawat sesyon`
        : `${content.durationMinutes || 60} minutes per session`,
    },
    ilaw: {
      intentions: [
        { key: 'lesson-focus', heading: fieldLabels.lessonFocus, body: clean(content.lessonFocus) || clean(content.lessonTitle) },
        { key: 'competency-standards', heading: fieldLabels.competencyStandards, body: competencyAndStandards(plan, language) },
        { key: 'learning-objectives', heading: fieldLabels.learningObjectives, body: clean(content.intentions.learningObjectives) },
        { key: 'learner-context', heading: fieldLabels.learnerContext, body: clean(content.learnerContext) },
        { key: 'teaching-approaches', heading: fieldLabels.teachingApproaches, body: content.teachingApproaches.join('\n') },
      ],
      learningExperience: [
        { key: 'pre-lesson', heading: fieldLabels.preLesson, body: clean(content.learningExperience.preLessonActivity) },
        { key: 'lesson-flow', heading: fieldLabels.lessonFlow, body: clean(content.learningExperience.lessonFlow) },
        { key: 'resources', heading: fieldLabels.resources, body: clean(content.learningExperience.resources) },
        { key: 'contextualization', heading: fieldLabels.contextualization, body: clean(content.learningExperience.integrationContextualization) },
        { key: 'inclusion', heading: fieldLabels.inclusion, body: clean(content.learningExperience.inclusionAccommodations) },
        { key: 'home-alternative', heading: fieldLabels.homeAlternative, body: clean(content.learningExperience.homeBasedAlternative) },
      ],
      assessingLearning: [
        { key: 'formative', heading: fieldLabels.formative, body: clean(content.assessingLearning.formativeAssessments) },
        { key: 'evidence', heading: fieldLabels.evidence, body: clean(content.assessingLearning.evidenceOfLearning) },
      ],
      waysForward: [
        { key: 'extended', heading: fieldLabels.extended, body: clean(content.waysForward.extendedLearning) },
        { key: 'next-steps', heading: fieldLabels.nextSteps, body: clean(content.waysForward.nextSteps) },
        { key: 'reflection', heading: fieldLabels.reflection, body: clean(content.waysForward.reflection) },
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

function exportValue(value: string | null | undefined) {
  const normalized = clean(value)
  return normalized === 'Not specified' ? '' : normalized
}

function docxMetaLabelCell(label: string) {
  return new TableCell({
    width: { size: 28, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [new Paragraph({
      children: [new TextRun({ text: label, bold: true, size: 18, color: TEXT })],
    })],
  })
}

function docxMetaValueCell(value: string) {
  const lines = (exportValue(value) || ' ').split(/\r?\n/)
  return new TableCell({
    width: { size: 72, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: lines.map((line) => new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: line || ' ', size: 19, color: TEXT })],
    })),
  })
}

function docxMetaRow(label: string, value: string) {
  return new TableRow({ children: [docxMetaLabelCell(label), docxMetaValueCell(value)] })
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
  const sessionSummary = `${model.lesson.sessions} ${model.labels.sessionUnit}, ${model.lesson.duration}`

  const headerLines = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [new TextRun({ text: model.labels.republic, size: 17, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 26 },
      children: [new TextRun({ text: model.labels.department, bold: true, size: 20, color: TEXT })],
    }),
    ...(model.identity.region ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.region, size: 16, color: TEXT })] })] : []),
    ...(model.identity.division ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.division, size: 16, color: TEXT })] })] : []),
    ...(model.identity.schoolName ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 90 }, children: [new TextRun({ text: model.identity.schoolName, bold: true, size: 18, color: TEXT })] })] : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 120 },
      children: [new TextRun({ text: model.documentTitle, bold: true, size: 27, color: TEXT })],
    }),
  ]

  const metaRows = [
    docxMetaRow(model.labels.teacher, model.identity.teacherName),
    docxMetaRow(model.labels.gradeSection, gradeAndSection),
    docxMetaRow(model.labels.learningArea, model.lesson.learningArea),
    docxMetaRow(model.labels.lessonTitle, model.lesson.title),
    docxMetaRow(model.labels.date, model.lesson.lessonDate),
    docxMetaRow(model.labels.weekSchedule, model.lesson.weekLabel),
    docxMetaRow(model.labels.schoolYear, model.lesson.schoolYear),
    docxMetaRow(model.labels.gradingTerm, model.lesson.gradingTerm),
    docxMetaRow(model.labels.curriculumPeriod, model.lesson.curriculumPeriod),
    docxMetaRow(model.labels.sessionsDuration, sessionSummary),
    docxMetaRow(model.labels.references, model.references),
  ]

  const children: Array<Paragraph | Table> = [
    ...headerLines,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: metaRows,
    }),
    docxSectionHeading(`I. ${model.labels.intentions}`),
    ...model.ilaw.intentions.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading(`L. ${model.labels.learningExperience}`),
    ...model.ilaw.learningExperience.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading(`A. ${model.labels.assessingLearning}`),
    ...model.ilaw.assessingLearning.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading(`W. ${model.labels.waysForward}`),
    ...model.ilaw.waysForward.flatMap((item) => docxField(item.heading, item.body)),
  ]

  if (model.signatories.length) {
    children.push(docxSectionHeading(model.labels.signatures))
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
    description: model.language === 'filipino' ? 'ILAW banghay-aralin' : 'ILAW lesson plan',
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

function pdfMetaRow(ctx: PdfContext, label: string, value: string) {
  const labelWidth = Math.min(128, ctx.width * 0.29)
  const padX = 7
  const padY = 6
  const lineHeight = 10.5
  const labelLines = ctx.doc.splitTextToSize(label, labelWidth - padX * 2) as string[]
  const displayValue = exportValue(value) || ' '
  const valueLines = ctx.doc.splitTextToSize(displayValue, ctx.width - labelWidth - padX * 2) as string[]
  const rowHeight = Math.max(26, Math.max(labelLines.length, valueLines.length) * lineHeight + padY * 2)
  pdfEnsure(ctx, rowHeight + 1)
  const top = ctx.y

  ctx.doc.setDrawColor(105, 105, 105)
  ctx.doc.setLineWidth(0.45)
  ctx.doc.rect(ctx.x, top, ctx.width, rowHeight)
  ctx.doc.line(ctx.x + labelWidth, top, ctx.x + labelWidth, top + rowHeight)

  const textY = top + padY + 7.5
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(8.2)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(labelLines, ctx.x + padX, textY)

  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(8.8)
  ctx.doc.text(valueLines, ctx.x + labelWidth + padX, textY)
  ctx.y = top + rowHeight
}

function pdfHeaderLine(ctx: PdfContext, text: string, options?: { bold?: boolean; size?: number; gap?: number }) {
  if (!clean(text)) return
  ctx.doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  ctx.doc.setFontSize(options?.size ?? 8.5)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(text, ctx.doc.internal.pageSize.getWidth() / 2, ctx.y, { align: 'center' })
  ctx.y += options?.gap ?? 12
}

function pdfSignatoryGrid(ctx: PdfContext, signatories: LessonPlanExportModel['signatories']) {
  if (!signatories.length) return
  pdfEnsure(ctx, 92)
  const count = Math.min(3, signatories.length)
  const colWidth = ctx.width / count
  const top = ctx.y + 8
  signatories.slice(0, count).forEach((item, index) => {
    const center = ctx.x + colWidth * index + colWidth / 2
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setFontSize(8.3)
    ctx.doc.text(item.role, center, top, { align: 'center' })
    const lineY = top + 30
    ctx.doc.setDrawColor(70, 70, 70)
    ctx.doc.setLineWidth(0.45)
    ctx.doc.line(center - colWidth * 0.34, lineY, center + colWidth * 0.34, lineY)
    if (clean(item.name)) {
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setFontSize(8.8)
      const nameLines = ctx.doc.splitTextToSize(item.name, colWidth * 0.72) as string[]
      ctx.doc.text(nameLines, center, lineY + 12, { align: 'center' })
    }
    if (clean(item.title)) {
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7.6)
      const titleLines = ctx.doc.splitTextToSize(item.title, colWidth * 0.72) as string[]
      ctx.doc.text(titleLines, center, lineY + 25, { align: 'center' })
    }
  })
  ctx.y = top + 64
}

export function downloadLessonPlanPdf(
  model: LessonPlanExportModel,
  preferences: TeacherExportPreferences,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: pdfFormat(preferences.paperSize), compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 54
  const ctx: PdfContext = { doc, x: margin, y: 54, width: pageWidth - margin * 2, bottom: pageHeight - 54 }
  const gradeAndSection = `${model.lesson.gradeLevel}${model.lesson.sections && model.lesson.sections !== 'Not specified' ? ` - ${model.lesson.sections}` : ''}`
  const sessionSummary = `${model.lesson.sessions} ${model.labels.sessionUnit}, ${model.lesson.duration}`

  pdfHeaderLine(ctx, model.labels.republic, { size: 8.5, gap: 12 })
  pdfHeaderLine(ctx, model.labels.department, { bold: true, size: 10, gap: 12 })
  pdfHeaderLine(ctx, model.identity.region, { size: 8.2, gap: 11 })
  pdfHeaderLine(ctx, model.identity.division, { size: 8.2, gap: 11 })
  pdfHeaderLine(ctx, model.identity.schoolName, { bold: true, size: 8.8, gap: 18 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(model.documentTitle, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 22

  pdfMetaRow(ctx, model.labels.teacher, model.identity.teacherName)
  pdfMetaRow(ctx, model.labels.gradeSection, gradeAndSection)
  pdfMetaRow(ctx, model.labels.learningArea, model.lesson.learningArea)
  pdfMetaRow(ctx, model.labels.lessonTitle, model.lesson.title)
  pdfMetaRow(ctx, model.labels.date, model.lesson.lessonDate)
  pdfMetaRow(ctx, model.labels.weekSchedule, model.lesson.weekLabel)
  pdfMetaRow(ctx, model.labels.schoolYear, model.lesson.schoolYear)
  pdfMetaRow(ctx, model.labels.gradingTerm, model.lesson.gradingTerm)
  pdfMetaRow(ctx, model.labels.curriculumPeriod, model.lesson.curriculumPeriod)
  pdfMetaRow(ctx, model.labels.sessionsDuration, sessionSummary)
  pdfMetaRow(ctx, model.labels.references, model.references)
  ctx.y += 10

  const groups: Array<[string, LessonPlanExportModel['ilaw'][keyof LessonPlanExportModel['ilaw']]]> = [
    [`I. ${model.labels.intentions}`, model.ilaw.intentions],
    [`L. ${model.labels.learningExperience}`, model.ilaw.learningExperience],
    [`A. ${model.labels.assessingLearning}`, model.ilaw.assessingLearning],
    [`W. ${model.labels.waysForward}`, model.ilaw.waysForward],
  ]
  for (const [heading, fields] of groups) {
    pdfSection(ctx, heading)
    for (const field of fields) pdfLabelBody(ctx, field.heading, field.body)
  }

  if (model.signatories.length) {
    pdfSection(ctx, model.labels.signatures)
    pdfSignatoryGrid(ctx, model.signatories)
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
