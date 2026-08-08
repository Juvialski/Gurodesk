export type TosStatus = 'draft' | 'final' | 'archived'

export type TosWeightingMethod = 'equal' | 'instructional_time' | 'manual_percentage'

export type TosCognitiveCategory = {
  id: string
  label: string
  shortLabel: string
  weight: string
  sortOrder: number
}

export type TosCompetencySnapshot = {
  id: string
  code: string | null
  text: string
  sourcePage: number | null
  sourceTitle: string | null
  sourceUrl: string | null
  academicPeriodId: string | null
  curriculumPeriodLabel: string
  verificationStatus: 'verified'
}

export type TosCognitiveAllocation = {
  categoryId: string
  label: string
  shortLabel: string
  itemCount: number
  itemStart: number | null
  itemEnd: number | null
  rangeLabel: string
}

export type TosCompetencyRow = {
  id: string
  sortOrder: number
  competency: TosCompetencySnapshot
  instructionalMinutes: string
  manualWeight: string
  itemCountOverride: string
  cognitiveWeights: Record<string, string>
  notes: string
  computedWeightPercent: string
  itemCount: number
  itemStart: number | null
  itemEnd: number | null
  itemRangeLabel: string
  cognitiveAllocations: TosCognitiveAllocation[]
}

export type TosCalculation = {
  engine: 'hamilton-largest-remainder-v1'
  valid: boolean
  totalAllocated: number
  calculatedAt: string | null
  warnings: string[]
}

export type TosContent = {
  schemaVersion: 1
  title: string
  assessmentTitle: string
  gradeLevel: string
  learningArea: string
  sections: string[]
  schoolYear: string
  gradingTermId: string
  gradingTermLabel: string
  curriculumVersionId: string
  curriculumVersionCode: string
  curriculumVersionName: string
  curriculumSubjectId: string
  curriculumPeriodIds: string[]
  curriculumPeriodLabels: string[]
  sourceTitle: string
  sourceUrl: string
  totalItems: number
  weightingMethod: TosWeightingMethod
  cognitiveCategories: TosCognitiveCategory[]
  rows: TosCompetencyRow[]
  notes: string
  calculation: TosCalculation
}

export type TosRecord = {
  id: string
  userId: string
  assignmentId: string | null
  title: string
  schoolYear: string
  academicPeriodLabel: string | null
  status: TosStatus
  content: TosContent
  versionNumber: number
  createdAt: string
  updatedAt: string
}

export type TosValidationSeverity = 'error' | 'warning'

export type TosValidationIssue = {
  key: string
  severity: TosValidationSeverity
  message: string
  rowId?: string
}

export type TosValidationResult = {
  ready: boolean
  errors: TosValidationIssue[]
  warnings: TosValidationIssue[]
}

export type InstructionalPacingEntry = {
  competencyId: string
  gradingPeriodId: string | null
  suggestedSessions: number | null
  suggestedMinutes: number | null
  weekNumber: number | null
  pacingNote: string | null
}

export type InstructionalPacingBundle = {
  available: boolean
  planId: string | null
  planTitle: string | null
  entries: InstructionalPacingEntry[]
}
