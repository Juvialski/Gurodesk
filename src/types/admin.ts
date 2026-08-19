import type { TeacherAssignment } from './app'

export type AdminOverviewMetrics = {
  totalUsers: number
  newUsersLast24Hours: number
  newUsersLast7Days: number
  newUsersLast30Days: number
  onboardingCompletedCount: number
  onboardingRatePercentage: number
  totalTeachingAssignments: number
  totalLessonPlans: number
  totalAssessments: number
  totalTosDocuments: number
  totalResultSessions: number
  totalLearnersEvaluated: number
  totalRemediationPlans: number
  activeUsersLast7Days: number
  aiConfiguredCount: number
}

export type AdminRegistrationTrendPoint = {
  date: string
  label: string
  registrations: number
  cumulative: number
}

export type AdminRegionStat = {
  region: string
  teacherCount: number
  onboardingCount: number
  documentCount: number
  divisionsCount: number
}

export type AdminDivisionStat = {
  division: string
  region: string
  teacherCount: number
  documentCount: number
}

export type AdminFunnelStage = {
  id: string
  label: string
  description: string
  count: number
  percentageOfTotal: number
  dropoffPercentage: number
  stepNumber: number
}

export type AdminFeatureAdoption = {
  featureName: string
  description: string
  activeTeachers: number
  percentageOfOnboarded: number
  totalEntitiesCreated: number
}

export type AdminUserFlowData = {
  funnelStages: AdminFunnelStage[]
  featureAdoptions: AdminFeatureAdoption[]
  averageTimeFromSignupToFirstDocMinutes: number | null
}

export type AdminTeacherRecord = {
  id: string
  email: string | null
  fullName: string
  schoolName: string
  schoolId: string | null
  region: string
  division: string
  district: string
  districtVerified: boolean
  positionTitle: string
  schoolYear: string
  onboardingCompleted: boolean
  createdAt: string
  lastActiveAt: string | null
  assignmentsCount: number
  lessonPlansCount: number
  assessmentsCount: number
  tosCount: number
  resultSessionsCount: number
  remediationPlansCount: number
  totalDocumentsCount: number
  hasAiConfigured: boolean
}

export type AdminTeacherDetails = AdminTeacherRecord & {
  assignments: TeacherAssignment[]
  recentDocuments: Array<{
    id: string
    title: string
    documentType: string
    schoolYear: string
    academicPeriodLabel: string | null
    status: string
    createdAt: string
    updatedAt: string
  }>
  recentActivity: Array<{
    type: string
    title: string
    timestamp: string
    details?: string
  }>
}

export type AdminActivityEventType =
  | 'user_registered'
  | 'onboarding_completed'
  | 'assignment_created'
  | 'lesson_plan_created'
  | 'assessment_created'
  | 'tos_created'
  | 'results_encoded'
  | 'remediation_created'

export type AdminActivityEvent = {
  id: string
  type: AdminActivityEventType
  userId: string
  userEmail: string | null
  userName: string
  schoolName: string
  region: string
  title: string
  timestamp: string
}

export type AdminDirectoryFilter = {
  searchQuery?: string
  region?: string
  division?: string
  onboardingStatus?: 'all' | 'completed' | 'pending'
  sortBy?: 'createdAt' | 'fullName' | 'documentsCount' | 'lastActiveAt'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}
