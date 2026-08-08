export type SourceVerificationStatus = 'pending' | 'verified' | 'rejected' | 'superseded'

export type SourceDocument = {
  id: string
  sourceType: 'curriculum_guide' | 'deped_order' | 'memorandum' | 'advisory' | 'other'
  title: string
  issuanceCode: string | null
  sourceUrl: string | null
  publishedOn: string | null
  verificationStatus: SourceVerificationStatus
}

export type CurriculumVersionSummary = {
  id: string
  code: string
  name: string
  framework: string
  effectiveFromSchoolYear: string
  effectiveToSchoolYear: string | null
  status: 'draft' | 'active' | 'superseded'
  implementationNotes?: string | null
}

export type CurriculumPeriod = {
  id: string
  label: string
  sequence: number
  periodType: 'term' | 'quarter' | 'semester' | 'year'
}

export type CurriculumStandard = {
  id: string
  standardType: 'content' | 'performance' | 'stage' | 'key_stage' | 'other'
  standardText: string
  domainId: string | null
  academicPeriodId: string | null
  sourcePage: number | null
}

export type CurriculumCompetency = {
  id: string
  competencyCode: string | null
  competencyText: string
  sortOrder: number
  domainId: string | null
  academicPeriodId: string | null
  sourcePage: number | null
  verificationStatus: 'pending' | 'verified' | 'rejected'
}

export type CurriculumDomain = {
  id: string
  code: string | null
  name: string
  sortOrder: number
}

export type CurriculumSubject = {
  id: string
  gradeLevel: string
  code: string | null
  name: string
  description: string | null
}

export type CurriculumNavigatorBundle = {
  available: boolean
  schoolYear: string
  gradeLevel: string
  learningArea: string
  version: CurriculumVersionSummary | null
  subject: CurriculumSubject | null
  periods: CurriculumPeriod[]
  domains: CurriculumDomain[]
  standards: CurriculumStandard[]
  competencies: CurriculumCompetency[]
  source: SourceDocument | null
  coverageNote: string | null
}

export type GradingPeriod = {
  id: string
  label: string
  sequence: number
  startsOn: string | null
  endsOn: string | null
}

export type SchoolYearCalendar = {
  id: string
  schoolYear: string
  calendarType: 'three_term' | 'four_quarter' | 'semester' | 'other'
  gradingPeriodCount: number
  status: 'draft' | 'active' | 'superseded'
  notes: string | null
  periods: GradingPeriod[]
  source: SourceDocument | null
}
