import type { AssessmentAnswer, AssessmentCompetencySnapshot, AssessmentCognitiveCategorySnapshot, AssessmentStatus, QuestionType } from './assessment'
import type { AssessmentVisual } from './assessmentVisual'
import type { ExportDocumentLanguage, ExportPaperSize } from './export'

export type AssessmentExportMode = 'student' | 'teacher' | 'answer_key'
export type AssessmentExportDocumentLanguage = ExportDocumentLanguage

export type AssessmentExportOptions = {
  mode: AssessmentExportMode
  documentLanguage?: AssessmentExportDocumentLanguage
  paperSize?: ExportPaperSize
  teacherName?: string
  positionTitle?: string
  schoolName?: string
  region?: string
  division?: string
  district?: string
  learnerName?: string
  section?: string
  includeAnswer?: boolean
  includeCompetency?: boolean
  includeCognitiveCategory?: boolean
  includeRationale?: boolean
}

export type AssessmentExportLabels = {
  documentTitle: string
  teacher: string
  school: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTerm: string
  curriculumPeriods: string
  learnerName: string
  section: string
  instructions: string
  answer: string
  answerKey: string
  competency: string
  cognitiveCategory: string
  rationale: string
  points: string
  choicePrefix: string
  responseLine: string
  totalItems: string
  totalPoints: string
  solution: string
  rubric: string
  columnA: string
  columnB: string
  tolerance: string
}

export type AssessmentExportMetadata = {
  teacherName: string
  positionTitle: string
  schoolName: string
  region: string
  division: string
  district: string
  learnerName?: string
  section?: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTerm: string
  curriculumPeriods?: string
  totalItems?: number
  totalPoints?: number
  numberingMode?: 'legacy_items' | 'point_ranges'
}

/** Public export payload. IDs are intentionally optional and are never used
 * in student projections. Internal answer IDs may be used only by the
 * deterministic teacher/answer-key renderer to create visible A/B labels. */
export type AssessmentExportQuestionBase = {
  itemNumber: number
  numberLabel?: string
  prompt: string
  questionType: QuestionType
  answerSpaceLines: number
  pointsPossible: number
  /** Safe, learner-visible visual independent of answer/mapping metadata. */
  visual?: AssessmentVisual
  /** Legacy alias retained for prior renderer callers. */
  points?: number | null
  choices?: Array<{ id: string; text: string; label?: string }>
  prompts?: Array<{ id: string; text: string; label?: string }>
  blanks?: Array<{ label: string; answerSpaceLines?: number }>
  /** Learner-safe problem subparts: no expected answer or internal ID. */
  subparts?: Array<{ label: string; prompt: string; pointsPossible: number }>
  responseInstructions?: string
}

export type AssessmentStudentExportQuestion = Omit<AssessmentExportQuestionBase, 'choices' | 'prompts' | 'blanks'> & {
  choices?: string[]
  prompts?: string[]
  blanks?: Array<{ label: string; answerSpaceLines?: number }>
}

export type AssessmentTeacherExportQuestion = AssessmentExportQuestionBase & {
  answer?: AssessmentAnswer
  competency?: AssessmentCompetencySnapshot
  cognitiveCategory?: AssessmentCognitiveCategorySnapshot
  rationale?: string
  scoringGuide?: string
}

export type AssessmentAnswerKeyExportQuestion = {
  itemNumber: number
  numberLabel?: string
  questionType: QuestionType
  answerSpaceLines: number
  pointsPossible: number
  visual?: AssessmentVisual
  points?: number | null
  answer: AssessmentAnswer
  scoringGuide?: string
}

export type AssessmentExportQuestion = AssessmentStudentExportQuestion | AssessmentTeacherExportQuestion | AssessmentAnswerKeyExportQuestion

export type AssessmentExportModel = {
  mode: AssessmentExportMode
  language: 'english' | 'filipino'
  labels: AssessmentExportLabels
  status: AssessmentStatus
  title: string
  instructions: string
  metadata: AssessmentExportMetadata
  questions: AssessmentExportQuestion[]
}
