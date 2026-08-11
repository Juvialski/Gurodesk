import type { AssessmentAnswer, QuestionType } from '../types/assessment'
import type { AssessmentExportModel, AssessmentExportQuestion } from '../types/assessmentExport'
import type { AssessmentVisual } from '../types/assessmentVisual'
import { normalizeAssessmentMathText } from './assessmentMathText'

export type AssessmentResponseKind =
  | 'none'
  | 'true_false'
  | 'single_line'
  | 'fill_inline'
  | 'fill_structured'
  | 'numerical'
  | 'matching'
  | 'extended'

export type AssessmentVisualScale = 'standard' | 'large' | 'cartesian'

export type AssessmentPaperIdentityLine = {
  role: 'republic' | 'department' | 'region' | 'division' | 'school'
  text: string
}

export type AssessmentPaperMetadataField = {
  key: string
  label: string
  value: string
  placeholder?: string
  learnerWritable?: boolean
}

export type AssessmentPaperResponse = {
  kind: AssessmentResponseKind
  lines: number
  blankLabels: string[]
  trueFalseLabels: [string, string]
  answerLabel: string
  unitLabel: string
  instructions: string
}

export type AssessmentPaperAnnotation = {
  kind: 'answer' | 'solution' | 'competency' | 'cognitive' | 'rationale'
  label: string
  text: string
}

export type AssessmentPaperQuestion = {
  source: AssessmentExportQuestion
  key: string
  itemNumber: number
  questionType: QuestionType
  numberLabel: string
  pointLabel: string
  prompt: string
  choices: Array<{ label: string; text: string; checkbox: boolean }>
  matching: {
    columnALabel: string
    columnBLabel: string
    prompts: Array<{ label: string; text: string }>
    choices: Array<{ label: string; text: string }>
  }
  subparts: Array<{ label: string; prompt: string; pointsPossible: number; pointLabel: string }>
  response: AssessmentPaperResponse
  annotations: AssessmentPaperAnnotation[]
  visual?: AssessmentVisual
  visualScale: AssessmentVisualScale
  keepTogether: boolean
}

export type AssessmentPaperSection = {
  key: string
  title: string
  questionType: QuestionType | null
  questions: AssessmentPaperQuestion[]
}

/**
 * Renderer-neutral paper semantics. Browser preview, PDF, DOCX, and browser
 * print may choose medium-specific measurements, but they must consume this
 * same hierarchy, metadata order, grouping, response policy, and visual.
 */
export type AssessmentPaperPresentationModel = {
  source: AssessmentExportModel
  mode: AssessmentExportModel['mode']
  language: AssessmentExportModel['language']
  header: {
    identityLines: AssessmentPaperIdentityLine[]
    documentTitle: string
    assessmentTitle: string
    metadataRows: AssessmentPaperMetadataField[][]
    instructionsLabel: string
    instructions: string
    continuationDocumentTitle: string
    continuationAssessmentTitle: string
  }
  sections: AssessmentPaperSection[]
}

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True or False',
  short_answer: 'Short Answer',
  constructed_response: 'Constructed Response',
  identification: 'Identification',
  fill_in_the_blank: 'Fill in the Blank',
  numerical_answer: 'Numerical Answer',
  problem_solving: 'Problem Solving',
  matching: 'Matching Type',
  multiple_select: 'Multiple Select',
  essay: 'Essay / Extended Response',
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII']

function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown) { return Array.isArray(value) ? value : [] }
function text(value: unknown) { return normalizeAssessmentMathText(String(value ?? '')).trim() }
function visibleLabel(index: number) { return String.fromCharCode(65 + index) }
function choicesFor(question: AssessmentExportQuestion) { return 'choices' in question && Array.isArray(question.choices) ? question.choices : [] }
function promptsFor(question: AssessmentExportQuestion) { return 'prompts' in question && Array.isArray(question.prompts) ? question.prompts : [] }
function blanksFor(question: AssessmentExportQuestion) { return 'blanks' in question && Array.isArray(question.blanks) ? question.blanks : [] }
function subpartsFor(question: AssessmentExportQuestion) { return 'subparts' in question && Array.isArray(question.subparts) ? question.subparts : [] }
function choiceText(choice: string | { text: string }) { return text(typeof choice === 'string' ? choice : choice.text) }

