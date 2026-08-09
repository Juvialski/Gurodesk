import type {
  AssessmentResultSession,
  LearnerItemAnswer,
  ResultAssessmentItemSnapshot,
  ResultItemOutcome,
  ScoreOnlyOutcome,
} from '../types/results'
import type {
  ItemAnalysisAggregate,
  ItemAnalysisClassSummary,
  ItemAnalysisDiscrimination,
  ItemAnalysisInput,
  ItemAnalysisItem,
  ItemAnalysisOption,
  ItemAnalysisResult,
  LearnerAnalysisSummary,
  PercentageDistributionBin,
} from '../types/itemAnalysis'

// Keep analysis deterministic and independently loadable by the repository's
// lightweight validation harness. Legacy snapshots may only contain `points`;
// missing denominators safely retain the Phase 5 one-point default.
function itemPossiblePoints(item: Pick<ResultAssessmentItemSnapshot, 'points' | 'pointsPossible'>): number {
  const raw = item.pointsPossible ?? item.points ?? 1
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 1
}

const DEFAULT_MINIMUM_DISCRIMINATION_SAMPLE_SIZE = 10

type Participant = AssessmentResultSession['learners'][number]
type OutcomeMap = Map<string, ResultItemOutcome>

type ItemMetrics = {
  item: ResultAssessmentItemSnapshot
  attempted: number
  correct: number
  incorrect: number
  omitted: number
  percentageCorrect: number | null
  earnedPoints: number
  pointsPossibleForAttempted: number
  pointsPossibleForAll: number
  averageEarnedPoints: number | null
  pointFacility: number | null
  options: ItemAnalysisOption[]
  invalidOptionCount: number
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nonNegativeNumber(value: unknown, fallback = 0) {
  return finiteNumber(value) && value >= 0 ? value : fallback
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null
}

function answerPresent(answer: LearnerItemAnswer | null) {
  return answer !== null
}

function participantKey(participantId: string, itemId: string) {
  return `${participantId}::${itemId}`
}

function extractSession(input: ItemAnalysisInput): { session: AssessmentResultSession; outcomes?: ResultItemOutcome[] } {
  if ('session' in input) return input
  return { session: input }
}

function selectedParticipants(session: AssessmentResultSession, participantIds?: string[]) {
  if (!participantIds) return [...session.learners]
  const selected = new Set(participantIds)
  return session.learners.filter((learner) => selected.has(learner.participantId))
}

function buildOutcomeMap(
  session: AssessmentResultSession,
  participants: Participant[],
  outcomes: ResultItemOutcome[],
) {
  const participantIds = new Set(participants.map((participant) => participant.participantId))
  const itemIds = new Set(session.assessmentSnapshot.items.map((item) => item.id))
  const result: OutcomeMap = new Map()
  for (const outcome of outcomes) {
    if (!participantIds.has(outcome.participantId) || !itemIds.has(outcome.itemId)) continue
    const key = participantKey(outcome.participantId, outcome.itemId)
    const previous = result.get(key)
    // A draft can contain a duplicate from an interrupted import. The latest
    // timestamp wins, keeping analysis deterministic without double counting.
    if (!previous
      || String(outcome.updatedAt) > String(previous.updatedAt)
      || (String(outcome.updatedAt) === String(previous.updatedAt) && outcome.id.localeCompare(previous.id, 'en') >= 0)) result.set(key, outcome)
  }
  return result
}

function outcomeFor(map: OutcomeMap, participantId: string, itemId: string) {
  return map.get(participantKey(participantId, itemId))
}

function choiceInfo(item: ResultAssessmentItemSnapshot) {
  if (item.answer.type !== 'multiple_choice') return []
  return item.answer.choices
}

function computeItemMetrics(
  item: ResultAssessmentItemSnapshot,
  participants: Participant[],
  outcomes: OutcomeMap,
): ItemMetrics {
  let attempted = 0
  let correct = 0
  let incorrect = 0
  let omitted = 0
  let earnedPoints = 0
  let pointsPossibleForAttempted = 0
  let pointsPossibleForAll = 0
  const choices = choiceInfo(item)
  const choiceCounts = new Map(choices.map((choice) => [choice.id, 0]))
  let invalidOptionCount = 0

  for (const participant of participants) {
    pointsPossibleForAll += itemPossiblePoints(item)
    const outcome = outcomeFor(outcomes, participant.participantId, item.id)
    if (!outcome || !answerPresent(outcome.answer)) {
      omitted += 1
      continue
    }
    attempted += 1
    const earned = nonNegativeNumber(outcome.earnedPoints)
    earnedPoints += earned
    pointsPossibleForAttempted += itemPossiblePoints(item)
    if (outcome.isCorrect === true) correct += 1
    else if (outcome.isCorrect === false) incorrect += 1

    if (item.questionType === 'multiple_choice') {
      if (outcome.answer.type === 'multiple_choice' && choiceCounts.has(outcome.answer.choiceId)) {
        choiceCounts.set(outcome.answer.choiceId, (choiceCounts.get(outcome.answer.choiceId) ?? 0) + 1)
      } else {
        invalidOptionCount += 1
      }
    }
  }

  const correctnessDenominator = correct + incorrect
  const options: ItemAnalysisOption[] = choices.map((choice) => ({
    choiceId: choice.id,
    label: choice.text,
    count: choiceCounts.get(choice.id) ?? 0,
    // The denominator includes attempted responses with an unrecognised
    // choice, making a malformed/imported response visible rather than hiding it.
    percentage: percentage(choiceCounts.get(choice.id) ?? 0, attempted),
    correct: choice.id === (item.answer.type === 'multiple_choice' ? item.answer.choiceId : ''),
    distractorSignal: choice.id !== (item.answer.type === 'multiple_choice' ? item.answer.choiceId : '')
      && attempted > 0 && (choiceCounts.get(choice.id) ?? 0) === 0 ? 'unselected' : null,
    distractorSignalReason: choice.id !== (item.answer.type === 'multiple_choice' ? item.answer.choiceId : '')
      && attempted > 0 && (choiceCounts.get(choice.id) ?? 0) === 0
      ? 'No attempted response selected this incorrect option. This is an advisory review signal, not proof that the item is defective.'
      : null,
  }))

  return {
    item,
    attempted,
    correct,
    incorrect,
    omitted,
    percentageCorrect: percentage(correct, correctnessDenominator),
    earnedPoints,
    pointsPossibleForAttempted,
    averageEarnedPoints: percentage(earnedPoints, attempted),
    pointFacility: percentage(earnedPoints, pointsPossibleForAttempted),
    pointsPossibleForAll,
    options,
    invalidOptionCount,
  }
}

function pearson(xs: number[], ys: number[]) {
  if (xs.length !== ys.length || xs.length < 2) return null
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length
  let covariance = 0
  let xVariance = 0
  let yVariance = 0
  for (let index = 0; index < xs.length; index += 1) {
    const xDelta = xs[index] - xMean
    const yDelta = ys[index] - yMean
    covariance += xDelta * yDelta
    xVariance += xDelta ** 2
    yVariance += yDelta ** 2
  }
  if (xVariance === 0 || yVariance === 0) return null
  return covariance / Math.sqrt(xVariance * yVariance)
}

function discrimination(
  item: ResultAssessmentItemSnapshot,
  participants: Participant[],
  outcomes: OutcomeMap,
  minimumSampleSize: number,
): ItemAnalysisDiscrimination {
  const partialPoint = item.questionType === 'constructed_response' || item.questionType === 'problem_solving' || item.questionType === 'essay'
    || item.questionType === 'fill_in_the_blank' || item.questionType === 'matching'
    || participants.some((participant) => {
      const outcome = outcomeFor(outcomes, participant.participantId, item.id)
      return outcome?.isCorrect === null && answerPresent(outcome?.answer ?? null)
        || Boolean(outcome && outcome.earnedPoints > 0 && outcome.earnedPoints < outcome.possiblePoints)
    })
  const method = partialPoint ? 'item_rest_pearson' : 'point_biserial'
  const itemScores: number[] = []
  const restScores: number[] = []
  const encodedParticipantIds = new Set<string>()

  for (const participant of participants) {
    const participantOutcomes = sessionOutcomesForParticipant(outcomes, participant.participantId)
    if (participantOutcomes.length === 0) continue
    encodedParticipantIds.add(participant.participantId)
    const itemOutcome = outcomeFor(outcomes, participant.participantId, item.id)
    if (!partialPoint && itemOutcome?.answer !== null && itemOutcome && typeof itemOutcome.isCorrect !== 'boolean') continue
    const itemScore = partialPoint
      ? percentage(nonNegativeNumber(itemOutcome?.earnedPoints), itemPossiblePoints(item)) ?? 0
      : itemOutcome?.isCorrect === true ? 1 : 0
    const restScore = participantOutcomes
      .filter((outcome) => outcome.itemId !== item.id)
      .reduce((sum, outcome) => sum + nonNegativeNumber(outcome.earnedPoints), 0)
    itemScores.push(itemScore)
    restScores.push(restScore)
  }

  const sampleSize = itemScores.length
  if (sampleSize < minimumSampleSize) {
    return {
      method,
      value: null,
      sampleSize,
      status: 'insufficient_data',
      reason: `At least ${minimumSampleSize} encoded learners are required for this analytical signal.`,
    }
  }
  const value = pearson(itemScores, restScores)
  if (value === null) {
    return {
      method,
      value: null,
      sampleSize,
      status: 'undefined',
      reason: 'The item or rest-of-test scores have zero variance.',
    }
  }
  return { method, value, sampleSize, status: 'available', reason: null }
}

function sessionOutcomesForParticipant(outcomes: OutcomeMap, participantId: string) {
  const prefix = `${participantId}::`
  const values: ResultItemOutcome[] = []
  for (const [key, outcome] of outcomes.entries()) if (key.startsWith(prefix)) values.push(outcome)
  return values
}

function toItemAnalysisItem(
  metrics: ItemMetrics,
  participants: Participant[],
  outcomes: OutcomeMap,
  minimumSampleSize: number,
): ItemAnalysisItem {
  const item = metrics.item
  const participantOutcomes = participants
    .map((participant) => outcomeFor(outcomes, participant.participantId, item.id))
    .filter((outcome): outcome is ResultItemOutcome => Boolean(outcome && answerPresent(outcome.answer)))
  const teacherScored = item.questionType === 'constructed_response' || item.questionType === 'problem_solving' || item.questionType === 'essay'
    || participantOutcomes.some((outcome) => outcome.scoringSource === 'teacher')
  const componentPartial = item.questionType === 'fill_in_the_blank' && item.answer.type === 'fill_in_the_blank' && item.answer.blanks.length > 1
    || item.questionType === 'matching' && item.answer.type === 'matching' && item.answer.mappings.length > 1
  const observedPartial = participantOutcomes.some((outcome) => outcome.earnedPoints > 0 && outcome.earnedPoints < outcome.possiblePoints)
  const binaryFacilityEligible = !teacherScored && !componentPartial && !observedPartial
    && itemPossiblePoints(item) === 1 && metrics.percentageCorrect !== null
  const analysisBasis = teacherScored ? 'teacher_scored_points' : binaryFacilityEligible ? 'binary_facility' : 'normalized_point_achievement'
  return {
    itemId: item.id,
    itemNumber: item.itemNumber,
    prompt: item.prompt,
    questionType: item.questionType,
    competencyId: item.competencySnapshot.id,
    competencyCode: item.competencySnapshot.code,
    competencyText: item.competencySnapshot.text,
    cognitiveCategoryId: item.cognitiveCategorySnapshot.id,
    cognitiveCategoryLabel: item.cognitiveCategorySnapshot.label,
    cognitiveCategoryShortLabel: item.cognitiveCategorySnapshot.shortLabel,
    curriculumPeriodId: item.competencySnapshot.curriculumPeriodId,
    curriculumPeriodLabel: item.competencySnapshot.curriculumPeriodLabel,
    possiblePoints: itemPossiblePoints(item),
    analysisBasis,
    binaryFacility: binaryFacilityEligible ? metrics.percentageCorrect : null,
    normalizedPointAchievement: percentage(metrics.earnedPoints, metrics.pointsPossibleForAll),
    attempted: metrics.attempted,
    correct: metrics.correct,
    incorrect: metrics.incorrect,
    omitted: metrics.omitted,
    percentageCorrect: metrics.percentageCorrect,
    facility: metrics.percentageCorrect,
    earnedPoints: metrics.earnedPoints,
    pointsPossibleForAttempted: metrics.pointsPossibleForAttempted,
    averageEarnedPoints: metrics.averageEarnedPoints,
    pointFacility: metrics.pointFacility,
    pointsPossibleForAll: metrics.pointsPossibleForAll,
    options: metrics.options,
    invalidOptionCount: metrics.invalidOptionCount,
    discrimination: discrimination(item, participants, outcomes, minimumSampleSize),
    traceability: {
      assessmentItemId: item.id,
      originalItemNumber: item.itemNumber,
      mappingRowId: item.mapping.rowId,
      competencyId: item.mapping.competencyId,
      cognitiveCategoryId: item.mapping.cognitiveCategoryId,
      allocationItemStart: item.mapping.allocationItemStart,
      allocationItemEnd: item.mapping.allocationItemEnd,
      allocationIndex: item.mapping.allocationIndex,
      curriculumPeriodId: item.competencySnapshot.curriculumPeriodId,
      curriculumPeriodLabel: item.competencySnapshot.curriculumPeriodLabel,
    },
  }
}

function aggregateRows(items: ItemAnalysisItem[], mode: 'competency' | 'cognitive' | 'period'): ItemAnalysisAggregate[] {
  const grouped = new Map<string, ItemAnalysisAggregate>()
  for (const item of items) {
    const key = mode === 'competency'
      ? `${item.competencyId}::${item.curriculumPeriodId ?? ''}`
      : mode === 'cognitive'
        ? `${item.cognitiveCategoryId}::${item.curriculumPeriodId ?? ''}`
        : `${item.curriculumPeriodId ?? ''}::${item.curriculumPeriodLabel}`
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        key,
        ...(mode === 'competency'
          ? { competencyId: item.competencyId, competencyCode: item.competencyCode, competencyText: item.competencyText }
          : mode === 'cognitive'
            ? { cognitiveCategoryId: item.cognitiveCategoryId, cognitiveCategoryLabel: item.cognitiveCategoryLabel, cognitiveCategoryShortLabel: item.cognitiveCategoryShortLabel }
            : {}),
        curriculumPeriodId: item.curriculumPeriodId,
        curriculumPeriodLabel: item.curriculumPeriodLabel,
        mappedItems: 1,
        itemNumbers: [item.itemNumber],
        attempts: item.attempted,
        correct: item.correct,
        incorrect: item.incorrect,
        omitted: item.omitted,
        percentageCorrect: null,
        facility: null,
        earnedPoints: item.earnedPoints,
        pointsPossibleForAttempted: item.pointsPossibleForAttempted,
        averageEarnedPoints: null,
        pointFacility: null,
        pointsPossibleForAll: item.pointsPossibleForAll,
        normalizedPointAchievement: null,
      })
      continue
    }
    current.mappedItems += 1
    current.itemNumbers.push(item.itemNumber)
    current.attempts += item.attempted
    current.correct += item.correct
    current.incorrect += item.incorrect
    current.omitted += item.omitted
    current.earnedPoints += item.earnedPoints
    current.pointsPossibleForAttempted += item.pointsPossibleForAttempted
    current.pointsPossibleForAll += item.pointsPossibleForAll
  }

  return [...grouped.values()].map((aggregate) => {
    const correctnessDenominator = aggregate.correct + aggregate.incorrect
    aggregate.percentageCorrect = percentage(aggregate.correct, correctnessDenominator)
    aggregate.facility = aggregate.percentageCorrect
    aggregate.averageEarnedPoints = percentage(aggregate.earnedPoints, aggregate.attempts)
    aggregate.pointFacility = percentage(aggregate.earnedPoints, aggregate.pointsPossibleForAttempted)
    aggregate.normalizedPointAchievement = percentage(aggregate.earnedPoints, aggregate.pointsPossibleForAll)
    aggregate.itemNumbers.sort((a, b) => a - b)
    return aggregate
  }).sort((a, b) => {
    const aFirst = a.itemNumbers[0] ?? Number.MAX_SAFE_INTEGER
    const bFirst = b.itemNumbers[0] ?? Number.MAX_SAFE_INTEGER
    return aFirst - bFirst || a.key.localeCompare(b.key, 'en')
  })
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function percentageDistribution(values: number[]): PercentageDistributionBin[] {
  const bins: PercentageDistributionBin[] = Array.from({ length: 11 }, (_, index) => {
    const minimum = index === 10 ? 100 : index * 10
    const maximum = index === 10 ? 100 : index * 10 + 9.999999
    return { label: index === 10 ? '100' : `${index * 10}–${index * 10 + 9}`, minimum, maximum, count: 0 }
  })
  for (const value of values) {
    const safeValue = Math.max(0, Math.min(1, value)) * 100
    const index = safeValue >= 100 ? 10 : Math.floor(safeValue / 10)
    bins[index].count += 1
  }
  return bins
}

