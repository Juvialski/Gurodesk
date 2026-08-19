import type {
  AdminActivityEvent,
  AdminDirectoryFilter,
  AdminOverviewMetrics,
  AdminRegionStat,
  AdminRegistrationTrendPoint,
  AdminTeacherDetails,
  AdminTeacherRecord,
  AdminUserFlowData,
} from '../types/admin'
import {
  DEMO_ADMIN_ACTIVITY_EVENTS,
  DEMO_ADMIN_TEACHERS,
  getDemoOverviewMetrics,
  getDemoRegionStats,
  getDemoRegistrationTrends,
  getDemoTeacherDetails,
  getDemoUserFlow,
} from './adminDemo'
import { supabase } from './supabase'

export const EMPTY_ADMIN_OVERVIEW_METRICS: AdminOverviewMetrics = {
  totalUsers: 0,
  newUsersLast24Hours: 0,
  newUsersLast7Days: 0,
  newUsersLast30Days: 0,
  onboardingCompletedCount: 0,
  onboardingRatePercentage: 0,
  totalTeachingAssignments: 0,
  totalLessonPlans: 0,
  totalAssessments: 0,
  totalTosDocuments: 0,
  totalResultSessions: 0,
  totalLearnersEvaluated: 0,
  totalRemediationPlans: 0,
  activeUsersLast7Days: 0,
  aiConfiguredCount: 0,
}

export const EMPTY_ADMIN_USER_FLOW: AdminUserFlowData = {
  funnelStages: [
    { id: 'stage-signup', label: 'Signed Up', description: 'Total registered teacher accounts', count: 0, percentageOfTotal: 100, dropoffPercentage: 0, stepNumber: 1 },
    { id: 'stage-onboarding', label: 'Onboarding Completed', description: 'Profile and school identity verified', count: 0, percentageOfTotal: 0, dropoffPercentage: 0, stepNumber: 2 },
    { id: 'stage-assignments', label: 'Teaching Classes Setup', description: 'Added grade level, subject & sections', count: 0, percentageOfTotal: 0, dropoffPercentage: 0, stepNumber: 3 },
    { id: 'stage-lesson-plans', label: 'Lesson Plans Generated', description: 'Created DepEd DLL / DLP drafts', count: 0, percentageOfTotal: 0, dropoffPercentage: 0, stepNumber: 4 },
    { id: 'stage-assessments', label: 'Assessments Built', description: 'Built TOS and DepEd test questions', count: 0, percentageOfTotal: 0, dropoffPercentage: 0, stepNumber: 5 },
    { id: 'stage-results', label: 'Results & Item Analysis', description: 'Encoded scores and psychometric indices', count: 0, percentageOfTotal: 0, dropoffPercentage: 0, stepNumber: 6 },
    { id: 'stage-remediation', label: 'Remediation Plans', description: 'Targeted support for struggling competencies', count: 0, percentageOfTotal: 0, dropoffPercentage: 0, stepNumber: 7 },
  ],
  featureAdoptions: [
    { featureName: 'Lesson Planning (DO 42, s. 2016)', description: 'Daily Lesson Logs and Detailed Lesson Plans', activeTeachers: 0, percentageOfOnboarded: 0, totalEntitiesCreated: 0 },
    { featureName: 'Table of Specifications (TOS)', description: 'DepEd 60-30-10 cognitive item distributions', activeTeachers: 0, percentageOfOnboarded: 0, totalEntitiesCreated: 0 },
    { featureName: 'Assessment Engine (11 Question Types)', description: 'Test generation, DOCX/PDF export & print previews', activeTeachers: 0, percentageOfOnboarded: 0, totalEntitiesCreated: 0 },
    { featureName: 'Class Results & Item Analysis', description: 'Difficulty, discrimination & mastery tracking', activeTeachers: 0, percentageOfOnboarded: 0, totalEntitiesCreated: 0 },
    { featureName: 'Targeted Remediation', description: 'Personalized intervention plans for unmastered items', activeTeachers: 0, percentageOfOnboarded: 0, totalEntitiesCreated: 0 },
    { featureName: 'AI Assistance (Gemini BYOK)', description: 'Teachers with personal API key connected', activeTeachers: 0, percentageOfOnboarded: 0, totalEntitiesCreated: 0 },
  ],
  averageTimeFromSignupToFirstDocMinutes: null,
}

