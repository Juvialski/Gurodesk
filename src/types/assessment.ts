import type { TosContent, TosRecord } from './tos'

export type AssessmentStatus = 'draft' | 'final' | 'archived'

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'constructed_response'

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

export type AssessmentConstructedResponseAnswer = {
  type: 'constructed_response'
  expectedResponse: string
  sampleResponse: string
  rubricGuidance?: string
}

export type AssessmentAnswer =
  | AssessmentMultipleChoiceAnswer
  | AssessmentTrueFalseAnswer
  | AssessmentShortAnswer
  | AssessmentConstructedResponseAnswer

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
  points?: number | null
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