function buildClassSummary(
  participants: Participant[],
  scoreMap: Map<string, number | null>,
  possiblePoints: number,
  encodedIds: Set<string>,
): ItemAnalysisClassSummary {
  const scored = participants
    .map((participant) => scoreMap.get(participant.participantId))
    .filter((score): score is number => finiteNumber(score))
  const percentages = possiblePoints > 0 ? scored.map((score) => score / possiblePoints) : []
  return {
    learnerCount: participants.length,
    encodedLearnerCount: [...encodedIds].filter((id) => participants.some((participant) => participant.participantId === id)).length,
    scoredLearnerCount: scored.length,
    averageRawScore: scored.length > 0 ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null,
    medianRawScore: median(scored),
    highestRawScore: scored.length > 0 ? Math.max(...scored) : null,
    lowestRawScore: scored.length > 0 ? Math.min(...scored) : null,
    averagePercentage: percentages.length > 0 ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : null,
    medianPercentage: median(percentages),
    highestPercentage: percentages.length > 0 ? Math.max(...percentages) : null,
    lowestPercentage: percentages.length > 0 ? Math.min(...percentages) : null,
    percentageDistribution: percentageDistribution(percentages),
  }
}

function buildLearnerSummary(
  participant: Participant,
  items: ResultAssessmentItemSnapshot[],
  outcomes: OutcomeMap,
  possiblePoints: number,
  minimumSampleSize: number,
): LearnerAnalysisSummary {
  const learnerItems = items.map((item) => toItemAnalysisItem(computeItemMetrics(item, [participant], outcomes), [participant], outcomes, minimumSampleSize))
  const participantOutcomes = sessionOutcomesForParticipant(outcomes, participant.participantId)
  const encoded = participantOutcomes.length > 0
  const rawScore = encoded ? participantOutcomes.reduce((sum, outcome) => sum + nonNegativeNumber(outcome.earnedPoints), 0) : null
  const outcomeByItem = new Map(participantOutcomes.map((outcome) => [outcome.itemId, outcome]))
  const missedItemNumbers: number[] = []
  for (const item of items) {
    const outcome = outcomeByItem.get(item.id)
    if (!outcome || !answerPresent(outcome.answer) || outcome.isCorrect === false) missedItemNumbers.push(item.itemNumber)
  }
  return {
    participantId: participant.participantId,
    learnerId: participant.learnerId,
    displayName: participant.displayName,
    rawScore,
    possiblePoints,
    percentage: rawScore === null || possiblePoints <= 0 ? null : rawScore / possiblePoints,
    attemptedItems: learnerItems.reduce((sum, item) => sum + item.attempted, 0),
    omittedItems: learnerItems.reduce((sum, item) => sum + item.omitted, 0),
    correctItems: learnerItems.reduce((sum, item) => sum + item.correct, 0),
    incorrectItems: learnerItems.reduce((sum, item) => sum + item.incorrect, 0),
    missedItemNumbers,
    competencyPerformance: aggregateRows(learnerItems, 'competency'),
    cognitivePerformance: aggregateRows(learnerItems, 'cognitive'),
  }
}