export async function loadAdminOverviewMetrics(demo: boolean): Promise<AdminOverviewMetrics> {
  if (demo) {
    return getDemoOverviewMetrics()
  }
  if (!supabase) {
    return EMPTY_ADMIN_OVERVIEW_METRICS
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_overview_metrics')
    if (error) {
      console.warn('Admin overview RPC returned error:', error)
      return EMPTY_ADMIN_OVERVIEW_METRICS
    }
    if (data) {
      return data as AdminOverviewMetrics
    }
    return EMPTY_ADMIN_OVERVIEW_METRICS
  } catch (err) {
    console.warn('Error loading admin overview metrics:', err)
    return EMPTY_ADMIN_OVERVIEW_METRICS
  }
}

export async function loadAdminRegistrationTrends(demo: boolean): Promise<AdminRegistrationTrendPoint[]> {
  if (demo) {
    return getDemoRegistrationTrends()
  }
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_registration_trends')
    if (error) {
      console.warn('Admin registration trends RPC returned error:', error)
      return []
    }
    return (data as AdminRegistrationTrendPoint[]) ?? []
  } catch (err) {
    console.warn('Error loading admin registration trends:', err)
    return []
  }
}

export async function loadAdminRegionStats(demo: boolean): Promise<AdminRegionStat[]> {
  if (demo) {
    return getDemoRegionStats()
  }
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_region_stats')
    if (error) {
      console.warn('Admin region stats RPC returned error:', error)
      return []
    }
    return (data as AdminRegionStat[]) ?? []
  } catch (err) {
    console.warn('Error loading admin region stats:', err)
    return []
  }
}

export async function loadAdminUserFlow(demo: boolean): Promise<AdminUserFlowData> {
  if (demo) {
    return getDemoUserFlow()
  }
  if (!supabase) {
    return EMPTY_ADMIN_USER_FLOW
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_user_flow')
    if (error) {
      console.warn('Admin user flow RPC returned error:', error)
      return EMPTY_ADMIN_USER_FLOW
    }
    return (data as AdminUserFlowData) ?? EMPTY_ADMIN_USER_FLOW
  } catch (err) {
    console.warn('Error loading admin user flow:', err)
    return EMPTY_ADMIN_USER_FLOW
  }
}

export async function loadAdminTeacherDirectory(
  filters: AdminDirectoryFilter = {},
  demo: boolean,
): Promise<{ teachers: AdminTeacherRecord[]; totalCount: number }> {
  if (demo) {
    let list = [...DEMO_ADMIN_TEACHERS]

    if (filters.searchQuery?.trim()) {
      const q = filters.searchQuery.trim().toLowerCase()
      list = list.filter((t) =>
        t.fullName.toLowerCase().includes(q) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        t.schoolName.toLowerCase().includes(q) ||
        (t.schoolId && t.schoolId.includes(q)) ||
        t.division.toLowerCase().includes(q)
      )
    }

    if (filters.region && filters.region !== 'all') {
      list = list.filter((t) => t.region === filters.region)
    }

    if (filters.division && filters.division !== 'all') {
      list = list.filter((t) => t.division === filters.division)
    }

    if (filters.onboardingStatus && filters.onboardingStatus !== 'all') {
      const target = filters.onboardingStatus === 'completed'
      list = list.filter((t) => t.onboardingCompleted === target)
    }

    const sortKey = filters.sortBy ?? 'createdAt'
    const isAsc = filters.sortDirection === 'asc'

    list.sort((a, b) => {
      let comparison = 0
      if (sortKey === 'fullName') {
        comparison = a.fullName.localeCompare(b.fullName)
      } else if (sortKey === 'documentsCount') {
        comparison = a.totalDocumentsCount - b.totalDocumentsCount
      } else if (sortKey === 'lastActiveAt') {
        comparison = (a.lastActiveAt ?? '').localeCompare(b.lastActiveAt ?? '')
      } else {
        comparison = a.createdAt.localeCompare(b.createdAt)
      }
      return isAsc ? comparison : -comparison
    })

    const totalCount = list.length
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 15
    const paginated = list.slice((page - 1) * pageSize, page * pageSize)

    return { teachers: paginated, totalCount }
  }

  if (!supabase) {
    return { teachers: [], totalCount: 0 }
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_teacher_directory', {
      p_search: filters.searchQuery ?? '',
      p_region: filters.region === 'all' ? '' : (filters.region ?? ''),
      p_division: filters.division === 'all' ? '' : (filters.division ?? ''),
      p_onboarding_status: filters.onboardingStatus ?? 'all',
      p_sort_by: filters.sortBy ?? 'createdAt',
      p_sort_direction: filters.sortDirection ?? 'desc',
      p_page: filters.page ?? 1,
      p_page_size: filters.pageSize ?? 15,
    })

    if (error) {
      console.warn('get_admin_teacher_directory RPC returned error:', error)
      return { teachers: [], totalCount: 0 }
    }

    const result = data as { teachers: AdminTeacherRecord[]; totalCount: number } | null
    return result ?? { teachers: [], totalCount: 0 }
  } catch (err) {
    console.warn('Directory error:', err)
    return { teachers: [], totalCount: 0 }
  }
}

