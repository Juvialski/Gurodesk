export type BackendMode = 'supabase' | 'demo'

export type Profile = {
  id: string
  email: string | null
  fullName: string
  schoolName: string
  region: string
  division: string
  positionTitle: string
  schoolYear: string
  onboardingCompleted: boolean
}

export type TeacherAssignment = {
  id: string
  userId: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
  sections: string[]
  isActive: boolean
}

export type AcademicPeriodType = 'term' | 'quarter' | 'semester' | 'year'

export type CurriculumVersion = {
  id: string
  code: string
  name: string
  framework: string
  effectiveFromSchoolYear: string
  effectiveToSchoolYear: string | null
  status: 'draft' | 'active' | 'superseded'
}

export type AppUser = {
  id: string
  email: string | null
}

export type DashboardMetric = {
  label: string
  value: string
  hint: string
  tone: 'blue' | 'green' | 'amber' | 'slate'
}