function scoreOnlyLearnerSummary(
  participant: Participant,
  outcome: ScoreOnlyOutcome | undefined,
  possiblePoints: number,
): LearnerAnalysisSummary {
  const rawScore = outcome && finiteNumber(outcome.rawScore) ? outcome.rawScore : null
  return {
    participantId: participant.participantId,
    learnerId: participant.learnerId,
    displayName: participant.displayName,
    rawScore,
    possiblePoints,
    percentage: rawScore === null || possiblePoints <= 0 ? null : rawScore / possiblePoints,
    attemptedItems: 0,
    omittedItems: 0,
    correctItems: 0,
    incorrectItems: 0,
    missedItemNumbers: [],
    competencyPerformance: [],
    cognitivePerformance: [],
  }
}

const FORMULAS = {
  facility: 'facility = number correct / number of correctness-applicable attempted responses; null when the denominator is zero.',
  optionPercentage: 'option percentage = responses choosing the option / all attempted multiple-choice responses; omitted responses are reported separately.',
  distractorSignal: 'an incorrect option is flagged only when it receives zero selections despite at least one attempted response; the signal is advisory and has no DepEd-mandated cutoff.',
  pointFacility: 'point facility = total earned points / total possible points across attempted responses; omitted responses are excluded and the value is null when that denominator is zero.',
  normalizedPointAchievement: 'normalized point achievement = total earned points / total mapped points for the selected learner rows; this is the point-weighted view and includes omitted responses as zero.',
  binaryFacility: 'binary facility applies only to correctness-applicable one-point objective items: correct / (correct + incorrect). It is not a substitute for a multi-point score.',
  discrimination: 'point-biserial uses Pearson correlation between binary item score (correct = 1; incorrect or omitted = 0) and rest-of-test earned score excluding the item; partial-point items use normalized item score with item-rest Pearson.',
  smallClassRule: 'Discrimination is shown as insufficient data below the configured sample size (default 10) and is undefined when either score has zero variance; this is not a DepEd threshold.',
}

