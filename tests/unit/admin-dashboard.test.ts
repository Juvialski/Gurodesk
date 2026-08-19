import { describe, expect, it } from 'vitest'
import { getAdminEmails, isAdminEmail, isAdminUser } from '../../src/lib/adminAuth'
import {
  DEMO_ADMIN_TEACHERS,
  getDemoOverviewMetrics,
  getDemoRegionStats,
  getDemoRegistrationTrends,
  getDemoTeacherDetails,
  getDemoUserFlow,
} from '../../src/lib/adminDemo'
import {
  loadAdminOverviewMetrics,
  loadAdminRegionStats,
  loadAdminRegistrationTrends,
  loadAdminTeacherDetails,
  loadAdminTeacherDirectory,
  loadAdminUserFlow,
} from '../../src/lib/adminRepository'

describe('Admin Authentication & Authorization', () => {
  it('recognizes al.matubis17@gmail.com as authorized admin', () => {
    expect(isAdminEmail('al.matubis17@gmail.com')).toBe(true)
    expect(isAdminEmail('AL.MATUBIS17@GMAIL.COM')).toBe(true)
    expect(isAdminEmail('  al.matubis17@gmail.com  ')).toBe(true)
  })

  it('rejects unauthorized emails', () => {
    expect(isAdminEmail('random.teacher@deped.gov.ph')).toBe(false)
    expect(isAdminEmail('someone.else@gmail.com')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('checks admin user accurately', () => {
    expect(isAdminUser({ id: 'u1', email: 'al.matubis17@gmail.com' }, null, false)).toBe(true)
    expect(isAdminUser(null, { id: 'u1', email: 'al.matubis17@gmail.com' } as any, false)).toBe(true)
    expect(isAdminUser({ id: 'u2', email: 'teacher@deped.gov.ph' }, null, false)).toBe(false)
    expect(isAdminUser(null, null, false)).toBe(false)
  })

  it('provides demo mode admin preview capability', () => {
    expect(isAdminUser(null, null, true)).toBe(true)
  })
})

describe('Admin Metrics & Funnel Computation', () => {
  it('computes realistic overview metrics from teacher dataset', () => {
    const metrics = getDemoOverviewMetrics()
    expect(metrics.totalUsers).toBeGreaterThan(0)
    expect(metrics.onboardingRatePercentage).toBeGreaterThanOrEqual(0)
    expect(metrics.onboardingRatePercentage).toBeLessThanOrEqual(100)
    expect(metrics.totalLessonPlans).toBeGreaterThan(0)
    expect(metrics.totalAssessments).toBeGreaterThan(0)
    expect(metrics.totalTosDocuments).toBeGreaterThan(0)
    expect(metrics.totalResultSessions).toBeGreaterThan(0)
    expect(metrics.totalRemediationPlans).toBeGreaterThanOrEqual(0)
  })

  it('structures multi-step conversion funnel without broken links', () => {
    const flow = getDemoUserFlow()
    expect(flow.funnelStages.length).toBe(7)

    const [signup, onboarding, classes, lp, assessments, results, remediation] = flow.funnelStages
    expect(signup.id).toBe('stage-signup')
    expect(signup.percentageOfTotal).toBe(100)

    expect(onboarding.id).toBe('stage-onboarding')
    expect(onboarding.count).toBeLessThanOrEqual(signup.count)

    expect(classes.id).toBe('stage-assignments')
    expect(classes.count).toBeLessThanOrEqual(onboarding.count)

    expect(lp.id).toBe('stage-lesson-plans')
    expect(assessments.id).toBe('stage-assessments')
    expect(results.id).toBe('stage-results')
    expect(remediation.id).toBe('stage-remediation')

    expect(flow.featureAdoptions.length).toBeGreaterThanOrEqual(5)
  })

  it('aggregates geographic distribution across DepEd regions', () => {
    const regions = getDemoRegionStats()
    expect(regions.length).toBeGreaterThan(0)
    const totalTeachers = regions.reduce((sum, r) => sum + r.teacherCount, 0)
    expect(totalTeachers).toBe(DEMO_ADMIN_TEACHERS.length)
  })

  it('generates chronological registration trends', () => {
    const trends = getDemoRegistrationTrends()
    expect(trends.length).toBeGreaterThan(0)
    for (let i = 1; i < trends.length; i++) {
      expect(trends[i].cumulative).toBeGreaterThanOrEqual(trends[i - 1].cumulative)
    }
  })
})

describe('Admin Repository & Directory Search', () => {
  it('loads overview metrics in demo mode', async () => {
    const metrics = await loadAdminOverviewMetrics(true)
    expect(metrics.totalUsers).toBe(DEMO_ADMIN_TEACHERS.length)
  })

  it('loads user flow and funnel in demo mode', async () => {
    const flow = await loadAdminUserFlow(true)
    expect(flow.funnelStages.length).toBe(7)
  })

  it('filters teacher directory by search query', async () => {
    const result = await loadAdminTeacherDirectory({ searchQuery: 'Batangas' }, true)
    expect(result.teachers.length).toBeGreaterThan(0)
    expect(result.teachers[0].schoolName).toContain('Batangas')
  })

  it('filters teacher directory by region', async () => {
    const result = await loadAdminTeacherDirectory({ region: 'National Capital Region (NCR)' }, true)
    expect(result.teachers.length).toBeGreaterThan(0)
    expect(result.teachers.every((t) => t.region === 'National Capital Region (NCR)')).toBe(true)
  })

  it('filters teacher directory by onboarding status', async () => {
    const result = await loadAdminTeacherDirectory({ onboardingStatus: 'pending' }, true)
    expect(result.teachers.length).toBeGreaterThan(0)
    expect(result.teachers.every((t) => t.onboardingCompleted === false)).toBe(true)
  })

  it('loads full teacher details including assignments and documents', async () => {
    const details = await loadAdminTeacherDetails('usr-deped-001', true)
    expect(details).not.toBeNull()
    expect(details?.fullName).toBe('Maria Santos')
    expect(details?.assignments.length).toBeGreaterThan(0)
    expect(details?.recentDocuments.length).toBeGreaterThan(0)
  })
})