export function assessmentQuestionTypeLabel(type: QuestionType) { return TYPE_LABELS[type] }

export function assessmentQuestionTypesAreContiguous(questions: Array<Pick<AssessmentExportQuestion, 'questionType'>>) {
  const closed = new Set<QuestionType>()
  let current: QuestionType | null = null
  for (const question of questions) {
    if (question.questionType === current) continue
    if (current) closed.add(current)
    if (closed.has(question.questionType)) return false
    current = question.questionType
  }
  return true
}

export function assessmentUsesContiguousTypeSections(questions: Array<Pick<AssessmentExportQuestion, 'questionType'>>) {
  if (questions.length < 2 || !assessmentQuestionTypesAreContiguous(questions)) return false
  return new Set(questions.map((question) => question.questionType)).size > 1
}

export function assessmentSectionTitle(type: QuestionType, sectionIndex: number) {
  return `Part ${ROMAN[sectionIndex] ?? String(sectionIndex + 1)} - ${TYPE_LABELS[type]}`
}

export function promptHasVisibleBlank(prompt: string) { return /_{3,}|\u2014{3,}|\.{4,}/u.test(prompt) }

export function assessmentResponseKind(question: AssessmentExportQuestion): AssessmentResponseKind {
  if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') return 'none'
  if (question.questionType === 'true_false') return 'true_false'
  if (question.questionType === 'matching') return 'matching'
  if (question.questionType === 'fill_in_the_blank') {
    const count = 'blanks' in question && Array.isArray(question.blanks) ? question.blanks.length : 0
    return count <= 1 && 'prompt' in question && promptHasVisibleBlank(question.prompt) ? 'fill_inline' : 'fill_structured'
  }
  if (question.questionType === 'numerical_answer') return 'numerical'
  if (question.questionType === 'constructed_response' || question.questionType === 'problem_solving' || question.questionType === 'essay') return 'extended'
  return 'single_line'
}

export function recommendedAssessmentResponseLines(question: Pick<AssessmentExportQuestion, 'questionType' | 'pointsPossible' | 'answerSpaceLines'>) {
  const points = Math.max(1, Number(question.pointsPossible) || 1)
  if (question.questionType === 'essay') return Math.max(7, Math.min(15, Math.ceil(points * 1.15)))
  if (question.questionType === 'problem_solving') return Math.max(4, Math.min(11, Math.ceil(points * 1.5)))
  if (question.questionType === 'constructed_response') return Math.max(3, Math.min(10, Math.ceil(points * 1.35)))
  if (question.questionType === 'short_answer') return points > 1 ? 2 : 1
  if (question.questionType === 'fill_in_the_blank') return Math.max(0, Math.min(6, question.answerSpaceLines))
  if (question.questionType === 'true_false' || question.questionType === 'identification' || question.questionType === 'numerical_answer') return 1
  return Math.max(0, question.answerSpaceLines)
}

export function assessmentVisualScale(question: AssessmentExportQuestion): AssessmentVisualScale {
  const visual = question.visual
  if (!visual) return 'standard'
  if (visual.primitives.some((primitive) => primitive.type === 'cartesianAxes' || primitive.type === 'cartesianPlot')) return 'cartesian'
  const labels = visual.primitives.filter((primitive) => primitive.type === 'textLabel').length
  return labels >= 3 ? 'large' : 'standard'
}

/** Short/structured blocks should never orphan their stem from answer controls. */
export function assessmentQuestionKeepTogether(question: AssessmentExportQuestion) {
  return !['constructed_response', 'problem_solving', 'essay'].includes(question.questionType)
}

