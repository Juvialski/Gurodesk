export type ExportPaperSize = 'a4' | 'letter' | 'legal'
export type ExportDocumentLanguage = 'match' | 'english' | 'filipino'

// Keep stored IDs stable so existing teacher preferences continue to load.
export type ExportTemplateId = 'gurodesk_ilaw_standard' | 'gurodesk_ilaw_multisession'

export type TeacherExportPreferences = {
  userId: string
  defaultTemplateId: ExportTemplateId
  paperSize: ExportPaperSize
  documentLanguage: ExportDocumentLanguage
  preparedByName: string
  preparedByTitle: string
  reviewedByName: string
  reviewedByTitle: string
  notedByName: string
  notedByTitle: string
  // Retained only for backwards compatibility with the existing database schema.
  // Phase 3.6+ exports intentionally ignore these flags and stay plain.
  includeAiDeclaration: boolean
  includeSourceProvenance: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type LessonExportIdentity = {
  teacherName: string
  positionTitle: string
  schoolName: string
  region: string
  division: string
  district: string
}

export type LessonExportSection = {
  key: string
  heading: string
  body: string
}

export type MultiSessionGridRow = {
  key: string
  heading: string
  guideQuestions?: string
  sessions: string[] // 4 session cells
  isFullSpan?: boolean
  fullSpanContent?: string
}

export type LessonPlanMultiSessionLabels = {
  lessonName: string
  learningArea: string
  termWeek: string
  gradeSection: string
  teacher: string
  sessionsDuration: string
  references: string
  officialReferences: string
  otherSources: string
  lowTechAlternatives: string
  aiDeclaration: string
  matrixHeading: string
  dimensionsGuide: string
  rubricHeading: string
  rubricCriterion: string
  yes: string
  notYet: string
  improvement: string
  coachingHeading: string
  coachingPlaceholder: string
  footer: string
  noEntry: string
}

export type SelfCheckRubricItem = {
  criterion: string
  status: 'yes' | 'not_yet' | 'empty'
  improvementNote?: string
}

export type LessonPlanMultiSessionExportModel = {
  documentTitle: string
  templateLabel: string
  language: 'english' | 'filipino'
  labels: LessonExportLabels
  multiLabels: LessonPlanMultiSessionLabels
  status: 'draft' | 'final' | 'archived'
  identity: LessonExportIdentity
  lesson: {
    title: string
    schoolYear: string
    gradeLevel: string
    learningArea: string
    sections: string
    curriculumPeriod: string
    gradingTerm: string
    lessonDate: string
    weekLabel: string
    sessions: string
    duration: string
  }
  sessionHeaders: string[]
  referencesDetail: {
    officialReferences: string[]
    otherLearningSources: string[]
    lowTechAlternatives: string[]
  }
  aiDeclarationStatement: string
  rows: MultiSessionGridRow[]
  rubricItems: SelfCheckRubricItem[]
  coachingNotes: string
  signatories: Array<{ role: string; name: string; title: string }>
}

export type LessonExportLabels = {
  republic: string
  department: string
  documentTitle: string
  teacher: string
  gradeSection: string
  learningArea: string
  lessonTitle: string
  date: string
  weekSchedule: string
  schoolYear: string
  gradingTerm: string
  curriculumPeriod: string
  sessionsDuration: string
  references: string
  intentions: string
  learningExperience: string
  assessingLearning: string
  waysForward: string
  signatures: string
  preparedBy: string
  reviewedBy: string
  notedBy: string
  sessionUnit: string
  draftCopy: string
  archivedCopy: string
}

export type LessonPlanExportModel = {
  documentTitle: string
  templateLabel: string
  language: 'english' | 'filipino'
  labels: LessonExportLabels
  status: 'draft' | 'final' | 'archived'
  identity: LessonExportIdentity
  lesson: {
    title: string
    schoolYear: string
    gradeLevel: string
    learningArea: string
    sections: string
    curriculumPeriod: string
    gradingTerm: string
    lessonDate: string
    weekLabel: string
    sessions: string
    duration: string
  }
  ilaw: {
    intentions: LessonExportSection[]
    learningExperience: LessonExportSection[]
    assessingLearning: LessonExportSection[]
    waysForward: LessonExportSection[]
  }
  references: string
  signatories: Array<{ role: string; name: string; title: string }>
  multiSession?: LessonPlanMultiSessionExportModel
}

export const EXPORT_TEMPLATE_OPTIONS: Array<{ id: ExportTemplateId; label: string; description: string }> = [
  {
    id: 'gurodesk_ilaw_standard',
    label: 'ILAW Standard',
    description: 'Plain printable ILAW lesson-plan layout using Intentions, Learning Experience, Assessing Learning, and Ways Forward.',
  },
  {
    id: 'gurodesk_ilaw_multisession',
    label: 'Daily Lesson Log (DLL)',
    description: 'Four-session weekly grid with session-by-session flow, formative assessment, and reflection.',
  },
]

export const EXPORT_PAPER_OPTIONS: Array<{ id: ExportPaperSize; label: string }> = [
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'Letter' },
  { id: 'legal', label: 'Legal' },
]

export const EXPORT_DOCUMENT_LANGUAGE_OPTIONS: Array<{ id: ExportDocumentLanguage; label: string; description: string }> = [
  { id: 'match', label: 'Match lesson language', description: 'Uses Filipino labels for Filipino lessons and English labels otherwise.' },
  { id: 'english', label: 'English', description: 'Always use English document labels.' },
  { id: 'filipino', label: 'Filipino', description: 'Always use Filipino document labels.' },
]

export function createDefaultTeacherExportPreferences(userId: string): TeacherExportPreferences {
  return {
    userId,
    defaultTemplateId: 'gurodesk_ilaw_standard',
    paperSize: 'a4',
    documentLanguage: 'match',
    preparedByName: '',
    preparedByTitle: '',
    reviewedByName: '',
    reviewedByTitle: '',
    notedByName: '',
    notedByTitle: '',
    includeAiDeclaration: false,
    includeSourceProvenance: false,
    createdAt: null,
    updatedAt: null,
  }
}