export async function loadAdminTeacherDetails(userId: string, demo: boolean): Promise<AdminTeacherDetails | null> {
  if (demo) {
    return getDemoTeacherDetails(userId)
  }
  if (!supabase) {
    return null
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_teacher_details', { p_user_id: userId })
    if (error) {
      console.warn('get_admin_teacher_details RPC returned error:', error)
      return null
    }
    return (data as AdminTeacherDetails) ?? null
  } catch (err) {
    console.warn('Error loading teacher details:', err)
    return null
  }
}

export async function loadAdminRecentActivity(demo: boolean): Promise<AdminActivityEvent[]> {
  if (demo) {
    return DEMO_ADMIN_ACTIVITY_EVENTS
  }
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_recent_activity')
    if (error) {
      console.warn('get_admin_recent_activity RPC returned error:', error)
      return []
    }
    return (data as AdminActivityEvent[]) ?? []
  } catch (err) {
    console.warn('Error loading recent activity:', err)
    return []
  }
}

export function exportTeachersToCsv(teachers: AdminTeacherRecord[]): void {
  const headers = [
    'User ID',
    'Email',
    'Full Name',
    'School Name',
    'School ID',
    'Region',
    'Division',
    'District',
    'Position Title',
    'School Year',
    'Onboarding Completed',
    'Created At',
    'Last Active At',
    'Teaching Assignments',
    'Lesson Plans',
    'Assessments',
    'TOS Docs',
    'Results Sessions',
    'Remediation Plans',
    'Total Documents',
    'AI BYOK Configured',
  ]

  const rows = teachers.map((t) => [
    `"${t.id}"`,
    `"${t.email ?? ''}"`,
    `"${(t.fullName ?? '').replace(/"/g, '""')}"`,
    `"${(t.schoolName ?? '').replace(/"/g, '""')}"`,
    `"${t.schoolId ?? ''}"`,
    `"${(t.region ?? '').replace(/"/g, '""')}"`,
    `"${(t.division ?? '').replace(/"/g, '""')}"`,
    `"${(t.district ?? '').replace(/"/g, '""')}"`,
    `"${(t.positionTitle ?? '').replace(/"/g, '""')}"`,
    `"${t.schoolYear}"`,
    t.onboardingCompleted ? 'YES' : 'NO',
    `"${t.createdAt}"`,
    `"${t.lastActiveAt ?? ''}"`,
    t.assignmentsCount,
    t.lessonPlansCount,
    t.assessmentsCount,
    t.tosCount,
    t.resultSessionsCount,
    t.remediationPlansCount,
    t.totalDocumentsCount,
    t.hasAiConfigured ? 'YES' : 'NO',
  ])

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `gurodesk-teacher-directory-${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
