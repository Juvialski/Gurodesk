export type AiRevisionSupportType = 'refine_clarity' | 'organize_text' | 'grammar_spelling' | 'format_text' | 'translate'

export type AiSuggestionSupportType =
  | 'suggest_learning_objectives'
  | 'suggest_home_alternative'
  | 'suggest_pre_lesson'
  | 'suggest_lesson_flow'
  | 'suggest_contextualization'
  | 'suggest_inclusion'
  | 'suggest_formative_assessment'
  | 'suggest_evidence_of_learning'
  | 'suggest_next_steps'
  | 'suggest_extended_learning'
  | 'quick_draft'

export type AiSupportType = AiRevisionSupportType | AiSuggestionSupportType

export type LessonPlanStatus = 'draft' | 'final' | 'archived'

export type LessonPlanAiDeclaration = {
  used: boolean
  categories: Array<'limited' | 'guided' | 'suggested'>
  operations: AiSupportType[]
  statement: string
  reviewedByTeacher: boolean
}

export type LessonAiSuggestionReview = {
  pendingSections: string[]
  lastQuickDraftAt: string | null
}

export type LessonPlanCompetencySnapshot = {
  id: string
  code: string | null
  text: string
  sourcePage: number | null
  sourceTitle: string | null
  academicPeriodId: string | null
  curriculumPeriodLabel: string
  domainId: string | null
  contentArea: string
  contentStandards: string[]
  performanceStandards: string[]
  verificationStatus: 'verified'
}

export type LegacyLessonPlanCompetencySnapshot = Pick<
  LessonPlanCompetencySnapshot,
  'id' | 'code' | 'text' | 'sourcePage' | 'sourceTitle'
> & Partial<Pick<
  LessonPlanCompetencySnapshot,
  | 'academicPeriodId'
  | 'curriculumPeriodLabel'
  | 'domainId'
  | 'contentArea'
  | 'contentStandards'
  | 'performanceStandards'
  | 'verificationStatus'
>>

export type LessonPlanAlignmentMode = 'curriculum_aligned' | 'topic_only'

export type LessonPlanAlignmentPurpose =
  | 'regular'
  | 'review'
  | 'remediation'
  | 'enrichment'
  | 'locally_developed'
  | 'interdisciplinary'
  | 'other'

type LessonPlanContentBase = {
  schemaVersion: 1
  framework: 'ILAW'
  policyCode: 'DO 016, s. 2026'
  lessonTitle: string
  gradeLevel: string
  learningArea: string
  sections: string[]
  schoolYear: string
  curriculumPeriodLabel: string
  gradingTermLabel: string
  lessonDate: string
  weekLabel: string
  numberOfSessions: number
  durationMinutes: number
  references: string
  resourcesVerifiedByTeacher: boolean
  performanceStandard: string
  learnerContext: string
  intentions: {
    learningObjectives: string
  }
  learningExperience: {
    resources: string
    homeBasedAlternative: string
    preLessonActivity: string
    lessonFlow: string
    integrationContextualization: string
    inclusionAccommodations: string
  }
  assessingLearning: {
    formativeAssessments: string
    evidenceOfLearning: string
  }
  waysForward: {
    reflection: string
    nextSteps: string
    extendedLearning: string
  }
  aiDeclaration: LessonPlanAiDeclaration
  aiSuggestionReview: LessonAiSuggestionReview
}

export type LegacyLessonPlanContentV1 = Omit<
  LessonPlanContentBase,
  'schemaVersion' | 'resourcesVerifiedByTeacher' | 'aiSuggestionReview'
> & {
  schemaVersion: 1
  resourcesVerifiedByTeacher?: boolean
  aiSuggestionReview?: LessonAiSuggestionReview
  competency: LegacyLessonPlanCompetencySnapshot
}

export type LessonPlanContent = Omit<LessonPlanContentBase, 'schemaVersion'> & {
  schemaVersion: 2
  lessonFocus: string
  lessonFocusSource: 'teacher' | 'curriculum_derived'
  lessonFocusSourceId: string | null
  lessonLanguage: string
  teachingApproaches: string[]
  curriculumAlignments: LessonPlanCompetencySnapshot[]
  primaryCompetencyId: string | null
  alignmentMode: LessonPlanAlignmentMode
  alignmentPurpose: LessonPlanAlignmentPurpose
  alignmentNote: string
  /** Compatibility projection of the primary alignment for older consumers. */
  competency: LessonPlanCompetencySnapshot
}

export type LessonPlanRecord = {
  id: string
  userId: string
  assignmentId: string | null
  title: string
  schoolYear: string
  academicPeriodLabel: string | null
  status: LessonPlanStatus
  content: LessonPlanContent
  createdAt: string
  updatedAt: string
}

export type LessonPlanValidationItem = {
  key: string
  label: string
  passed: boolean
  detail: string
}

export type LessonPlanValidationResult = {
  ready: boolean
  score: number
  items: LessonPlanValidationItem[]
}

export type LessonAiTeachingSetup = {
  languagePreference: string
  localLanguageName: string
  typicalClassProfile: string
  availableTechnology: string[]
  preferredApproaches: string[]
  actualResources: string[]
  resourceNotes: string
}

export type LessonAiCompetencyContext = Pick<
  LessonPlanCompetencySnapshot,
  'id' | 'code' | 'text' | 'sourcePage' | 'sourceTitle'
>

export type LessonAiSupportRequest = {
  supportType: AiSupportType
  sectionKey: string
  text?: string
  targetLanguage?: string
  documentId?: string
  lessonContext: {
    assignmentId?: string | null
    gradeLevel: string
    learningArea: string
    lessonFocus: string
    primaryCompetency?: LessonAiCompetencyContext | null
    additionalCompetencies: LessonAiCompetencyContext[]
    /** Legacy alias retained during the request-contract transition. */
    competencyText?: string
    performanceStandard?: string
    teacherIntent: string
    curriculumPeriodLabel?: string
    gradingTermLabel?: string
    durationMinutes?: number
    numberOfSessions?: number
    learnerContext?: string
    currentFormativeAssessment?: string
    teachingSetup?: LessonAiTeachingSetup
  }
}

export type LessonQuickDraft = {
  lessonTitle?: string
  learningObjectives?: string
  homeBasedAlternative?: string
  preLessonActivity?: string
  lessonFlow?: string
  integrationContextualization?: string
  inclusionAccommodations?: string
  formativeAssessments?: string
  evidenceOfLearning?: string
  nextSteps?: string
  extendedLearning?: string
}

export type LessonAiSupportResponse = {
  output?: string
  suggestions?: string[]
  draft?: LessonQuickDraft
  model: string
  preferredModel?: string
  fallbackUsed?: boolean
  thinkingLevel?: 'high' | 'model_default'
  supportType: AiSupportType
  declarationCategory: 'limited' | 'guided' | 'suggested'
  curriculumContextWarning?: string
}
