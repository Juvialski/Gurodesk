export type AiSupportType = 'refine_clarity' | 'organize_text' | 'grammar_spelling' | 'format_text' | 'translate'

export type LessonPlanStatus = 'draft' | 'final' | 'archived'

export type LessonPlanAiDeclaration = {
  used: boolean
  categories: Array<'limited' | 'guided'>
  operations: AiSupportType[]
  statement: string
  reviewedByTeacher: boolean
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

export type LessonAiSupportRequest = {
  supportType: AiSupportType
  sectionKey: string
  text: string
  targetLanguage?: string
  documentId?: string
  lessonContext: {
    gradeLevel: string
    learningArea: string
    competencyText: string
    teacherIntent: string
  }
}

export type LessonAiSupportResponse = {
  output: string
  model: string
  supportType: AiSupportType
  declarationCategory: 'limited' | 'guided'
}