/** One deterministic answer formatter for preview, PDF, DOCX, and print HTML. */
export function assessmentPaperAnswerText(answer: AssessmentAnswer) {
  const value = answer as unknown as Record<string, unknown>
  if (answer.type === 'multiple_choice') {
    const choices = array(value.choices).map(object)
    const index = choices.findIndex((choice) => String(choice.id) === answer.choiceId)
    return index >= 0 ? `${visibleLabel(index)}. ${text(choices[index].text)}` : 'Review choice mapping'
  }
  if (answer.type === 'true_false') return answer.value ? 'True' : 'False'
  if (answer.type === 'short_answer' || answer.type === 'identification') return array(value.acceptedAnswers).map(text).join(' / ')
  if (answer.type === 'fill_in_the_blank') return array(value.blanks).map((entry, index) => {
    const blank = object(entry); const points = Number(blank.pointsPossible)
    return `${visibleLabel(index)}. ${array(blank.acceptedAnswers).map(text).join(' / ')}${Number.isFinite(points) ? ` - ${points} pt${points === 1 ? '' : 's'}` : ''}`
  }).join(' | ')
  if (answer.type === 'numerical_answer') return `${String(value.value ?? '')}${value.unit ? ` ${text(value.unit)}` : ''}${value.tolerance !== undefined ? ` (+/-${String(value.tolerance)})` : ''}`
  if (answer.type === 'problem_solving') return text(value.finalAnswer)
  if (answer.type === 'matching') {
    const prompts = array(value.prompts).map(object); const choices = array(value.choices).map(object)
    return array(value.mappings).map((entry) => {
      const pair = object(entry)
      const prompt = prompts.findIndex((candidate) => String(candidate.id) === String(pair.promptId))
      const choice = choices.findIndex((candidate) => String(candidate.id) === String(pair.choiceId))
      const points = Number(pair.pointsPossible)
      return `${prompt >= 0 ? prompt + 1 : String(pair.promptId)} -> ${choice >= 0 ? visibleLabel(choice) : String(pair.choiceId)}${Number.isFinite(points) ? ` - ${points} pt${points === 1 ? '' : 's'}` : ''}`
    }).join(', ')
  }
  if (answer.type === 'multiple_select') {
    const choices = array(value.choices).map(object)
    return array(value.choiceIds).map((id) => { const index = choices.findIndex((choice) => String(choice.id) === String(id)); return index >= 0 ? visibleLabel(index) : '' }).filter(Boolean).join(', ')
  }
  if (answer.type === 'constructed_response') return text(value.expectedResponse)
  if (answer.type === 'essay') return 'See rubric / scoring guide; no single exact response.'
  return ''
}

function metadataField(key: string, label: string, value: unknown, options: Pick<AssessmentPaperMetadataField, 'placeholder' | 'learnerWritable'> = {}): AssessmentPaperMetadataField {
  return { key, label, value: text(value), ...options }
}

function identityLines(model: AssessmentExportModel): AssessmentPaperIdentityLine[] {
  const filipino = model.language === 'filipino'
  const lines: AssessmentPaperIdentityLine[] = [
    { role: 'republic', text: filipino ? 'Republika ng Pilipinas' : 'Republic of the Philippines' },
    { role: 'department', text: filipino ? 'Kagawaran ng Edukasyon' : 'Department of Education' },
  ]
  if (text(model.metadata.region)) lines.push({ role: 'region', text: text(model.metadata.region) })
  if (text(model.metadata.division)) lines.push({ role: 'division', text: text(model.metadata.division) })
  if (text(model.metadata.schoolName)) lines.push({ role: 'school', text: text(model.metadata.schoolName) })
  return lines
}

