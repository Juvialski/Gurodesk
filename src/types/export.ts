export type ExportPaperSize = 'a4' | 'letter' | 'legal'

// Keep the stored ID stable so existing teacher preferences continue to load.
export type ExportTemplateId = 'gurodesk_ilaw_standard'

export type TeacherExportPreferences = {
  userId: string
  defaultTemplateId: ExportTemplateId
  paperSize: ExportPaperSize
  preparedByName: string
  preparedByTitle: string
  reviewedByName: string
  reviewedByTitle: string
  notedByName: string
  notedByTitle: string
  // Retained only for backwards compatibility with the existing database schema.
  // Phase 3.6.1 exports intentionally ignore these flags and stay plain.
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
}

export type LessonExportSection = {
  key: string
  heading: string
  body: string
}

export type LessonPlanExportModel = {
  documentTitle: string
  templateLabel: string
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
}

export const EXPORT_TEMPLATE_OPTIONS: Array<{ id: ExportTemplateId; label: string; description: string }> = [
  {
    id: 'gurodesk_ilaw_standard',
    label: 'ILAW Standard',
    description: 'Plain printable ILAW lesson-plan layout using Intentions, Learning Experience, Assessing Learning, and Ways Forward.',
  },
]

export const EXPORT_PAPER_OPTIONS: Array<{ id: ExportPaperSize; label: string }> = [
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'Letter' },
  { id: 'legal', label: 'Legal' },
]

export function createDefaultTeacherExportPreferences(userId: string): TeacherExportPreferences {
  return {
    userId,
    defaultTemplateId: 'gurodesk_ilaw_standard',
    paperSize: 'a4',
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
