import type { AssessmentAnswer, AssessmentBlueprint } from '../types/assessment'
import type {
  AssessmentResultSession,
  LearnerItemAnswer,
  ResultAssessmentItemSnapshot,
  ResultAssessmentSnapshot,
  ResultItemOutcome,
  ResultScoringSource,
  ShortAnswerScoringConfig,
  ShortAnswerScoringMode,
} from '../types/results'

/**
 * Results scoring is deliberately a pure, deterministic module. It never calls
 * a model, reads learner identity from outside its arguments, or treats a
 * constructed response as objectively correct.
 */

export type ScoreItemInput = {
  resultSessionId: string
  participantId: string
  learnerId: string
  item: ResultAssessmentItemSnapshot
  answer: LearnerItemAnswer | null
  /** Required for teacher-scored constructed responses and manual short answers. */
  awardedPoints?: number | null
  teacherFeedback?: string | null
  shortAnswerMode?: ShortAnswerScoringMode
  outcomeId?: string
  now?: string
}

export type ObjectiveScore = {
  isCorrect: boolean | null
  earnedPoints: number
  scoringSource: ResultScoringSource
  reason: 'omitted' | 'deterministic' | 'manual'
}

export type ResultTotals = {
  rawScore: number
  possiblePoints: number
  percentage: number | null
  attemptedItems: number
  omittedItems: number
  correctItems: number
  incorrectItems: number
  teacherScoredItems: number
  deterministicItems: number
}

/**
 * Round at the domain boundary so binary floating point never leaks into
 * saved totals or rendered values. Six places preserve common fractional-point
 * rubrics; percentage values are rounded separately to two places.
 */
