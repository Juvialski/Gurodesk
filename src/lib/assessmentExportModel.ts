import type { Assessment, AssessmentItem } from '../types/assessment'
import type {
  AssessmentAnswerKeyExportQuestion,
  AssessmentExportLabels,
  AssessmentExportModel,
  AssessmentExportOptions,
  AssessmentExportQuestionBase,
  AssessmentStudentExportQuestion,
  AssessmentTeacherExportQuestion,
} from '../types/assessmentExport'

function clean(value: string | null | undefined) { return (value ?? '').trim() }

const ENGLISH_LABELS: AssessmentExportLabels = {
  documentTitle: 'ASSESSMENT', teacher: 'Teacher', school: 'School', gradeLevel: 'Grade Level', learningArea: 'Learning Area', schoolYear: 'School Year', gradingTerm: 'Grading Term', curriculumPeriods: 'Curriculum Periods', learnerName: 'Learner Name', section: 'Section', instructions: 'Instructions', answer: 'Answer', answerKey: 'ANSWER KEY', competency: 'Competency', cognitiveCategory: 'Cognitive Category', rationale: 'Rationale', points: 'Points', choicePrefix: 'Choice', responseLine: 'Response',
}

const FILIPINO_LABELS: AssessmentExportLabels = {
  documentTitle: 'PAGTATAYA', teacher: 'Guro', school: 'Paaralan', gradeLevel: 'Baitang', learningArea: 'Larangan ng Pagkatuto', schoolYear: 'Taong Panuruan', gradingTerm: 'Termino ng Pagmamarka', curriculumPeriods: 'Panahon sa Kurikulum', learnerName: 'Pangalan ng Mag-aaral', section: 'Seksyon', instructions: 'Panuto', answer: 'Sagot', answerKey: 'SUSI NG SAGOT', competency: 'Kasanayan', cognitiveCategory: 'Kategoryang Kognitibo', rationale: 'Paliwanag', points: 'Puntos', choicePrefix: 'Pagpipilian', responseLine: 'Sagot',
}

function looksFilipino(text: string) {
  const normalized = ` ${text.toLocaleLowerCase().replace(/[^a-záéíóúñ\s-]/g, ' ')} `
  const markers = [' ang ', ' mga ', ' ng ', ' sa ', ' ay ', ' upang ', ' mag-aaral', ' aralin', ' gawain', ' pagkatuto', ' sagot', ' panuto']
  return markers.reduce((score, marker) => score + (normalized.includes(marker) ? 1 : 0), 0) >= 3
}

function resolveLanguage(assessment: Assessment, options: AssessmentExportOptions) {
  if (options.documentLanguage === 'filipino') return 'filipino'
  if (options.documentLanguage === 'english') return 'english'
  const authored = [assessment.title, assessment.instructions, ...assessment.items.map((item) => item.prompt)].filter(Boolean).join('\n')
  return looksFilipino(authored) ? 'filipino' : 'english'
}

function choicesFor(item: AssessmentItem) {
  return item.answer.type === 'multiple_choice' ? item.answer.choices.map((choice) => ({ id: choice.id, text: choice.text })) : []
}

function answerSpaceLines(item: AssessmentItem) {
  if (item.questionType === 'multiple_choice') return 0
  if (item.questionType === 'true_false') return 1
  if (item.questionType === 'short_answer') return 2
  return 5
}

function baseQuestion(item: AssessmentItem): AssessmentExportQuestionBase {
  return {
    itemNumber: item.itemNumber,
    prompt: item.prompt,
    questionType: item.questionType,
    choices: choicesFor(item),
    answerSpaceLines: answerSpaceLines(item),
    points: item.points,
  }
}

function studentQuestion(item: AssessmentItem): AssessmentStudentExportQuestion {
  const base = baseQuestion(item)
  return { ...base, choices: base.choices.map((choice) => choice.text) }
}

function teacherQuestion(item: AssessmentItem, options: AssessmentExportOptions): AssessmentTeacherExportQuestion {
  const includeAnswer = options.includeAnswer !== false
  return {
    ...baseQuestion(item),
    ...(includeAnswer ? { answer: item.answer } : {}),
    ...(options.includeCompetency ? { competency: item.competencySnapshot } : {}),
    ...(options.includeCognitiveCategory ? { cognitiveCategory: item.cognitiveCategorySnapshot } : {}),
    ...(options.includeRationale && item.rationale?.trim() ? { rationale: item.rationale } : {}),
  }
}

function answerKeyQuestion(item: AssessmentItem): AssessmentAnswerKeyExportQuestion {
  // The answer key is derived directly from the structured answer union. It
  // never asks an AI service to infer or rewrite a correct response.
  return { itemNumber: item.itemNumber, questionType: item.questionType, answerSpaceLines: 0, points: item.points, answer: item.answer }
}

export function buildAssessmentExportModel(assessment: Assessment, options: AssessmentExportOptions): AssessmentExportModel {
  const language = resolveLanguage(assessment, options)
  const labels = language === 'filipino' ? FILIPINO_LABELS : ENGLISH_LABELS
  const mode = options.mode
  const title = clean(assessment.title) || labels.documentTitle
  const documentTitle = mode === 'answer_key' ? labels.answerKey : labels.documentTitle
  const questions = mode === 'student'
    ? assessment.items.map(studentQuestion)
    : mode === 'answer_key'
      ? assessment.items.map(answerKeyQuestion)
      : assessment.items.map((item) => teacherQuestion(item, options))
  return {
    mode,
    language,
    labels: { ...labels, documentTitle },
    status: assessment.status,
    title,
    instructions: mode === 'answer_key' ? '' : assessment.instructions,
    metadata: {
      teacherName: clean(options.teacherName),
      positionTitle: clean(options.positionTitle),
      schoolName: clean(options.schoolName),
      region: clean(options.region),
      division: clean(options.division),
      ...(mode !== 'answer_key' ? { learnerName: clean(options.learnerName), section: clean(options.section) } : {}),
      gradeLevel: clean(assessment.gradeLevel),
      learningArea: clean(assessment.learningArea),
      schoolYear: clean(assessment.schoolYear),
      gradingTerm: clean(assessment.gradingTermLabel),
      ...(mode === 'teacher' ? { curriculumPeriods: assessment.curriculumPeriodLabels.map(clean).filter(Boolean).join(', ') } : {}),
    },
    questions,
  }
}

export function buildAssessmentStudentExportModel(assessment: Assessment, options: Omit<AssessmentExportOptions, 'mode'> = {}) {
  return buildAssessmentExportModel(assessment, { ...options, mode: 'student' })
}

export function buildAssessmentTeacherExportModel(assessment: Assessment, options: Omit<AssessmentExportOptions, 'mode'> = {}) {
  return buildAssessmentExportModel(assessment, { ...options, mode: 'teacher' })
}

export function buildAssessmentAnswerKeyExportModel(assessment: Assessment, options: Omit<AssessmentExportOptions, 'mode'> = {}) {
  return buildAssessmentExportModel(assessment, { ...options, mode: 'answer_key' })
}