function metadataRows(model: AssessmentExportModel): AssessmentPaperMetadataField[][] {
  const totalItems = String(model.metadata.totalItems ?? model.questions.length)
  const totalPoints = String(model.metadata.totalPoints ?? model.questions.reduce((sum, question) => sum + question.pointsPossible, 0))
  const scoreLabel = model.language === 'filipino' ? 'Iskor' : 'Score'
  if (model.mode === 'answer_key') {
    return [
      [metadataField('teacher', model.labels.teacher, model.metadata.teacherName, { placeholder: '____________________' }), metadataField('school', model.labels.school, model.metadata.schoolName, { placeholder: '____________________' })],
      [metadataField('gradeLevel', model.labels.gradeLevel, model.metadata.gradeLevel), metadataField('learningArea', model.labels.learningArea, model.metadata.learningArea)],
      [metadataField('gradingTerm', model.labels.gradingTerm, model.metadata.gradingTerm), metadataField('schoolYear', model.labels.schoolYear, model.metadata.schoolYear)],
      [metadataField('totalItems', model.labels.totalItems, totalItems), metadataField('totalPoints', model.labels.totalPoints, totalPoints)],
    ]
  }
  const rows: AssessmentPaperMetadataField[][] = [
    ...(model.mode === 'teacher' ? [[metadataField('teacher', model.labels.teacher, model.metadata.teacherName, { placeholder: '____________________' }), metadataField('school', model.labels.school, model.metadata.schoolName, { placeholder: '____________________' })]] : []),
    [metadataField('learnerName', model.labels.learnerName, model.metadata.learnerName, { placeholder: '____________________________', learnerWritable: true }), metadataField('section', model.labels.section, model.metadata.section, { placeholder: '____________________', learnerWritable: true })],
    [metadataField('gradeLevel', model.labels.gradeLevel, model.metadata.gradeLevel), metadataField('learningArea', model.labels.learningArea, model.metadata.learningArea)],
    [metadataField('gradingTerm', model.labels.gradingTerm, model.metadata.gradingTerm), metadataField('schoolYear', model.labels.schoolYear, model.metadata.schoolYear)],
    ...(model.mode === 'teacher' && text(model.metadata.curriculumPeriods) ? [[metadataField('curriculumPeriods', model.labels.curriculumPeriods, model.metadata.curriculumPeriods)]] : []),
    [metadataField('totalItems', model.labels.totalItems, totalItems), metadataField('totalPoints', model.labels.totalPoints, totalPoints), metadataField('score', scoreLabel, model.mode === 'student' ? '' : totalPoints, { placeholder: `________ / ${totalPoints}`, learnerWritable: model.mode === 'student' })],
  ]
  return rows
}

function annotationList(model: AssessmentExportModel, question: AssessmentExportQuestion): AssessmentPaperAnnotation[] {
  if (model.mode === 'student') return []
  const annotations: AssessmentPaperAnnotation[] = []
  if ('answer' in question && question.answer) annotations.push({ kind: 'answer', label: model.labels.answer, text: assessmentPaperAnswerText(question.answer) })
  if ('scoringGuide' in question && question.scoringGuide) annotations.push({ kind: 'solution', label: model.labels.solution, text: text(question.scoringGuide) })
  if (model.mode !== 'answer_key' && 'competency' in question && question.competency) annotations.push({ kind: 'competency', label: model.labels.competency, text: `${question.competency.code ? `${question.competency.code} - ` : ''}${text(question.competency.text)}` })
  if (model.mode !== 'answer_key' && 'cognitiveCategory' in question && question.cognitiveCategory) annotations.push({ kind: 'cognitive', label: model.labels.cognitiveCategory, text: text(question.cognitiveCategory.label) })
  if (model.mode !== 'answer_key' && 'rationale' in question && question.rationale) annotations.push({ kind: 'rationale', label: model.labels.rationale, text: text(question.rationale) })
  return annotations
}

