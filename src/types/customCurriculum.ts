export type CurriculumSourceKind = 'official' | 'custom' | 'hybrid'
export type CustomCurriculumImportStatus = 'draft' | 'analyzing' | 'analyzed' | 'approved' | 'rejected'
export type CustomCurriculumSourceKind = 'upload' | 'paste' | 'manual'
export type CustomCurriculumMode = 'custom' | 'hybrid'

export type CustomCurriculumPeriodDraft = {
  key: string
  label: string
  sequence: number
  periodType: 'term' | 'quarter' | 'semester' | 'year'
}

export type CustomCurriculumDomainDraft = {
  key: string
  code: string | null
  name: string
  sortOrder: number
}

export type CustomCurriculumStandardDraft = {
  standardType: 'content' | 'performance' | 'stage' | 'key_stage' | 'other'
  standardText: string
  domainKey: string | null
  periodKey: string | null
  sortOrder: number
  sourcePage: number | null
}

export type CustomCurriculumCompetencyDraft = {
  competencyCode: string | null
  competencyText: string
  domainKey: string | null
  periodKey: string | null
  sortOrder: number
  sourcePage: number | null
}

export type CustomCurriculumReview = {
  schemaVersion: 1
  curriculumMode: CustomCurriculumMode
  title: string
  organizationName: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
  periods: CustomCurriculumPeriodDraft[]
  domains: CustomCurriculumDomainDraft[]
  standards: CustomCurriculumStandardDraft[]
  competencies: CustomCurriculumCompetencyDraft[]
  warnings: string[]
}

export type CustomCurriculumImport = {
  id: string
  userId: string
  status: CustomCurriculumImportStatus
  sourceKind: CustomCurriculumSourceKind
  curriculumMode: CustomCurriculumMode
  baseCurriculumVersionId: string | null
  revisionOfVersionId: string | null
  title: string
  organizationName: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
  originalFilename: string | null
  mimeType: string | null
  storagePath: string | null
  fileSizeBytes: number
  sourceHash: string
  analysis: CustomCurriculumReview | null
  review: CustomCurriculumReview | null
  analysisModel: string | null
  fallbackUsed: boolean
  publishedVersionId: string | null
  errorCode: string | null
  createdAt: string
  updatedAt: string
}

export type CustomCurriculumChoice = {
  versionId: string
  originKind: 'custom' | 'hybrid'
  name: string
  organizationName: string | null
  revisionNumber: number
  gradeLevel: string
  learningArea: string
  schoolYear: string
  status: 'active' | 'superseded'
}

export function createManualCurriculumReview(input: {
  mode: CustomCurriculumMode
  title: string
  organizationName: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
}): CustomCurriculumReview {
  return {
    schemaVersion: 1,
    curriculumMode: input.mode,
    title: input.title,
    organizationName: input.organizationName,
    schoolYear: input.schoolYear,
    gradeLevel: input.gradeLevel,
    learningArea: input.learningArea,
    periods: [1, 2, 3, 4].map((sequence) => ({
      key: `period-${sequence}`,
      label: `Quarter ${sequence}`,
      sequence,
      periodType: 'quarter' as const,
    })),
    domains: [{ key: 'general', code: null, name: 'General', sortOrder: 0 }],
    standards: [],
    competencies: [],
    warnings: [],
  }
}
