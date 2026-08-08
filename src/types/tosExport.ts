import type { TosStatus } from './tos'

export type TosExportIdentity = {
  teacherName: string
  positionTitle: string
  schoolName: string
  region: string
  division: string
}

export type TosExportRow = {
  rowNumber: number
  competencyCode: string
  competency: string
  curriculumPeriod: string
  instructionalMinutes: number | null
  weightPercent: number
  cognitiveItems: number[]
  itemCount: number
  itemPlacement: string
  notes: string
}

export type TosExportModel = {
  documentTitle: 'TABLE OF SPECIFICATIONS'
  status: TosStatus
  identity: TosExportIdentity
  title: string
  assessmentTitle: string
  gradeLevel: string
  learningArea: string
  sections: string
  schoolYear: string
  gradingTerm: string
  curriculumPeriod: string
  totalItems: number
  weightingMethod: string
  categories: Array<{ id: string; label: string; shortLabel: string }>
  rows: TosExportRow[]
  notes: string
  signatories: Array<{ role: string; name: string; title: string }>
}
