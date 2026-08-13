export type DocumentTemplateType = 'lesson_plan' | 'tos'
export type DocumentTemplateFileType = 'docx' | 'xlsx'
export type TemplateMappingMode = 'replace' | 'append_after_label'

export type DocxElementLocator =
  | { kind: 'body_paragraph'; paragraphIndex: number }
  | { kind: 'table_cell'; tableIndex: number; rowIndex: number; cellIndex: number; paragraphIndex: number }

export type DocumentTemplateElement = {
  id: string
  locator: DocxElementLocator
  kind: 'paragraph' | 'table_cell'
  text: string
  context: string
  suggestedMode: TemplateMappingMode
}

export type LessonTemplateFieldKey =
  | 'teacherName'
  | 'teacherPosition'
  | 'schoolName'
  | 'region'
  | 'division'
  | 'gradeLevel'
  | 'sections'
  | 'gradeSection'
  | 'learningArea'
  | 'lessonFocus'
  | 'lessonTitle'
  | 'lessonDate'
  | 'weekSchedule'
  | 'schoolYear'
  | 'gradingTerm'
  | 'curriculumPeriod'
  | 'sessionsDuration'
  | 'references'
  | 'competency'
  | 'performanceStandard'
  | 'learningObjectives'
  | 'learnerContext'
  | 'teachingApproaches'
  | 'preLessonActivity'
  | 'lessonFlow'
  | 'learningResources'
  | 'contextualization'
  | 'inclusionAccommodations'
  | 'homeBasedAlternative'
  | 'formativeAssessment'
  | 'evidenceOfLearning'
  | 'extendedLearning'
  | 'nextSteps'
  | 'reflection'
  | 'preparedBy'
  | 'reviewedBy'
  | 'notedBy'

export type DocumentTemplateMapping = {
  fieldKey: LessonTemplateFieldKey
  elementId: string
  locator: DocxElementLocator
  mode: TemplateMappingMode
  confidence: number | null
}

export type DocumentTemplate = {
  id: string
  userId: string
  name: string
  documentType: DocumentTemplateType
  fileType: DocumentTemplateFileType
  originalFilename: string
  storagePath: string
  fileSizeBytes: number
  sourceHash: string
  elements: DocumentTemplateElement[]
  mappings: DocumentTemplateMapping[]
  isDefault: boolean
  analysisModel: string | null
  createdAt: string
  updatedAt: string
}

export type TemplateAnalysisResult = {
  mappings: Array<{
    fieldKey: LessonTemplateFieldKey
    elementId: string
    mode: TemplateMappingMode
    confidence: number
  }>
  model: string
  fallbackUsed: boolean
}

export const LESSON_TEMPLATE_FIELDS: Array<{
  key: LessonTemplateFieldKey
  label: string
  group: 'Identity' | 'Lesson details' | 'Intentions' | 'Learning Experience' | 'Assessing Learning' | 'Ways Forward' | 'Signatures'
  important?: boolean
}> = [
  { key: 'teacherName', label: 'Teacher name', group: 'Identity', important: true },
  { key: 'teacherPosition', label: 'Teacher position/title', group: 'Identity' },
  { key: 'schoolName', label: 'School', group: 'Identity', important: true },
  { key: 'region', label: 'Region', group: 'Identity' },
  { key: 'division', label: 'Schools Division', group: 'Identity' },
  { key: 'gradeLevel', label: 'Grade level', group: 'Lesson details' },
  { key: 'sections', label: 'Section/s', group: 'Lesson details' },
  { key: 'gradeSection', label: 'Grade level and section/s', group: 'Lesson details', important: true },
  { key: 'learningArea', label: 'Learning area / subject', group: 'Lesson details', important: true },
  { key: 'lessonFocus', label: 'Lesson topic / focus', group: 'Lesson details', important: true },
  { key: 'lessonTitle', label: 'Lesson title', group: 'Lesson details', important: true },
  { key: 'lessonDate', label: 'Lesson date', group: 'Lesson details' },
  { key: 'weekSchedule', label: 'Week / schedule', group: 'Lesson details' },
  { key: 'schoolYear', label: 'School year', group: 'Lesson details' },
  { key: 'gradingTerm', label: 'School grading term', group: 'Lesson details' },
  { key: 'curriculumPeriod', label: 'Curriculum-guide period', group: 'Lesson details' },
  { key: 'sessionsDuration', label: 'Sessions / duration', group: 'Lesson details' },
  { key: 'references', label: 'References', group: 'Lesson details' },
  { key: 'competency', label: 'Learning competency', group: 'Intentions', important: true },
  { key: 'performanceStandard', label: 'Performance standard', group: 'Intentions' },
  { key: 'learningObjectives', label: 'Learning objectives / intentions', group: 'Intentions', important: true },
  { key: 'learnerContext', label: 'Learner context / readiness', group: 'Intentions' },
  { key: 'teachingApproaches', label: 'Teaching approaches', group: 'Learning Experience' },
  { key: 'preLessonActivity', label: 'Pre-lesson activity', group: 'Learning Experience' },
  { key: 'lessonFlow', label: 'Lesson flow / learning experience', group: 'Learning Experience', important: true },
  { key: 'learningResources', label: 'Learning resources / materials', group: 'Learning Experience' },
  { key: 'contextualization', label: 'Integration / contextualization', group: 'Learning Experience' },
  { key: 'inclusionAccommodations', label: 'Inclusion / accommodations', group: 'Learning Experience' },
  { key: 'homeBasedAlternative', label: 'Home-based / continuity alternative', group: 'Learning Experience' },
  { key: 'formativeAssessment', label: 'Formative assessment', group: 'Assessing Learning', important: true },
  { key: 'evidenceOfLearning', label: 'Evidence of learning', group: 'Assessing Learning' },
  { key: 'extendedLearning', label: 'Extended learning', group: 'Ways Forward' },
  { key: 'nextSteps', label: 'Next steps / intervention', group: 'Ways Forward', important: true },
  { key: 'reflection', label: 'Reflection', group: 'Ways Forward' },
  { key: 'preparedBy', label: 'Prepared by', group: 'Signatures' },
  { key: 'reviewedBy', label: 'Reviewed by', group: 'Signatures' },
  { key: 'notedBy', label: 'Noted by', group: 'Signatures' },
]
