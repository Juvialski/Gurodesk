import type {
  AssessmentAnswer,
  AssessmentBlueprint,
  AssessmentItem,
  AssessmentMultipleSelectAnswer,
  AssessmentNumericalAnswer,
  AssessmentShortAnswer,
  QuestionType,
} from '../types/assessment'

/** Keep persisted scores predictable across JSON, Postgres numeric, and UI math. */
export function roundAssessmentScore(value: number, decimals = 6) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Existing Phase 4.1 records use `points`; newer records use
 * `pointsPossible`.  This helper is deliberately tolerant at the boundary,
 * while all newly-created/normalized records receive the canonical field.
 */
export function normalizeItemPoints(item: Pick<AssessmentItem, 'pointsPossible' | 'points'> | Partial<AssessmentItem>) {
  // Missing legacy values default to one.  Explicit zero/negative values are
  // preserved so final validation can reject them instead of silently healing
  // invalid teacher data.
  const raw: unknown = item.pointsPossible ?? item.points
  if (raw === null || raw === undefined || raw === '') return 1
  const candidate = Number(raw)
  return Number.isFinite(candidate) ? roundAssessmentScore(candidate, 2) : Number.NaN
}

export function pointsPossibleForItem(item: Pick<AssessmentItem, 'pointsPossible' | 'points'> | Partial<AssessmentItem>) {
  const value = normalizeItemPoints(item)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function deriveAssessmentTotalPoints(items: readonly (Pick<AssessmentItem, 'pointsPossible' | 'points'> | Partial<AssessmentItem>)[]) {
  return roundAssessmentScore(items.reduce((sum, item) => sum + pointsPossibleForItem(item), 0), 2)
}

export function assessmentTotalPoints(assessment: Pick<AssessmentBlueprint, 'items'>) {
  return deriveAssessmentTotalPoints(assessment.items)
}

export function assessmentPointDelta(assessment: Pick<AssessmentBlueprint, 'items'>, targetTotalPoints: number | null | undefined) {
  const target = Number(targetTotalPoints)
  const current = assessmentTotalPoints(assessment)
  if (!Number.isFinite(target)) return null
  return roundAssessmentScore(target - current, 2)
}

export function pointsByQuestionType(items: readonly AssessmentItem[]) {
  return items.reduce<Partial<Record<QuestionType, number>>>((totals, item) => {
    totals[item.questionType] = roundAssessmentScore((totals[item.questionType] ?? 0) + pointsPossibleForItem(item), 2)
    return totals
  }, {})
}

export function itemCountByQuestionType(items: readonly AssessmentItem[]) {
  return items.reduce<Partial<Record<QuestionType, number>>>((counts, item) => {
    counts[item.questionType] = (counts[item.questionType] ?? 0) + 1
    return counts
  }, {})
}

export function clampEarnedPoints(pointsEarned: number, pointsPossible: number) {
  const possible = Math.max(0, Number(pointsPossible) || 0)
  const earned = Number(pointsEarned)
  if (!Number.isFinite(earned)) return 0
  return roundAssessmentScore(Math.min(possible, Math.max(0, earned)), 6)
}

function normalizedText(value: unknown, caseSensitive = false) {
  const text = String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
  return caseSensitive ? text : text.toLocaleLowerCase('en')
}

function acceptedText(value: unknown, accepted: string[], caseSensitive = false) {
  const candidate = normalizedText(value, caseSensitive)
  return accepted.some((answer) => normalizedText(answer, caseSensitive) === candidate)
}

function numericResponse(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  if (value && typeof value === 'object' && 'value' in value) return numericResponse((value as { value?: unknown }).value)
  return null
}

function responseUnit(value: unknown) {
  return value && typeof value === 'object' && 'unit' in value ? String((value as { unit?: unknown }).unit ?? '').trim() : ''
}

function exactSet(values: unknown[], expected: string[]) {
  const actual = [...new Set(values.map((value) => String(value)))]
  return actual.length === expected.length && actual.every((value) => expected.includes(value))
}

export type AssessmentResponseScore = {
  pointsEarned: number | null
  pointsPossible: number
  isCorrect: boolean | null
  scoringSource: 'automatic' | 'teacher' | 'unscored'
  matchedParts?: number
  totalParts?: number
}

export type AssessmentResponseScoreInput = {
  item: AssessmentItem
  response: unknown
  /** Teacher-awarded points are authoritative for subjective formats. */
  teacherPoints?: number | null
}

/**
 * Deterministic objective scoring.  Subjective formats intentionally remain
 * teacher-scored; this helper never asks a model to award final points.
 */
export function scoreAssessmentResponse(input: AssessmentResponseScoreInput): AssessmentResponseScore {
  const item = input.item
  const possible = pointsPossibleForItem(item)
  const answer = item.answer
  const value = input.response

  if (input.teacherPoints !== undefined && input.teacherPoints !== null) {
    const earned = clampEarnedPoints(input.teacherPoints, possible)
    return { pointsEarned: earned, pointsPossible: possible, isCorrect: earned === possible, scoringSource: 'teacher' }
  }

  if (item.questionType === 'multiple_choice' && answer.type === 'multiple_choice') {
    const selected = value && typeof value === 'object' && 'choiceId' in value ? String((value as { choiceId?: unknown }).choiceId ?? '') : String(value ?? '')
    const correct = selected === answer.choiceId
    return { pointsEarned: correct ? possible : 0, pointsPossible: possible, isCorrect: correct, scoringSource: 'automatic' }
  }
  if (item.questionType === 'true_false' && answer.type === 'true_false') {
    const selected = value && typeof value === 'object' && 'value' in value ? (value as { value?: unknown }).value : value
    const correct = typeof selected === 'boolean' && selected === answer.value
    return { pointsEarned: correct ? possible : 0, pointsPossible: possible, isCorrect: correct, scoringSource: 'automatic' }
  }
  if ((item.questionType === 'short_answer' && answer.type === 'short_answer') || (item.questionType === 'identification' && answer.type === 'identification')) {
    const correct = acceptedText(value, answer.acceptedAnswers, answer.caseSensitive === true)
    return { pointsEarned: correct ? possible : 0, pointsPossible: possible, isCorrect: correct, scoringSource: 'automatic' }
  }
  if (item.questionType === 'numerical_answer' && answer.type === 'numerical_answer') {
    const actual = numericResponse(value)
    const tolerance = Number(answer.tolerance ?? 0)
    const within = actual !== null && Math.abs(actual - answer.value) <= (Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 0)
    const unitOkay = !answer.requireUnit || normalizedText(responseUnit(value)) === normalizedText(answer.unit ?? '')
    const correct = Boolean(within && unitOkay)
    return { pointsEarned: correct ? possible : 0, pointsPossible: possible, isCorrect: correct, scoringSource: 'automatic' }
  }
  if (item.questionType === 'fill_in_the_blank' && answer.type === 'fill_in_the_blank') {
    const values = Array.isArray(value) ? value : value && typeof value === 'object' ? answer.blanks.map((blank) => (value as Record<string, unknown>)[blank.id]) : []
    let earned = 0
    let matched = 0
    answer.blanks.forEach((blank, index) => {
      const blankPoints = Number(blank.pointsPossible ?? possible / Math.max(answer.blanks.length, 1))
      if (acceptedText(values[index], blank.acceptedAnswers, blank.caseSensitive === true)) {
        earned += blankPoints
        matched += 1
      }
    })
    const normalizedEarned = clampEarnedPoints(earned, possible)
    return { pointsEarned: normalizedEarned, pointsPossible: possible, isCorrect: normalizedEarned === possible, scoringSource: 'automatic', matchedParts: matched, totalParts: answer.blanks.length }
  }
  if (item.questionType === 'matching' && answer.type === 'matching') {
    const responseMap = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    let earned = 0
    let matched = 0
    const usedChoices = new Set<string>()
    answer.mappings.forEach((mapping) => {
      const selected = String(responseMap[mapping.promptId] ?? '')
      const points = Number(mapping.pointsPossible ?? answer.pointsPerMatch ?? possible / Math.max(answer.mappings.length, 1))
      const duplicateUse = !answer.reusableChoices && usedChoices.has(selected)
      if (selected === mapping.choiceId && !duplicateUse) {
        earned += points
        matched += 1
      }
      if (selected) usedChoices.add(selected)
    })
    const normalizedEarned = clampEarnedPoints(earned, possible)
    return { pointsEarned: normalizedEarned, pointsPossible: possible, isCorrect: normalizedEarned === possible, scoringSource: 'automatic', matchedParts: matched, totalParts: answer.mappings.length }
  }
  if (item.questionType === 'multiple_select' && answer.type === 'multiple_select') {
    const selected = Array.isArray(value) ? value : value && typeof value === 'object' && 'choiceIds' in value ? (value as { choiceIds?: unknown[] }).choiceIds ?? [] : []
    const correct = exactSet(selected, answer.choiceIds)
    return { pointsEarned: correct ? possible : 0, pointsPossible: possible, isCorrect: correct, scoringSource: 'automatic' }
  }

  // Problem solving, constructed response, and essay require teacher review.
  return { pointsEarned: null, pointsPossible: possible, isCorrect: null, scoringSource: 'unscored' }
}

export const deriveTotalPoints = deriveAssessmentTotalPoints
export const getAssessmentTotalPoints = assessmentTotalPoints
export const getItemPointsPossible = pointsPossibleForItem

// Keep this import-time assertion visible to future maintainers: the answer
// union includes a multi-select shape and the scorer deliberately handles it
// without pretending subjective response formats are objective.
void ({} as AssessmentMultipleSelectAnswer | AssessmentNumericalAnswer | AssessmentShortAnswer | AssessmentAnswer)
