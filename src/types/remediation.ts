import type { ItemAnalysisAggregate, ItemAnalysisResult } from './itemAnalysis'

/**
 * The threshold is a teacher-selected analytical setting. The default used by
 * the helper is a GuroDesk convention, not a national grading or DepEd rule.
 */
export type RemediationThresholdConfig = {
  percentageThreshold: number
  basis: 'percentage_correct' | 'point_facility'
  comparison: 'below' | 'at_or_below'
}

export type RemediationScope = 'whole_class' | 'selected_learners'

export type RemediationOverride = 'include' | 'exclude' | 'default'

export type RemediationSignal = {
  key: string
  resultSessionId: string
  scope: RemediationScope
  competencyId: string
  competencyCode: string | null
  competencyText: string
  curriculumPeriodId: string | null
  curriculumPeriodLabel: string
  mappedItems: number
  itemNumbers: number[]
  evidenceValue: number | null
  evidenceLabel: 'percentage_correct' | 'point_facility'
  threshold: number
  comparison: 'below' | 'at_or_below'
  participantIds: string[]
  numberOfLearners: number
  override: RemediationOverride
  /** Neutral instructional language intended for teacher review. */
  instructionalMessage: string
}

export type RemediationLearnerSignal = {
  key: string
  resultSessionId: string
  participantId: string
  learnerId: string
  competencyId: string
  competencyText: string
  curriculumPeriodId: string | null
  curriculumPeriodLabel: string
  evidenceValue: number | null
  evidenceLabel: 'percentage_correct' | 'point_facility'
  threshold: number
  comparison: 'below' | 'at_or_below'
  override: RemediationOverride
  instructionalMessage: string
}

export type RemediationSignalOptions = {
  threshold?: Partial<RemediationThresholdConfig>
  scope?: RemediationScope
  participantIds?: string[]
  /** Teacher review can include or exclude a class-level signal by key. */
  overrides?: Record<string, RemediationOverride>
}

export type RemediationSignalResult = {
  resultSessionId: string
  threshold: RemediationThresholdConfig
  scope: RemediationScope
  selectedParticipantIds: string[]
  classSignals: RemediationSignal[]
  learnerSignals: RemediationLearnerSignal[]
  /** The source rows are retained so a report can explain the evidence. */
  sourceAggregates: ItemAnalysisAggregate[]
  available: boolean
  reason: 'score_only_mode' | 'no_item_analysis' | null
}

export type RemediationPlanTarget = {
  competencyId: string
  competencyText: string
  curriculumPeriodId: string | null
  curriculumPeriodLabel: string
  evidenceValue: number | null
  evidenceLabel: 'percentage_correct' | 'point_facility'
  itemNumbers: number[]
}

export type RemediationPlanDraft = {
  id?: string
  resultSessionId: string
  scope: RemediationScope
  selectedParticipantIds: string[]
  targets: RemediationPlanTarget[]
  teacherSelectedTarget: string
  plannedActivity: string
  scheduledFor: string | null
  followUpEvidence: string
  notes: string
  teacherReviewed: boolean
  optionalAssistantSuggestion?: string | null
  createdAt?: string
  updatedAt?: string
}

export type RemediationAnalysisInput = ItemAnalysisResult
