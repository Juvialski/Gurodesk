import type { TosContent, TosRecord } from './tos'
import type { AssessmentVisual, AssessmentVisualRequirement, AssessmentVisualStatus } from './assessmentVisual'

export type AssessmentStatus = 'draft' | 'final' | 'archived'

/**
 * A question format is deliberately independent from the TOS cognitive
 * category.  Keep this union as the single registry used by editors,
 * validation, persistence, and exports.
 */
export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'constructed_response'
  | 'identification'
  | 'fill_in_the_blank'
  | 'numerical_answer'
  | 'problem_solving'
  | 'matching'
  | 'multiple_select'
  | 'essay'

export const ASSESSMENT_QUESTION_TYPES: readonly QuestionType[] = [
  'multiple_choice',
  'true_false',
  'short_answer',
  'constructed_response',
  'identification',
  'fill_in_the_blank',
  'numerical_answer',
  'problem_solving',
  'matching',
  'multiple_select',
  'essay',
] as const

export type AssessmentAuthorshipState = 'empty' | 'ai_suggestion' | 'teacher_accepted' | 'teacher_edited' | 'manual'

export type AssessmentChoice = {
  id: string
  text: string
}

export type AssessmentMultipleChoiceAnswer = {
  type: 'multiple_choice'
  choices: AssessmentChoice[]
  /** The selected ID must reference one of `choices`; it is never free text. */
  choiceId: string
}

export type AssessmentTrueFalseAnswer = {
  type: 'true_false'
  value: boolean
}

export type AssessmentShortAnswer = {
  type: 'short_answer'
  acceptedAnswers: string[]
  caseSensitive?: boolean
}

export type AssessmentIdentificationAnswer = {
  type: 'identification'
  acceptedAnswers: string[]
  caseSensitive?: boolean
}

export type AssessmentFillBlank = {
  id: string
  acceptedAnswers: string[]
  caseSensitive?: boolean
  pointsPossible?: number
}

export type AssessmentFillInTheBlankAnswer = {
  type: 'fill_in_the_blank'
  blanks: AssessmentFillBlank[]
}

export type AssessmentNumericalAnswer = {
  type: 'numerical_answer'
  value: number
  tolerance?: number
  unit?: string
  requireUnit?: boolean
}

export type AssessmentScoringCriterion = {
  id: string
  label: string
  pointsPossible: number
  description?: string
}

export type AssessmentSubpart = {
  id: string
  prompt: string
  expectedAnswer?: string | number
  pointsPossible: number
  scoringCriteria?: AssessmentScoringCriterion[]
}

export type AssessmentProblemSolvingAnswer = {
  type: 'problem_solving'
  finalAnswer: string | number
  solutionOutline: string
  subparts?: AssessmentSubpart[]
  scoringCriteria?: AssessmentScoringCriterion[]
}

export type AssessmentMatchingPrompt = {
  id: string
  text: string
}

export type AssessmentMatchingChoice = AssessmentChoice & {
  /** Optional display label; text remains the learner-facing value. */
  label?: string
}

export type AssessmentMatchingMapping = {
  promptId: string
  choiceId: string
  pointsPossible?: number
}

export type AssessmentMatchingAnswer = {
  type: 'matching'
  prompts: AssessmentMatchingPrompt[]
  choices: AssessmentMatchingChoice[]
  mappings: AssessmentMatchingMapping[]
  /** False by default: each column-B choice can be used once. */
  reusableChoices?: boolean
  pointsPerMatch?: number
  groupPointsPossible?: number
}

export type AssessmentMultipleSelectAnswer = {
  type: 'multiple_select'
  choices: AssessmentChoice[]
  choiceIds: string[]
  scoringPolicy?: 'all_or_nothing'
}

export type AssessmentConstructedResponseAnswer = {
  type: 'constructed_response'
  expectedResponse: string
  sampleResponse: string
  rubricGuidance?: string
  expectedElements?: string[]
  rubric?: AssessmentScoringCriterion[]
}

export type AssessmentEssayAnswer = {
  type: 'essay'
  keyPoints: string[]
  rubric?: AssessmentScoringCriterion[]
  expectedResponse?: string
  scoringNotes?: string
}

