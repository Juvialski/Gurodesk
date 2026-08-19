import type { AssessmentBlueprint, AssessmentItem, QuestionType } from '../../types/assessment'
import type { AnswerSheetCompatibilitySummary, AnswerSheetQuestionTypeCompatibility } from '../../types/answerSheet'

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  multiple_select: 'Multiple Select',
  matching: 'Matching Type',
  identification: 'Identification',
  fill_in_the_blank: 'Fill in the Blank',
  numerical_answer: 'Numerical Answer',
  short_answer: 'Short Answer',
  problem_solving: 'Problem Solving',
  constructed_response: 'Constructed Response',
  essay: 'Essay',
}

/**
 * Determines whether a specific question type is immediately machine-scannable via local OMR.
 */
export function isQuestionTypeMachineCheckable(questionType: QuestionType): boolean {
  switch (questionType) {
    case 'multiple_choice':
    case 'true_false':
    case 'multiple_select':
    case 'matching':
      return true
    case 'identification':
    case 'fill_in_the_blank':
    case 'numerical_answer':
    case 'short_answer':
    case 'problem_solving':
    case 'constructed_response':
    case 'essay':
    default:
      return false
  }
}

function itemPoints(item: AssessmentItem): number {
  const points = Number(item.pointsPossible ?? item.points ?? 1)
  return Number.isFinite(points) && points > 0 ? points : 1
}

/**
 * Computes a detailed Smart Answer Sheet compatibility summary for an assessment blueprint.
 */
export function calculateAnswerSheetCompatibility(
  assessment: Pick<AssessmentBlueprint, 'items' | 'totalItems'>,
): AnswerSheetCompatibilitySummary {
  const items = assessment.items ?? []
  const totalQuestions = items.length

  let machineCheckableCount = 0
  let manualScoringCount = 0
  let machineCheckablePoints = 0
  let manualScoringPoints = 0
  let totalPoints = 0

  const countByType = new Map<QuestionType, { count: number; points: number }>()

  for (const item of items) {
    const qType = item.questionType
    const points = itemPoints(item)
    totalPoints += points

    const isMachine = isQuestionTypeMachineCheckable(qType)
    if (isMachine) {
      machineCheckableCount++
      machineCheckablePoints += points
    } else {
      manualScoringCount++
      manualScoringPoints += points
    }

    const current = countByType.get(qType) ?? { count: 0, points: 0 }
    countByType.set(qType, { count: current.count + 1, points: current.points + points })
  }

  const typesBreakdown: AnswerSheetQuestionTypeCompatibility[] = Array.from(countByType.entries()).map(([qType, data]) => ({
    questionType: qType,
    label: QUESTION_TYPE_LABELS[qType] || qType,
    count: data.count,
    isMachineCheckable: isQuestionTypeMachineCheckable(qType),
    scoringHandling: isQuestionTypeMachineCheckable(qType) ? 'automatic_omr' : 'manual_teacher_scoring',
  }))

  // Sort breakdown: machine-checkable first, then by count descending
  typesBreakdown.sort((a, b) => {
    if (a.isMachineCheckable !== b.isMachineCheckable) {
      return a.isMachineCheckable ? -1 : 1
    }
    return b.count - a.count
  })

  const machineCheckablePercentage = totalQuestions > 0
    ? Math.round((machineCheckableCount / totalQuestions) * 100)
    : 0

  const isFullyMachineCheckable = totalQuestions > 0 && manualScoringCount === 0
  // An assessment is scan-ready if it has items and at least 50% are machine-checkable (or at least 1 machine-checkable question)
  const isScanReady = totalQuestions > 0 && machineCheckableCount > 0

  return {
    totalQuestions,
    totalPoints,
    machineCheckableCount,
    manualScoringCount,
    machineCheckablePoints,
    manualScoringPoints,
    machineCheckablePercentage,
    isFullyMachineCheckable,
    isScanReady,
    typesBreakdown,
  }
}
