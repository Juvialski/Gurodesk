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

export type LessonPlanContent = {
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
  competency: {
    id: string
    code: string | null
    text: string
    sourcePage: number | null
    sourceTitle: string | null
  }
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

export type LessonAiSupportRequest = {
  supportType: AiSupportType
  sectionKey: string
  text?: string
  targetLanguage?: string
  documentId?: string
  lessonContext: {
    gradeLevel: string
    learningArea: string
    competencyText: string
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
}