export type AssessmentAnswer =
  | AssessmentMultipleChoiceAnswer
  | AssessmentTrueFalseAnswer
  | AssessmentShortAnswer
  | AssessmentConstructedResponseAnswer
  | AssessmentIdentificationAnswer
  | AssessmentFillInTheBlankAnswer
  | AssessmentNumericalAnswer
  | AssessmentProblemSolvingAnswer
  | AssessmentMatchingAnswer
  | AssessmentMultipleSelectAnswer
  | AssessmentEssayAnswer

export type AssessmentCompetencySnapshot = {
  /** Canonical production curriculum UUID (or the immutable source ID used by the TOS snapshot). */
  id: string
  code: string | null
  text: string
  sourcePage: number | null
  academicPeriodId: string | null
  curriculumPeriodId: string | null
  curriculumPeriodLabel: string
}

export type AssessmentCognitiveCategorySnapshot = {
  id: string
  label: string
  shortLabel: string
}

export type AssessmentItemMapping = {
  rowId: string
  competencyId: string
  cognitiveCategoryId: string
  allocationItemStart: number
  allocationItemEnd: number
  allocationIndex: number
}

export type AssessmentTosSnapshot = {
  id: string
  versionNumber: number
  title: string
  status: 'final'
  assignmentId: string | null
  schoolYear: string
  academicPeriodLabel: string | null
  content: TosContent
}

export type AssessmentItem = {
  /** Stable identity independent of item number or array position. */
  id: string
  itemNumber: number
  /** V2 learner-facing point-number range. Legacy assessments leave these unset. */
  pointStart?: number
  pointEnd?: number
  /** Immutable master-plan entry that owns this logical question in V2. */
  planEntryId?: string
  competencySnapshot: AssessmentCompetencySnapshot
  cognitiveCategorySnapshot: AssessmentCognitiveCategorySnapshot
  /** Exact deterministic TOS row/category allocation that produced this item. */
  mapping: AssessmentItemMapping
  prompt: string
  questionType: QuestionType
  answer: AssessmentAnswer
  authorshipState: AssessmentAuthorshipState
  rationale?: string
  teacherNotes?: string
  /** Derived scoring value.  Legacy records may only carry `points`. */
  pointsPossible: number
  /** @deprecated Use pointsPossible. Kept for old clients and database mirrors. */
  points?: number | null
  qaState?: AssessmentQaState
  locked?: boolean
  /** Bounded previous versions for this item only (never a whole-assessment copy). */
  history?: AssessmentItemVersion[]
  /** Optional teacher-authored geometry/diagram visual, orthogonal to the question type. */
  visual?: AssessmentVisual
  /** Persisted plan from question generation or conservative local heuristics. */
  visualRequirement?: AssessmentVisualRequirement
  visualIntent?: string
  visualStatus?: AssessmentVisualStatus
  visualAttempts?: number
  visualError?: string
  /** Hash of question type, prompt, and structured answer used for this visual. */
  visualSourceHash?: string
  visualUpdatedAt?: string
}

export type AssessmentQaState =
  | 'empty'
  | 'generated'
  | 'verified'
  | 'needs_review'
  | 'teacher_edited'
  | 'answer_needs_recheck'
  | 'locked'
  | 'repair_needed'

export type AssessmentItemVersion = {
  id: string
  savedAt: string
  source: 'generated' | 'alternative' | 'teacher_edit' | 'repair' | 'restore'
  prompt: string
  pointStart?: number
  pointEnd?: number
  planEntryId?: string
  questionType: QuestionType
  answer: AssessmentAnswer
  rationale?: string
  teacherNotes?: string
  pointsPossible: number
  points?: number | null
  qaState?: AssessmentQaState
  visual?: AssessmentVisual
  visualRequirement?: AssessmentVisualRequirement
  visualIntent?: string
  visualStatus?: AssessmentVisualStatus
  visualAttempts?: number
  visualError?: string
  visualSourceHash?: string
  visualUpdatedAt?: string
}


export type AssessmentNumberingMode = 'legacy_items' | 'point_ranges'
export type AssessmentGenerationVersion = 'v1' | 'v2'
export type AssessmentCpdKey = 'remembering' | 'understanding' | 'applying' | 'analyzing' | 'evaluating' | 'creating' | 'other'
export type AssessmentQuestionTypeSuitability = 'strong' | 'allowed' | 'unsupported'

