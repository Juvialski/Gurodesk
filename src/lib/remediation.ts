import type {
  ItemAnalysisAggregate,
  ItemAnalysisResult,
  LearnerAnalysisSummary,
} from '../types/itemAnalysis'
import type {
  RemediationLearnerSignal,
  RemediationOverride,
  RemediationPlanTarget,
  RemediationScope,
  RemediationSignal,
  RemediationSignalOptions,
  RemediationSignalResult,
  RemediationThresholdConfig,
} from '../types/remediation'

/** A GuroDesk analytical default, not an official DepEd threshold. */
export const DEFAULT_REMEDIATION_THRESHOLD = 0.75

const DEFAULT_THRESHOLD: RemediationThresholdConfig = {
  percentageThreshold: DEFAULT_REMEDIATION_THRESHOLD,
  basis: 'point_facility',
  comparison: 'below',
}

function safeThreshold(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_REMEDIATION_THRESHOLD
  // Accept a teacher-facing “75” as a convenience while retaining a single
  // normalized proportion in persisted analysis and report models.
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, normalized))
}

function aggregateEvidence(aggregate: ItemAnalysisAggregate, basis: RemediationThresholdConfig['basis']) {
  return basis === 'point_facility'
    ? (aggregate.normalizedPointAchievement ?? aggregate.pointFacility)
    : aggregate.percentageCorrect
}

function denominatorLabel(basis: RemediationThresholdConfig['basis']) {
  return basis === 'point_facility'
    ? 'earned points / possible points for selected learner rows'
    : 'correct / correctness-applicable attempted responses'
}

function isBelow(value: number | null, threshold: RemediationThresholdConfig) {
  if (value === null) return false
  return threshold.comparison === 'at_or_below' ? value <= threshold.percentageThreshold : value < threshold.percentageThreshold
}

function aggregateKey(aggregate: ItemAnalysisAggregate) {
  return `${aggregate.competencyId ?? ''}::${aggregate.curriculumPeriodId ?? ''}`
}

function learnerKey(resultSessionId: string, participantId: string, aggregate: ItemAnalysisAggregate) {
  return `${resultSessionId}::${participantId}::${aggregateKey(aggregate)}`
}

function classKey(resultSessionId: string, aggregate: ItemAnalysisAggregate) {
  return `${resultSessionId}::${aggregateKey(aggregate)}`
}

function instructionalMessage(competencyText: string) {
  return `Needs additional evidence/practice for ${competencyText}. Teacher review is required before assigning an activity.`
}

function normalizeOverrides(overrides: RemediationSignalOptions['overrides']) {
  return overrides ?? {}
}

function overrideFor(overrides: Record<string, RemediationOverride>, key: string): RemediationOverride {
  return overrides[key] ?? 'default'
}

function sumAggregates(key: string, aggregates: ItemAnalysisAggregate[]): ItemAnalysisAggregate {
  const first = aggregates[0]
  const result: ItemAnalysisAggregate = {
    key,
    competencyId: first?.competencyId,
    competencyCode: first?.competencyCode ?? null,
    competencyText: first?.competencyText,
    curriculumPeriodId: first?.curriculumPeriodId ?? null,
    curriculumPeriodLabel: first?.curriculumPeriodLabel ?? '',
    mappedItems: 0,
    itemNumbers: [],
    attempts: 0,
    correct: 0,
    incorrect: 0,
    omitted: 0,
    percentageCorrect: null,
    facility: null,
    earnedPoints: 0,
    pointsPossibleForAttempted: 0,
    averageEarnedPoints: null,
    pointFacility: null,
    pointsPossibleForAll: 0,
    normalizedPointAchievement: null,
  }
  for (const aggregate of aggregates) {
    result.mappedItems += aggregate.mappedItems
    result.itemNumbers.push(...aggregate.itemNumbers)
    result.attempts += aggregate.attempts
    result.correct += aggregate.correct
    result.incorrect += aggregate.incorrect
    result.omitted += aggregate.omitted
    result.earnedPoints += aggregate.earnedPoints
    result.pointsPossibleForAttempted += aggregate.pointsPossibleForAttempted
    result.pointsPossibleForAll += aggregate.pointsPossibleForAll
  }
  const correctnessDenominator = result.correct + result.incorrect
  result.percentageCorrect = correctnessDenominator > 0 ? result.correct / correctnessDenominator : null
  result.facility = result.percentageCorrect
  result.averageEarnedPoints = result.attempts > 0 ? result.earnedPoints / result.attempts : null
  result.pointFacility = result.pointsPossibleForAttempted > 0
    ? result.earnedPoints / result.pointsPossibleForAttempted
    : null
  result.normalizedPointAchievement = result.pointsPossibleForAll > 0
    ? result.earnedPoints / result.pointsPossibleForAll
    : null
  result.itemNumbers = [...new Set(result.itemNumbers)].sort((a, b) => a - b)
  return result
}

function selectedLearners(analysis: ItemAnalysisResult, participantIds?: string[]) {
  if (!participantIds) return [...analysis.learners]
  const ids = new Set(participantIds)
  return analysis.learners.filter((learner) => ids.has(learner.participantId))
}

function selectedAggregates(learners: LearnerAnalysisSummary[]) {
  const groups = new Map<string, ItemAnalysisAggregate[]>()
  for (const learner of learners) {
    for (const aggregate of learner.competencyPerformance) {
      const key = aggregateKey(aggregate)
      const values = groups.get(key) ?? []
      values.push(aggregate)
      groups.set(key, values)
    }
  }
  return [...groups.entries()].map(([key, values]) => sumAggregates(key, values))
}

