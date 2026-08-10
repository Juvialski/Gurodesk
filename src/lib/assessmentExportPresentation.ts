import type { QuestionType } from '../types/assessment'
import type { AssessmentExportQuestion } from '../types/assessmentExport'

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
  if (question.questionType === 'short_answer') return points > 2 ? 2 : 1
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