export type AssessmentV2PointBucket = {
  id: string
  rowId: string
  competencyId: string
  competencyCode: string | null
  competencyText: string
  cognitiveCategoryId: string
  cognitiveLabel: string
  cognitiveShortLabel: string
  cpdKey: AssessmentCpdKey
  sourceItemCount: number
  sourceAllocationItemStart: number
  sourceAllocationItemEnd: number
  pointsAllocated: number
}

export type AssessmentMasterPlanEntry = {
  id: string
  itemNumber: number
  pointStart: number
  pointEnd: number
  pointsPossible: number
  bucketId: string
  rowId: string
  competencyId: string
  cognitiveCategoryId: string
  questionType: QuestionType
  taskIntent: string
  visualRequirement: AssessmentVisualRequirement
  visualIntent: string
}

export type AssessmentMasterPlan = {
  schemaVersion: 1
  generationVersion: 'v2'
  numberingMode: 'point_ranges'
  totalPoints: number
  logicalItemCount: number
  plannerModel: string
  plannerFallbackUsed: boolean
  createdAt: string
  pointBuckets: AssessmentV2PointBucket[]
  entries: AssessmentMasterPlanEntry[]
}

export type AssessmentQuestionTypeMode = 'auto_balanced' | 'fixed_counts' | 'percentages' | 'manual_per_item'
export type AssessmentVisualPolicy = 'off' | 'balanced' | 'more_visuals'

export type AssessmentTypeDistribution = {
  mode: AssessmentQuestionTypeMode
  allowedTypes: QuestionType[]
  counts?: Partial<Record<QuestionType, number>>
  percentages?: Partial<Record<QuestionType, number>>
  /** Editable convenience defaults; scoring is always deterministic. */
  defaultPoints?: Partial<Record<QuestionType, number>>
  targetTotalPoints?: number | null
}

/** Compatibility aliases for callers that name this settings block explicitly. */
export type AssessmentQuestionTypeDistribution = AssessmentTypeDistribution
export type QuestionTypeDistribution = AssessmentTypeDistribution

export type AssessmentSettings = AssessmentTypeDistribution & {
  schemaVersion?: number
  generationVersion?: AssessmentGenerationVersion
  numberingMode?: AssessmentNumberingMode
  /** Teacher-authored constraints supplied before the one-call master plan. */
  generationInstructions?: string
  /** Frozen one-call V2 plan. Question generation may not mutate it. */
  masterPlan?: AssessmentMasterPlan
  /** Automatic diagram planning policy. Manual/existing visuals are always preserved. */
  visualPolicy?: AssessmentVisualPolicy
}

export type AssessmentBlueprint = {
  id: string
  userId: string
  assignmentId: string | null
  title: string
  instructions: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTermId: string
  gradingTermLabel: string
  curriculumPeriodIds: string[]
  curriculumPeriodLabels: string[]
  totalItems: number
  /** Derived from items; persisted only as a compatibility mirror when needed. */
  totalPoints?: number
  settings?: AssessmentSettings
  versionNumber: number
  status: AssessmentStatus
  sourceTos: AssessmentTosSnapshot
  items: AssessmentItem[]
  createdAt: string
  updatedAt: string
}

/** Public aliases used by callers that prefer “assessment” over “blueprint”. */
export type Assessment = AssessmentBlueprint
export type AssessmentRecord = AssessmentBlueprint

export type AssessmentFactoryOptions = {
  id?: string
  userId?: string
  assignmentId?: string | null
  title?: string
  instructions?: string
  status?: AssessmentStatus
  versionNumber?: number
  now?: string
}

export type AssessmentValidationSeverity = 'error' | 'warning'

export type AssessmentValidationIssue = {
  key: string
  message: string
  severity: AssessmentValidationSeverity
  itemId?: string
  itemNumber?: number
}

export type AssessmentValidationResult = {
  ready: boolean
  errors: AssessmentValidationIssue[]
  warnings: AssessmentValidationIssue[]
}

/** An immutable source snapshot shape for APIs that need to accept a record. */
export type AssessmentSourceTos = TosRecord | AssessmentTosSnapshot