function paperQuestion(model: AssessmentExportModel, question: AssessmentExportQuestion): AssessmentPaperQuestion {
  const choices = choicesFor(question).map((choice, index) => ({ label: visibleLabel(index), text: choiceText(choice), checkbox: question.questionType === 'multiple_select' }))
  const prompts = promptsFor(question).map((prompt, index) => ({ label: String(index + 1), text: text(typeof prompt === 'string' ? prompt : prompt.text) }))
  const subparts = subpartsFor(question).map((part) => ({ ...part, prompt: text(part.prompt), pointLabel: `${part.pointsPossible} ${model.labels.points}` }))
  const responseKind = assessmentResponseKind(question)
  const responseLines = responseKind === 'extended' || responseKind === 'single_line'
    ? recommendedAssessmentResponseLines(question)
    : responseKind === 'numerical' || responseKind === 'true_false'
      ? 1
      : responseKind === 'fill_structured'
        ? Math.max(1, blanksFor(question).length)
        : 0
  const prompt = 'prompt' in question ? text(question.prompt) : ''
  return {
    source: question,
    key: `item-${question.itemNumber}`,
    itemNumber: question.itemNumber,
    questionType: question.questionType,
    numberLabel: `${question.itemNumber}.`,
    pointLabel: model.mode === 'student' && question.pointsPossible <= 1 ? '' : `${question.pointsPossible} ${model.labels.points}`,
    prompt,
    choices,
    matching: {
      columnALabel: model.labels.columnA,
      columnBLabel: model.labels.columnB,
      prompts,
      choices: choices.map(({ label, text: value }) => ({ label, text: value })),
    },
    subparts,
    response: {
      kind: responseKind,
      lines: responseLines,
      blankLabels: (blanksFor(question).length ? blanksFor(question) : [{ label: 'A' }]).map((blank) => blank.label),
      trueFalseLabels: model.language === 'filipino' ? ['Tama', 'Mali'] : ['True', 'False'],
      answerLabel: model.labels.answer,
      unitLabel: model.language === 'filipino' ? 'Yunit' : 'Unit',
      instructions: 'responseInstructions' in question ? text(question.responseInstructions) : '',
    },
    annotations: annotationList(model, question),
    ...(question.visual ? { visual: question.visual } : {}),
    visualScale: assessmentVisualScale(question),
    keepTogether: assessmentQuestionKeepTogether(question),
  }
}

export function buildAssessmentPaperPresentation(model: AssessmentExportModel): AssessmentPaperPresentationModel {
  const questions = model.questions.map((question) => paperQuestion(model, question))
  const useSections = model.mode !== 'answer_key' && assessmentUsesContiguousTypeSections(model.questions)
  const sections: AssessmentPaperSection[] = []
  if (!useSections) {
    sections.push({ key: 'assessment-items', title: '', questionType: null, questions })
  } else {
    let sectionIndex = -1
    for (const question of questions) {
      let section = sections[sections.length - 1]
      if (!section || section.questionType !== question.questionType) {
        sectionIndex += 1
        section = { key: `section-${sectionIndex + 1}-${question.questionType}`, title: assessmentSectionTitle(question.questionType, sectionIndex), questionType: question.questionType, questions: [] }
        sections.push(section)
      }
      section.questions.push(question)
    }
  }
  const continued = model.language === 'filipino' ? 'karugtong' : 'continued'
  return {
    source: model,
    mode: model.mode,
    language: model.language,
    header: {
      identityLines: identityLines(model),
      documentTitle: model.labels.documentTitle,
      assessmentTitle: model.title,
      metadataRows: metadataRows(model),
      instructionsLabel: model.labels.instructions,
      instructions: text(model.instructions),
      continuationDocumentTitle: `${model.labels.documentTitle} - ${continued}`,
      continuationAssessmentTitle: model.title,
    },
    sections,
  }
}

/** Stable renderer-equivalence projection used by structural regressions. */
export function assessmentPaperCanonicalSignature(paper: AssessmentPaperPresentationModel) {
  return {
    mode: paper.mode,
    language: paper.language,
    header: {
      identityLines: paper.header.identityLines,
      documentTitle: paper.header.documentTitle,
      assessmentTitle: paper.header.assessmentTitle,
      metadataRows: paper.header.metadataRows,
      instructionsLabel: paper.header.instructionsLabel,
      instructions: paper.header.instructions,
      continuationDocumentTitle: paper.header.continuationDocumentTitle,
      continuationAssessmentTitle: paper.header.continuationAssessmentTitle,
    },
    sections: paper.sections.map((section) => ({
      title: section.title,
      questionType: section.questionType,
      questions: section.questions.map((question) => ({
        itemNumber: question.itemNumber,
        questionType: question.questionType,
        numberLabel: question.numberLabel,
        pointLabel: question.pointLabel,
        prompt: question.prompt,
        choices: question.choices,
        matching: question.matching,
        subparts: question.subparts,
        response: question.response,
        annotations: question.annotations,
        visualId: question.visual?.id ?? null,
        visualAltText: question.visual?.altText ?? null,
        visualScale: question.visualScale,
        keepTogether: question.keepTogether,
      })),
    })),
  }
}
