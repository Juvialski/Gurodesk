import type { AssessmentAnswer, AssessmentCompetencySnapshot, AssessmentCognitiveCategorySnapshot, AssessmentStatus } from './assessment'
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
}

export type AssessmentExportMetadata = {
  teacherName: string
  positionTitle: string
  schoolName: string
  region: string
  division: string
  learnerName?: string
  section?: string
  gradeLevel: string
  learningArea: string
  schoolYear: string
  gradingTerm: string
  curriculumPeriods?: string
}

export type AssessmentExportQuestionBase = {
  itemNumber: number
  prompt: string
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'constructed_response'
  choices: Array<{ id: string; text: string }>
  answerSpaceLines: number
  points?: number | null
}

/** Student-safe question shape: no answer, mapping, AI/review state, or IDs. */
export type AssessmentStudentExportQuestion = Omit<AssessmentExportQuestionBase, 'choices'> & {
  choices: string[]
}

export type AssessmentTeacherExportQuestion = AssessmentExportQuestionBase & {
  answer?: AssessmentAnswer
  competency?: AssessmentCompetencySnapshot
  cognitiveCategory?: AssessmentCognitiveCategorySnapshot
  rationale?: string
}

/** Compact answer-key entry: item number and the structured answer only. */
export type AssessmentAnswerKeyExportQuestion = {
  itemNumber: number
  questionType: AssessmentExportQuestionBase['questionType']
  answerSpaceLines: number
  points?: number | null
  answer: AssessmentAnswer
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
