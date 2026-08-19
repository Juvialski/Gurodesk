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

export async function loadAdminOverviewMetrics(demo: boolean): Promise<AdminOverviewMetrics> {
  if (demo || !supabase) {
    return getDemoOverviewMetrics()
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_overview_metrics')
    if (error) {
      console.warn('Admin overview RPC failed, falling back to aggregate queries or demo data', error)
      return getDemoOverviewMetrics()
    }
    if (data) {
      return data as AdminOverviewMetrics
    }
    return getDemoOverviewMetrics()
  } catch (err) {
    console.warn('Error loading admin overview metrics:', err)
    return getDemoOverviewMetrics()
  }
}

export async function loadAdminRegistrationTrends(demo: boolean): Promise<AdminRegistrationTrendPoint[]> {
  if (demo || !supabase) {
    return getDemoRegistrationTrends()
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_registration_trends')
    if (error) {
      return getDemoRegistrationTrends()
    }
    return (data as AdminRegistrationTrendPoint[]) ?? getDemoRegistrationTrends()
  } catch {
    return getDemoRegistrationTrends()
  }
}

export async function loadAdminRegionStats(demo: boolean): Promise<AdminRegionStat[]> {
  if (demo || !supabase) {
    return getDemoRegionStats()
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_region_stats')
    if (error) {
      return getDemoRegionStats()
    }
    return (data as AdminRegionStat[]) ?? getDemoRegionStats()
  } catch {
    return getDemoRegionStats()
  }
}

export async function loadAdminUserFlow(demo: boolean): Promise<AdminUserFlowData> {
  if (demo || !supabase) {
    return getDemoUserFlow()
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_user_flow')
    if (error) {
      return getDemoUserFlow()
    }
    return (data as AdminUserFlowData) ?? getDemoUserFlow()
  } catch {
    return getDemoUserFlow()
  }
}

export async function loadAdminTeacherDirectory(
  filters: AdminDirectoryFilter = {},
  demo: boolean,
): Promise<{ teachers: AdminTeacherRecord[]; totalCount: number }> {
  if (demo || !supabase) {
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
      console.warn('get_admin_teacher_directory RPC returned error, using fallback:', error)
      return { teachers: DEMO_ADMIN_TEACHERS, totalCount: DEMO_ADMIN_TEACHERS.length }
    }

    const result = data as { teachers: AdminTeacherRecord[]; totalCount: number } | null
    return result ?? { teachers: DEMO_ADMIN_TEACHERS, totalCount: DEMO_ADMIN_TEACHERS.length }
  } catch (err) {
    console.warn('Directory error:', err)
    return { teachers: DEMO_ADMIN_TEACHERS, totalCount: DEMO_ADMIN_TEACHERS.length }
  }
}

export async function loadAdminTeacherDetails(userId: string, demo: boolean): Promise<AdminTeacherDetails | null> {
  if (demo || !supabase) {
    return getDemoTeacherDetails(userId)
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_teacher_details', { p_user_id: userId })
    if (error) {
      return getDemoTeacherDetails(userId)
    }
    return (data as AdminTeacherDetails) ?? getDemoTeacherDetails(userId)
  } catch {
    return getDemoTeacherDetails(userId)
  }
}

export async function loadAdminRecentActivity(demo: boolean): Promise<AdminActivityEvent[]> {
  if (demo || !supabase) {
    return DEMO_ADMIN_ACTIVITY_EVENTS
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_recent_activity')
    if (error) {
      return DEMO_ADMIN_ACTIVITY_EVENTS
    }
    return (data as AdminActivityEvent[]) ?? DEMO_ADMIN_ACTIVITY_EVENTS
  } catch {
    return DEMO_ADMIN_ACTIVITY_EVENTS
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