export function roundScore(value: number, decimalPlaces = 6): number {
  if (!Number.isFinite(value)) return 0
  const places = Number.isSafeInteger(decimalPlaces) && decimalPlaces >= 0 && decimalPlaces <= 12 ? decimalPlaces : 6
  const factor = 10 ** places
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatScore(value: number | null | undefined, decimalPlaces = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return roundScore(value, decimalPlaces).toFixed(decimalPlaces).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function finiteNonnegative(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

/** Conservative normalization used only when a teacher explicitly enables it. */
export function normalizeShortAnswer(value: string, caseSensitive: boolean | undefined): string {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
  return caseSensitive === true ? normalized : normalized.toLocaleLowerCase('en-US')
}

function answerIsObjectiveCorrect(
  item: ResultAssessmentItemSnapshot,
  answer: LearnerItemAnswer,
  shortAnswerMode: ShortAnswerScoringMode,
): boolean | null {
  const expected: AssessmentAnswer = item.answer
  if (item.questionType === 'multiple_choice' && expected.type === 'multiple_choice' && answer.type === 'multiple_choice') {
    return expected.choiceId === answer.choiceId
  }
  if (item.questionType === 'true_false' && expected.type === 'true_false' && answer.type === 'true_false') {
    return expected.value === answer.value
  }
  if (item.questionType === 'short_answer' && expected.type === 'short_answer' && answer.type === 'short_answer') {
    if (shortAnswerMode !== 'normalized_exact') return null
    const learnerText = normalizeShortAnswer(answer.text, expected.caseSensitive)
    return expected.acceptedAnswers.some((accepted) => normalizeShortAnswer(accepted, expected.caseSensitive) === learnerText)
  }
  // Constructed responses and malformed type pairs are not objective facts.
  return item.questionType === 'constructed_response' ? null : false
}

export function scoreObjectiveAnswer(
  item: ResultAssessmentItemSnapshot,
  answer: LearnerItemAnswer | null,
  shortAnswerMode: ShortAnswerScoringMode = 'manual',
): ObjectiveScore {
  const points = roundScore(finiteNonnegative(item.points), 6)
  if (!answer) return { isCorrect: null, earnedPoints: 0, scoringSource: 'deterministic', reason: 'omitted' }

  if (item.questionType === 'constructed_response') {
    return { isCorrect: null, earnedPoints: 0, scoringSource: 'teacher', reason: 'manual' }
  }
  if (item.questionType === 'short_answer' && shortAnswerMode !== 'normalized_exact') {
    return { isCorrect: null, earnedPoints: 0, scoringSource: 'teacher', reason: 'manual' }
  }
  const isCorrect = answerIsObjectiveCorrect(item, answer, shortAnswerMode)
  return {
    isCorrect,
    earnedPoints: isCorrect === true ? points : 0,
    scoringSource: 'deterministic',
    reason: 'deterministic',
  }
}

function teacherPoints(item: ResultAssessmentItemSnapshot, awardedPoints: number | null | undefined) {
  const possible = finiteNonnegative(item.points)
  const entered = finiteNonnegative(awardedPoints)
  return roundScore(Math.min(entered, possible), 6)
}

/** Score one outcome without network access or implicit semantic matching. */
export function scoreResultItem(input: ScoreItemInput): ResultItemOutcome {
  const itemPoints = roundScore(finiteNonnegative(input.item.points), 6)
  const answer = input.answer ?? null
  const mode = input.shortAnswerMode ?? 'manual'
  const objective = scoreObjectiveAnswer(input.item, answer, mode)
  const isTeacherScored = input.item.questionType === 'constructed_response' ||
    (input.item.questionType === 'short_answer' && mode !== 'normalized_exact')
  // An empty teacher-scored cell is still omitted. The UI may use a typed
  // answer object with no stored response text to record that a paper response
  // was attempted and then enter authoritative points.
  const earnedPoints = isTeacherScored && answer !== null
    ? teacherPoints(input.item, input.awardedPoints)
    : objective.earnedPoints
  const isCorrect = isTeacherScored ? null : objective.isCorrect
  const scoringSource: ResultScoringSource = isTeacherScored ? 'teacher' : objective.scoringSource
  return {
    id: input.outcomeId ?? `${input.resultSessionId}:${input.participantId}:${input.item.id}`,
    resultSessionId: input.resultSessionId,
    participantId: input.participantId,
    learnerId: input.learnerId,
    itemId: input.item.id,
    itemNumber: input.item.itemNumber,
    answer,
    isCorrect,
    earnedPoints: roundScore(earnedPoints, 6),
    possiblePoints: itemPoints,
    teacherFeedback: input.teacherFeedback ?? null,
    scoringSource,
    updatedAt: input.now ?? new Date().toISOString(),
  }
}

/** Score a complete answer sheet in memory; callers can bulk-save the result. */
export function scoreAnswerSheet(
  session: Pick<AssessmentResultSession, 'id' | 'shortAnswerScoring'>,
  learner: { participantId: string; learnerId: string },
  answers: ReadonlyMap<string, LearnerItemAnswer | null> | Record<string, LearnerItemAnswer | null>,
  items: readonly ResultAssessmentItemSnapshot[],
  teacherPointsByItem: ReadonlyMap<string, number | null> | Record<string, number | null> = {},
  now?: string,
): ResultItemOutcome[] {
  const getAnswer = (itemId: string) => typeof (answers as ReadonlyMap<string, LearnerItemAnswer | null>).get === 'function'
    ? ((answers as ReadonlyMap<string, LearnerItemAnswer | null>).get(itemId) ?? null)
    : ((answers as Record<string, LearnerItemAnswer | null>)[itemId] ?? null)
  const getPoints = (itemId: string) => typeof (teacherPointsByItem as ReadonlyMap<string, number | null>).get === 'function'
    ? (teacherPointsByItem as ReadonlyMap<string, number | null>).get(itemId)
    : (teacherPointsByItem as Record<string, number | null>)[itemId]
  return [...items]
    .sort((left, right) => left.itemNumber - right.itemNumber || left.id.localeCompare(right.id, 'en'))
    .map((item) => scoreResultItem({
      resultSessionId: session.id,
      participantId: learner.participantId,
      learnerId: learner.learnerId,
      item,
      answer: getAnswer(item.id),
      awardedPoints: getPoints(item.id),
      shortAnswerMode: session.shortAnswerScoring.itemModes[item.id] ?? session.shortAnswerScoring.defaultMode,
      now,
    }))
}

/**
 * Add scores after normalizing each contribution. This avoids common 0.1 +
 * 0.2 display artifacts while retaining fractional-point rubrics.
 */
export function calculateResultTotals(
  outcomes: readonly Pick<ResultItemOutcome, 'earnedPoints' | 'possiblePoints' | 'answer' | 'isCorrect' | 'scoringSource'>[],
  possiblePointsOverride?: number | null,
): ResultTotals {
  let rawScore = 0
  let possiblePoints = 0
  let attemptedItems = 0
  let omittedItems = 0
  let correctItems = 0
  let incorrectItems = 0
  let teacherScoredItems = 0
  let deterministicItems = 0
  for (const outcome of outcomes) {
    rawScore = roundScore(rawScore + finiteNonnegative(outcome.earnedPoints), 6)
    possiblePoints = roundScore(possiblePoints + finiteNonnegative(outcome.possiblePoints), 6)
    if (outcome.answer === null || outcome.answer === undefined) omittedItems += 1
    else attemptedItems += 1
    if (outcome.isCorrect === true) correctItems += 1
    if (outcome.isCorrect === false) incorrectItems += 1
    if (outcome.scoringSource === 'teacher') teacherScoredItems += 1
    else deterministicItems += 1
  }
  if (possiblePointsOverride !== null && possiblePointsOverride !== undefined && Number.isFinite(possiblePointsOverride)) {
    possiblePoints = roundScore(Math.max(0, possiblePointsOverride), 6)
  }
  const percentage = possiblePoints > 0 ? roundScore((rawScore / possiblePoints) * 100, 2) : null
  return { rawScore, possiblePoints, percentage, attemptedItems, omittedItems, correctItems, incorrectItems, teacherScoredItems, deterministicItems }
}

export function calculateScoreOnlyTotals(rawScore: number | null, possiblePoints: number): ResultTotals {
  const possible = roundScore(finiteNonnegative(possiblePoints), 6)
  const raw = rawScore === null || rawScore === undefined ? 0 : roundScore(Math.min(Math.max(0, finiteNonnegative(rawScore)), possible), 6)
  return {
    rawScore: raw,
    possiblePoints: possible,
    percentage: possible > 0 ? roundScore((raw / possible) * 100, 2) : null,
    attemptedItems: 0,
    omittedItems: 0,
    correctItems: 0,
    incorrectItems: 0,
    teacherScoredItems: 0,
    deterministicItems: 0,
  }
}

/** Score-only entry intentionally cannot produce item-level analysis. */
export function canProduceItemAnalysis(entryMode: AssessmentResultSession['entryMode']): boolean {
  return entryMode !== 'score_only'
}

/** Convert a finalized assessment into the immutable result-session snapshot. */
export function buildResultAssessmentSnapshot(assessment: AssessmentBlueprint): ResultAssessmentSnapshot {
  if (assessment.status !== 'final') throw new Error('Only finalized assessments can create result sessions.')
  if (!assessment.assignmentId) throw new Error('A finalized assessment must belong to a teaching assignment.')
  const items = [...assessment.items]
    .sort((left, right) => left.itemNumber - right.itemNumber || left.id.localeCompare(right.id, 'en'))
    .map((item) => ({
      id: item.id,
      itemNumber: item.itemNumber,
      prompt: item.prompt,
      questionType: item.questionType,
      answer: clone(item.answer),
      points: roundScore(finiteNonnegative(item.points ?? 1), 6),
      competencySnapshot: clone(item.competencySnapshot),
      cognitiveCategorySnapshot: clone(item.cognitiveCategorySnapshot),
      mapping: clone(item.mapping),
    }))
  const totalPossiblePoints = roundScore(items.reduce((sum, item) => sum + item.points, 0), 6)
  return {
    assessmentId: assessment.id,
    assessmentVersionNumber: assessment.versionNumber,
    assessmentTitle: assessment.title,
    assignmentId: assessment.assignmentId,
    gradeLevel: assessment.gradeLevel,
    learningArea: assessment.learningArea,
    schoolYear: assessment.schoolYear,
    gradingTermId: assessment.gradingTermId,
    gradingTermLabel: assessment.gradingTermLabel,
    curriculumPeriodIds: [...assessment.curriculumPeriodIds],
    curriculumPeriodLabels: [...assessment.curriculumPeriodLabels],
    totalItems: items.length,
    totalPossiblePoints,
    items,
  }
}

/** Read the explicit per-item short-answer mode without mutating caller state. */
export function shortAnswerModeForItem(config: ShortAnswerScoringConfig, itemId: string): ShortAnswerScoringMode {
  return config.itemModes[itemId] ?? config.defaultMode
}
