import type {
  AssessmentAnswer,
  AssessmentCognitiveCategorySnapshot,
  AssessmentCompetencySnapshot,
  AssessmentItemMapping,
  QuestionType,
} from './assessment'

export type LearnerStatus = 'active' | 'inactive'

/**
 * A deliberately small, teacher-local learner identity.
 * GuroDesk Phase 5 never requires LRN or contact/demographic information.
 */
export type ClassLearner = {
  id: string
  userId: string
  assignmentId: string
  /** Must be one of the owning teaching assignment's configured sections. */
  sectionName: string
  displayName: string
  localReference: string | null
  status: LearnerStatus
  createdAt: string
  updatedAt: string
}

export type LearnerInput = Pick<ClassLearner, 'assignmentId' | 'displayName'> & {
  id?: string
  sectionName: string
  localReference?: string | null
  status?: LearnerStatus
}

export type RosterImportColumnRole = 'ignore' | 'display_name' | 'local_reference'

export type RosterImportMapping = Record<string, RosterImportColumnRole>

export type RosterImportRow = {
  rowNumber: number
  displayName: string
  localReference: string | null
  status: 'ready' | 'duplicate' | 'invalid'
  messages: string[]
}

export type ResultSessionStatus = 'draft' | 'final' | 'archived'
export type ResultEntryMode = 'answer_sheet' | 'item' | 'score_only'
export type ShortAnswerScoringMode = 'manual' | 'normalized_exact'

export type ResultAssessmentItemSnapshot = {
  id: string
  itemNumber: number
  prompt: string
  questionType: QuestionType
  answer: AssessmentAnswer
  /** Current snapshots use pointsPossible. `points` remains for Phase 5.0/5.1 records. */
  pointsPossible?: number
  points: number
  competencySnapshot: AssessmentCompetencySnapshot
  cognitiveCategorySnapshot: AssessmentCognitiveCategorySnapshot
  mapping: AssessmentItemMapping
}

/**
 * Immutable at result-session creation. It protects historical results from
 * later assessment, TOS, or curriculum edits without retaining AI metadata.
 */
export type ResultAssessmentSnapshot = {
  assessmentId: string
  assessmentVersionNumber: number
  assessmentTitle: string
  assignmentId: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTermId: string
  gradingTermLabel: string
  curriculumPeriodIds: string[]
  curriculumPeriodLabels: string[]
  totalItems: number
  totalPossiblePoints: number
  items: ResultAssessmentItemSnapshot[]
}

export type ResultLearnerSnapshot = {
  participantId: string
  learnerId: string
  displayName: string
  localReference: string | null
  learnerWasActive: boolean
}

export type MultipleChoiceLearnerAnswer = {
  type: 'multiple_choice'
  choiceId: string
}

export type TrueFalseLearnerAnswer = {
  type: 'true_false'
  value: boolean
}

export type ShortAnswerLearnerAnswer = {
  type: 'short_answer'
  text: string
}

export type ConstructedResponseLearnerAnswer = {
  type: 'constructed_response'
  text?: string
}

export type IdentificationLearnerAnswer = {
  type: 'identification'
  text: string
}

export type FillInTheBlankLearnerAnswer = {
  type: 'fill_in_the_blank'
  /** One independent response per immutable blank ID. */
  blanks: Record<string, string>
}

export type NumericalLearnerAnswer = {
  type: 'numerical_answer'
  value: number
  unit?: string
}

export type ProblemSolvingLearnerAnswer = {
  type: 'problem_solving'
  finalAnswer?: string | number
  solution?: string
  /** Optional transcribed subpart responses, keyed by immutable subpart ID. */
  subpartAnswers?: Record<string, string | number>
}

export type MatchingLearnerAnswer = {
  type: 'matching'
  /** Column-A prompt ID -> selected Column-B choice ID. */
  matches: Record<string, string>
}

export type MultipleSelectLearnerAnswer = {
  type: 'multiple_select'
  choiceIds: string[]
}

export type EssayLearnerAnswer = {
  type: 'essay'
  text?: string
}

export type LearnerItemAnswer =
  | MultipleChoiceLearnerAnswer
  | TrueFalseLearnerAnswer
  | ShortAnswerLearnerAnswer
  | ConstructedResponseLearnerAnswer
  | IdentificationLearnerAnswer
  | FillInTheBlankLearnerAnswer
  | NumericalLearnerAnswer
  | ProblemSolvingLearnerAnswer
  | MatchingLearnerAnswer
  | MultipleSelectLearnerAnswer
  | EssayLearnerAnswer

export type ResultScoringSource = 'deterministic' | 'teacher'

export type ResultItemOutcome = {
  id: string
  resultSessionId: string
  participantId: string
  learnerId: string
  itemId: string
  itemNumber: number
  answer: LearnerItemAnswer | null
  isCorrect: boolean | null
  earnedPoints: number
  possiblePoints: number
  teacherFeedback: string | null
  scoringSource: ResultScoringSource
  updatedAt: string
}

export type ScoreOnlyOutcome = {
  participantId: string
  learnerId: string
  rawScore: number | null
  possiblePoints: number
  teacherFeedback: string | null
  updatedAt: string
}

export type ShortAnswerScoringConfig = {
  defaultMode: ShortAnswerScoringMode
  itemModes: Record<string, ShortAnswerScoringMode>
}

export type AssessmentResultSession = {
  id: string
  userId: string
  assignmentId: string
  sectionName: string
  assessmentId: string
  administrationDate: string
  title: string
  entryMode: ResultEntryMode
  status: ResultSessionStatus
  assessmentSnapshot: ResultAssessmentSnapshot
  learners: ResultLearnerSnapshot[]
  itemOutcomes: ResultItemOutcome[]
  scoreOnlyOutcomes: ScoreOnlyOutcome[]
  shortAnswerScoring: ShortAnswerScoringConfig
  createdAt: string
  updatedAt: string
  versionNumber: number
}

export type ResultSessionInput = Pick<
  AssessmentResultSession,
  'assignmentId' | 'sectionName' | 'assessmentId' | 'administrationDate' | 'title' | 'entryMode'
> & {
  id?: string
  learnerIds: string[]
}

export type ResultDraftPatch = Pick<
  AssessmentResultSession,
  | 'id'
  | 'administrationDate'
  | 'title'
  | 'entryMode'
  | 'itemOutcomes'
  | 'scoreOnlyOutcomes'
  | 'shortAnswerScoring'
  | 'versionNumber'
>

export type ResultValidationIssue = {
  key: string
  message: string
  severity: 'error' | 'warning'
  participantId?: string
  itemId?: string
  itemNumber?: number
}

export type ResultValidationResult = {
  ready: boolean
  errors: ResultValidationIssue[]
  warnings: ResultValidationIssue[]
}

export type ResultSaveBatch = {
  session: AssessmentResultSession
  /**
   * Complete bounded replacement sets for this draft. The repository persists
   * each array transactionally in one RPC, never one request per response.
   */
  outcomes: ResultItemOutcome[]
  scoreOnlyOutcomes: ScoreOnlyOutcome[]
}