function buildClassSignal(
  resultSessionId: string,
  aggregate: ItemAnalysisAggregate,
  participantIds: string[],
  threshold: RemediationThresholdConfig,
  override: RemediationOverride,
): RemediationSignal {
  const evidenceValue = aggregateEvidence(aggregate, threshold.basis)
  return {
    key: classKey(resultSessionId, aggregate),
    resultSessionId,
    scope: participantIds.length > 0 ? 'whole_class' : 'selected_learners',
    competencyId: aggregate.competencyId ?? '',
    competencyCode: aggregate.competencyCode ?? null,
    competencyText: aggregate.competencyText ?? 'Selected competency',
    curriculumPeriodId: aggregate.curriculumPeriodId,
    curriculumPeriodLabel: aggregate.curriculumPeriodLabel,
    mappedItems: aggregate.mappedItems,
    itemNumbers: aggregate.itemNumbers,
    evidenceValue,
    evidenceLabel: threshold.basis,
    denominatorLabel: denominatorLabel(threshold.basis),
    threshold: threshold.percentageThreshold,
    comparison: threshold.comparison,
    participantIds: [...participantIds],
    numberOfLearners: participantIds.length,
    override,
    instructionalMessage: instructionalMessage(aggregate.competencyText ?? 'the selected competency'),
  }
}

function buildLearnerSignal(
  resultSessionId: string,
  learner: LearnerAnalysisSummary,
  aggregate: ItemAnalysisAggregate,
  threshold: RemediationThresholdConfig,
  override: RemediationOverride,
): RemediationLearnerSignal {
  return {
    key: learnerKey(resultSessionId, learner.participantId, aggregate),
    resultSessionId,
    participantId: learner.participantId,
    learnerId: learner.learnerId,
    competencyId: aggregate.competencyId ?? '',
    competencyText: aggregate.competencyText ?? 'Selected competency',
    curriculumPeriodId: aggregate.curriculumPeriodId,
    curriculumPeriodLabel: aggregate.curriculumPeriodLabel,
    evidenceValue: aggregateEvidence(aggregate, threshold.basis),
    evidenceLabel: threshold.basis,
    denominatorLabel: denominatorLabel(threshold.basis),
    threshold: threshold.percentageThreshold,
    comparison: threshold.comparison,
    override,
    instructionalMessage: instructionalMessage(aggregate.competencyText ?? 'the selected competency'),
  }
}

/**
 * Build neutral, teacher-reviewable remediation signals from deterministic
 * results. No learner display names, answer sheets, or AI calls are involved.
 */
export function buildRemediationSignals(
  analysis: ItemAnalysisResult,
  options: RemediationSignalOptions = {},
): RemediationSignalResult {
  const scope: RemediationScope = options.scope ?? 'whole_class'
  const threshold: RemediationThresholdConfig = {
    percentageThreshold: safeThreshold(options.threshold?.percentageThreshold),
    basis: options.threshold?.basis ?? DEFAULT_THRESHOLD.basis,
    comparison: options.threshold?.comparison ?? DEFAULT_THRESHOLD.comparison,
  }
  const learners = selectedLearners(analysis, options.participantIds)
  const participantIds = learners.map((learner) => learner.participantId)
  const overrides = normalizeOverrides(options.overrides)

  if (!analysis.available) {
    return {
      resultSessionId: analysis.resultSessionId,
      threshold,
      scope,
      selectedParticipantIds: participantIds,
      classSignals: [],
      learnerSignals: [],
      sourceAggregates: [],
      available: false,
      reason: analysis.reason === 'score_only_mode' ? 'score_only_mode' : 'no_item_analysis',
    }
  }

  const sourceAggregates = scope === 'selected_learners' ? selectedAggregates(learners) : analysis.competencies
  const classSignals: RemediationSignal[] = []
  for (const aggregate of sourceAggregates) {
    const key = classKey(analysis.resultSessionId, aggregate)
    const override = overrideFor(overrides, key)
    const triggered = isBelow(aggregateEvidence(aggregate, threshold.basis), threshold)
    // An explicit “include” is a teacher decision and may preserve a target
    // even after a later evidence refresh raises the aggregate above threshold.
    if ((triggered || override === 'include') && override !== 'exclude') {
      const signal = buildClassSignal(analysis.resultSessionId, aggregate, participantIds, threshold, override)
      signal.scope = scope
      classSignals.push(signal)
    }
  }

  const learnerSignals: RemediationLearnerSignal[] = []
  for (const learner of learners) {
    for (const aggregate of learner.competencyPerformance) {
      const key = learnerKey(analysis.resultSessionId, learner.participantId, aggregate)
      const override = overrideFor(overrides, key)
      const triggered = isBelow(aggregateEvidence(aggregate, threshold.basis), threshold)
      if ((triggered || override === 'include') && override !== 'exclude') {
        learnerSignals.push(buildLearnerSignal(analysis.resultSessionId, learner, aggregate, threshold, override))
      }
    }
  }

  return {
    resultSessionId: analysis.resultSessionId,
    threshold,
    scope,
    selectedParticipantIds: participantIds,
    classSignals,
    learnerSignals,
    sourceAggregates,
    available: true,
    reason: null,
  }
}

export function buildRemediationPlanTargets(signals: RemediationSignalResult): RemediationPlanTarget[] {
  return signals.classSignals.map((signal) => ({
    competencyId: signal.competencyId,
    competencyText: signal.competencyText,
    curriculumPeriodId: signal.curriculumPeriodId,
    curriculumPeriodLabel: signal.curriculumPeriodLabel,
    evidenceValue: signal.evidenceValue,
    evidenceLabel: signal.evidenceLabel,
    denominatorLabel: signal.denominatorLabel,
    itemNumbers: signal.itemNumbers,
  }))
}