export function analyzeResultSession(input: ItemAnalysisInput, options: { minimumDiscriminationSampleSize?: number; participantIds?: string[] } = {}): ItemAnalysisResult {
  const { session, outcomes: providedOutcomes } = extractSession(input)
  const participants = selectedParticipants(session, options.participantIds)
  const minimumSampleSize = Math.max(2, Math.floor(options.minimumDiscriminationSampleSize ?? DEFAULT_MINIMUM_DISCRIMINATION_SAMPLE_SIZE))
  const possiblePoints = nonNegativeNumber(session.assessmentSnapshot.totalPossiblePoints)
  const scoreOnlyMap = new Map((session.scoreOnlyOutcomes ?? []).map((outcome) => [outcome.participantId, outcome]))

  if (session.entryMode === 'score_only') {
    const scoreMap = new Map<string, number | null>(participants.map((participant) => [participant.participantId, scoreOnlyMap.get(participant.participantId)?.rawScore ?? null]))
    const encodedIds = new Set(participants.filter((participant) => scoreOnlyMap.get(participant.participantId)?.rawScore !== null && scoreOnlyMap.get(participant.participantId)?.rawScore !== undefined).map((participant) => participant.participantId))
    return {
      resultSessionId: session.id,
      available: false,
      reason: 'score_only_mode',
      minimumDiscriminationSampleSize: minimumSampleSize,
      items: [],
      competencies: [],
      cognitiveCategories: [],
      curriculumPeriods: [],
      classSummary: buildClassSummary(participants, scoreMap, possiblePoints, encodedIds),
      learners: participants.map((participant) => scoreOnlyLearnerSummary(participant, scoreOnlyMap.get(participant.participantId), possiblePoints)),
      formulas: FORMULAS,
    }
  }

  const outcomes = buildOutcomeMap(session, participants, providedOutcomes ?? session.itemOutcomes ?? [])
  if (outcomes.size === 0) {
    const scoreMap = new Map<string, number | null>(participants.map((participant) => [participant.participantId, null]))
    return {
      resultSessionId: session.id,
      available: false,
      reason: 'no_item_outcomes',
      minimumDiscriminationSampleSize: minimumSampleSize,
      items: [],
      competencies: [],
      cognitiveCategories: [],
      curriculumPeriods: [],
      classSummary: buildClassSummary(participants, scoreMap, possiblePoints, new Set()),
      learners: participants.map((participant) => scoreOnlyLearnerSummary(participant, undefined, possiblePoints)),
      formulas: FORMULAS,
    }
  }

  const itemRows = session.assessmentSnapshot.items
    .slice()
    .sort((a, b) => a.itemNumber - b.itemNumber || a.id.localeCompare(b.id, 'en'))
    .map((item) => toItemAnalysisItem(computeItemMetrics(item, participants, outcomes), participants, outcomes, minimumSampleSize))
  const scoreMap = new Map<string, number | null>()
  const encodedIds = new Set<string>()
  for (const participant of participants) {
    const participantOutcomes = sessionOutcomesForParticipant(outcomes, participant.participantId)
    if (participantOutcomes.length === 0) {
      scoreMap.set(participant.participantId, null)
      continue
    }
    encodedIds.add(participant.participantId)
    scoreMap.set(participant.participantId, participantOutcomes.reduce((sum, outcome) => sum + nonNegativeNumber(outcome.earnedPoints), 0))
  }
  return {
    resultSessionId: session.id,
    available: true,
    reason: null,
    minimumDiscriminationSampleSize: minimumSampleSize,
    items: itemRows,
    competencies: aggregateRows(itemRows, 'competency'),
    cognitiveCategories: aggregateRows(itemRows, 'cognitive'),
    curriculumPeriods: aggregateRows(itemRows, 'period'),
    classSummary: buildClassSummary(participants, scoreMap, possiblePoints, encodedIds),
    learners: participants.map((participant) => buildLearnerSummary(participant, session.assessmentSnapshot.items, outcomes, possiblePoints, minimumSampleSize)),
    formulas: FORMULAS,
  }
}

/** Short alias for callers that use “item analysis” as the domain verb. */
export const buildItemAnalysis = analyzeResultSession
