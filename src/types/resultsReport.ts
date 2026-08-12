import type { ItemAnalysisResult } from './itemAnalysis'
import type { RemediationSignalResult, RemediationPlanDraft } from './remediation'
import type { AssessmentResultSession } from './results'

export type ResultsReportMode = 'summary' | 'item_analysis' | 'competency' | 'remediation'
export type ResultsReportLanguage = 'english' | 'filipino'

export type ResultsReportLabels = {
  summary: string
  itemAnalysis: string
  competencyPerformance: string
  remediationPlan: string
  learner: string
  rawScore: string
  percentage: string
  attempted: string
  correct: string
  incorrect: string
  omitted: string
  facility: string
  points: string
  item: string
  competency: string
  cognitiveCategory: string
  curriculumPeriod: string
  discrimination: string
  options: string
  count: string
  evidence: string
  threshold: string
  learners: string
  target: string
  plannedActivity: string
  schedule: string
  followUpEvidence: string
  notes: string
  teacherReview: string
  classAverage: string
  median: string
  highest: string
  lowest: string
  total: string
  possiblePoints: string
  pointAchievement: string
  analysisBasis: string
  administrationDate: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTerm: string
  section: string
  teacher: string
  school: string
}

export type ResultsReportMetadata = {
  teacherName: string
  schoolName: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTerm: string
  sectionName: string
  administrationDate: string
}

export type ResultsLearnerScoreRow = {
  displayName: string
  rawScore: number | null
  possiblePoints: number
  percentage: number | null
  attemptedItems: number
  omittedItems: number
  correctItems: number
  incorrectItems: number
}

export type ResultsSummarySection = {
  classLearnerCount: number
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
  possiblePoints: number
  percentageDistribution: Array<{ label: string; count: number }>
  learners: ResultsLearnerScoreRow[]
}

export type ResultsItemAnalysisRow = {
  itemNumber: number
  numberLabel: string
  prompt: string
  competency: string
  cognitiveCategory: string
  curriculumPeriod: string
  questionType: string
  attempted: number
  correct: number
  incorrect: number
  omitted: number
  percentageCorrect: number | null
  facility: number | null
  earnedPoints: number
  possiblePoints: number
  pointFacility: number | null
  normalizedPointAchievement: number | null
  pointsPossibleForAll: number
  analysisBasis: 'binary_facility' | 'normalized_point_achievement' | 'teacher_scored_points'
  discrimination: number | null
  discriminationStatus: string
  options: Array<{ label: string; count: number; percentage: number | null; correct: boolean; distractorSignal: 'unselected' | null }>
}

export type ResultsCompetencyRow = {
  competency: string
  code: string
  curriculumPeriod: string
  mappedItems: number
  itemNumbers: number[]
  itemNumberLabels: string[]
  attempts: number
  correct: number
  incorrect: number
  omitted: number
  percentageCorrect: number | null
  facility: number | null
  earnedPoints: number
  pointFacility: number | null
  normalizedPointAchievement: number | null
  pointsPossibleForAll: number
}

export type ResultsCognitiveRow = {
  category: string
  curriculumPeriod: string
  mappedItems: number
  itemNumbers: number[]
  itemNumberLabels: string[]
  attempts: number
  correct: number
  incorrect: number
  omitted: number
  percentageCorrect: number | null
  facility: number | null
  earnedPoints: number
  pointFacility: number | null
  normalizedPointAchievement: number | null
  pointsPossibleForAll: number
}

export type ResultsCurriculumPeriodRow = {
  curriculumPeriod: string
  mappedItems: number
  itemNumbers: number[]
  itemNumberLabels: string[]
  attempts: number
  correct: number
  incorrect: number
  omitted: number
  percentageCorrect: number | null
  facility: number | null
  earnedPoints: number
  pointFacility: number | null
  normalizedPointAchievement: number | null
  pointsPossibleForAll: number
}

export type ResultsOptionRow = {
  itemNumber: number
  numberLabel: string
  option: string
  count: number
  percentage: number | null
  correct: boolean
  distractorSignal: 'unselected' | null
  omitted: number
}

export type ResultsRemediationRow = {
  scope: 'whole_class' | 'selected_learners'
  targetCompetency: string
  curriculumPeriod: string
  itemNumbers: number[]
  itemNumberLabels: string[]
  evidence: number | null
  evidenceLabel: string
  denominatorLabel: string
  threshold: number
  learnerCount: number
  instructionalMessage: string
  plannedActivity: string
  schedule: string
  followUpEvidence: string
  notes: string
  teacherReviewed: boolean
}

export type ResultsReportModel = {
  mode: ResultsReportMode
  language: ResultsReportLanguage
  labels: ResultsReportLabels
  documentTitle: string
  title: string
  metadata: ResultsReportMetadata
  summary: ResultsSummarySection | null
  items: ResultsItemAnalysisRow[]
  options: ResultsOptionRow[]
  competencies: ResultsCompetencyRow[]
  cognitiveCategories: ResultsCognitiveRow[]
  curriculumPeriods: ResultsCurriculumPeriodRow[]
  remediation: ResultsRemediationRow[]
  /** No learner/assessment/session IDs are intentionally present in this export model. */
}

export type ResultsReportBuildOptions = {
  mode: ResultsReportMode
  documentLanguage?: 'match' | ResultsReportLanguage
  authoredLanguageHint?: string
  teacherName?: string
  schoolName?: string
  sectionName?: string
  remediation?: RemediationSignalResult
  remediationPlan?: RemediationPlanDraft | null
  /** Learner names are included only for the teacher-authorized summary report. */
  includeLearnerNames?: boolean
}

export type ResultsReportInput = {
  session: AssessmentResultSession
  analysis: ItemAnalysisResult
}
