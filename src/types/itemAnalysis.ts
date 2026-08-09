import type {
  AssessmentResultSession,
  ResultAssessmentItemSnapshot,
  ResultItemOutcome,
} from './results'

export type ItemAnalysisMetricStatus = 'available' | 'insufficient_data' | 'undefined'
export type ItemAnalysisBasis = 'binary_facility' | 'normalized_point_achievement' | 'teacher_scored_points'

export type ItemAnalysisDiscriminationMethod = 'point_biserial' | 'item_rest_pearson'

export type ItemAnalysisDiscrimination = {
  /** The method is always explicit so a teacher can interpret the value. */
  method: ItemAnalysisDiscriminationMethod
  value: number | null
  sampleSize: number
  status: ItemAnalysisMetricStatus
  reason: string | null
}

export type ItemAnalysisOption = {
  choiceId: string
  label: string
  count: number
  /** Percentage of attempted multiple-choice responses, not of omitted rows. */
  percentage: number | null
  correct: boolean
  /** Advisory only: an incorrect option received no selections despite attempts. */
  distractorSignal: 'unselected' | null
  distractorSignalReason: string | null
}

export type ItemAnalysisItem = {
  itemId: string
  itemNumber: number
  prompt: string
  questionType: ResultAssessmentItemSnapshot['questionType']
  competencyId: string
  competencyCode: string | null
  competencyText: string
  cognitiveCategoryId: string
  cognitiveCategoryLabel: string
  cognitiveCategoryShortLabel: string
  curriculumPeriodId: string | null
  curriculumPeriodLabel: string
  possiblePoints: number
  /** Explicitly separates binary correctness from point-weighted performance. */
  analysisBasis: ItemAnalysisBasis
  binaryFacility: number | null
  normalizedPointAchievement: number | null
  attempted: number
  correct: number
  incorrect: number
  omitted: number
  /** Correct / attempted for correctness-applicable outcomes. */
  percentageCorrect: number | null
  /** Alias for percentageCorrect kept for analytical/reporting vocabulary. */
  facility: number | null
  earnedPoints: number
  pointsPossibleForAttempted: number
  averageEarnedPoints: number | null
  pointFacility: number | null
  pointsPossibleForAll: number
  options: ItemAnalysisOption[]
  invalidOptionCount: number
  discrimination: ItemAnalysisDiscrimination
  /** Immutable assessment mapping retained for report traceability. */
  traceability: {
    assessmentItemId: string
    originalItemNumber: number
    mappingRowId: string
    competencyId: string
    cognitiveCategoryId: string
    allocationItemStart: number
    allocationItemEnd: number
    allocationIndex: number
    curriculumPeriodId: string | null
    curriculumPeriodLabel: string
  }
}

export type ItemAnalysisAggregate = {
  key: string
  competencyId?: string
  competencyCode?: string | null
  competencyText?: string
  cognitiveCategoryId?: string
  cognitiveCategoryLabel?: string
  cognitiveCategoryShortLabel?: string
  curriculumPeriodId: string | null
  curriculumPeriodLabel: string
  mappedItems: number
  itemNumbers: number[]
  attempts: number
  correct: number
  incorrect: number
  omitted: number
  percentageCorrect: number | null
  facility: number | null
  earnedPoints: number
  pointsPossibleForAttempted: number
  averageEarnedPoints: number | null
  pointFacility: number | null
  /** Point denominator across all selected learner rows, including omissions. */
  pointsPossibleForAll: number
  normalizedPointAchievement: number | null
}

export type LearnerAnalysisSummary = {
  participantId: string
  learnerId: string
  displayName: string
  rawScore: number | null
  possiblePoints: number
  percentage: number | null
  attemptedItems: number
  omittedItems: number
  correctItems: number
  incorrectItems: number
  missedItemNumbers: number[]
  competencyPerformance: ItemAnalysisAggregate[]
  cognitivePerformance: ItemAnalysisAggregate[]
}

export type PercentageDistributionBin = {
  label: string
  minimum: number
  maximum: number
  count: number
}

export type ItemAnalysisClassSummary = {
  learnerCount: number
  encodedLearnerCount: number
  scoredLearnerCount: number
  averageRawScore: number | null
  medianRawScore: number | null
  highestRawScore: number | null
  lowestRawScore: number | null
  averagePercentage: number | null
  medianPercentage: number | null
  highestPercentage: number | null
  lowestPercentage: number | null
  percentageDistribution: PercentageDistributionBin[]
}

export type ItemAnalysisFormulaNotes = {
  facility: string
  optionPercentage: string
  distractorSignal: string
  pointFacility: string
  normalizedPointAchievement: string
  binaryFacility: string
  discrimination: string
  smallClassRule: string
}

export type ItemAnalysisResult = {
  resultSessionId: string
  available: boolean
  reason: 'score_only_mode' | 'no_item_outcomes' | null
  minimumDiscriminationSampleSize: number
  items: ItemAnalysisItem[]
  competencies: ItemAnalysisAggregate[]
  cognitiveCategories: ItemAnalysisAggregate[]
  curriculumPeriods: ItemAnalysisAggregate[]
  classSummary: ItemAnalysisClassSummary
  learners: LearnerAnalysisSummary[]
  formulas: ItemAnalysisFormulaNotes
}

export type ItemAnalysisOptions = {
  /** Default 10; this is a mathematical sufficiency rule, not a DepEd cutoff. */
  minimumDiscriminationSampleSize?: number
  /** An optional pre-filter for a teacher-selected learner group. */
  participantIds?: string[]
}

export type ItemAnalysisInput = AssessmentResultSession | {
  session: AssessmentResultSession
  outcomes?: ResultItemOutcome[]
}
