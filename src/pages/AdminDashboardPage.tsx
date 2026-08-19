import {
  BarChart3,
  Compass,
  Download,
  Flame,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab'
import { AdminRegistrationsTab } from '../components/admin/AdminRegistrationsTab'
import { AdminTeacherDetailModal } from '../components/admin/AdminTeacherDetailModal'
import { AdminTeacherDirectoryTab } from '../components/admin/AdminTeacherDirectoryTab'
import { AdminUserFlowTab } from '../components/admin/AdminUserFlowTab'
import { useApp } from '../contexts/AppContext'
import {
  loadAdminOverviewMetrics,
  loadAdminRecentActivity,
  loadAdminRegionStats,
  loadAdminRegistrationTrends,
  loadAdminTeacherDetails,
  loadAdminTeacherDirectory,
  loadAdminUserFlow,
} from '../lib/adminRepository'
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
import '../admin.css'

type AdminTab = 'overview' | 'registrations' | 'flow' | 'directory'

export function AdminDashboardPage() {
  const { isDemo, user } = useApp()
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data states
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null)
  const [trends, setTrends] = useState<AdminRegistrationTrendPoint[]>([])
  const [regionStats, setRegionStats] = useState<AdminRegionStat[]>([])
  const [flowData, setFlowData] = useState<AdminUserFlowData | null>(null)
  const [teachers, setTeachers] = useState<AdminTeacherRecord[]>([])
  const [totalTeacherCount, setTotalTeacherCount] = useState(0)
  const [activity, setActivity] = useState<AdminActivityEvent[]>([])

  // Directory filter state
  const [directoryFilters, setDirectoryFilters] = useState<AdminDirectoryFilter>({
    searchQuery: '',
    region: 'all',
    division: 'all',
    onboardingStatus: 'all',
    sortBy: 'createdAt',
    sortDirection: 'desc',
    page: 1,
    pageSize: 20,
  })

  // Selected teacher for inspector modal
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [teacherDetails, setTeacherDetails] = useState<AdminTeacherDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const [
        metricsRes,
        trendsRes,
        regionRes,
        flowRes,
        directoryRes,
        activityRes,
      ] = await Promise.all([
        loadAdminOverviewMetrics(isDemo),
        loadAdminRegistrationTrends(isDemo),
        loadAdminRegionStats(isDemo),
        loadAdminUserFlow(isDemo),
        loadAdminTeacherDirectory(directoryFilters, isDemo),
        loadAdminRecentActivity(isDemo),
      ])

      setMetrics(metricsRes)
      setTrends(trendsRes)
      setRegionStats(regionRes)
      setFlowData(flowRes)
      setTeachers(directoryRes.teachers)
      setTotalTeacherCount(directoryRes.totalCount)
      setActivity(activityRes)
    } catch (err) {
      console.warn('Failed to load admin dashboard data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [directoryFilters, isDemo])

  useEffect(() => {
    void loadAllData()
  }, [loadAllData])

  async function inspectTeacher(userId: string) {
    setSelectedTeacherId(userId)
    setDetailsLoading(true)
    try {
      const details = await loadAdminTeacherDetails(userId, isDemo)
      setTeacherDetails(details)
    } finally {
      setDetailsLoading(false)
    }
  }

  function closeInspector() {
    setSelectedTeacherId(null)
    setTeacherDetails(null)
  }

  return (
    <div className="admin-page-container">
      <PageHeader
        eyebrow="System Administration"
        title="Admin Dashboard"
        description="Monitor teacher registrations, onboarding health, feature adoption funnels, and geographic reach across Philippine DepEd schools."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="admin-header-badge">
              <ShieldCheck size={14} /> Admin: {user?.email || 'al.matubis17@gmail.com'}
            </span>
            <button
              className="button secondary"
              type="button"
              onClick={() => void loadAllData(true)}
              disabled={refreshing}
              title="Refresh administrative metrics"
            >
              <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />
              <span>{refreshing ? 'Updating…' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <nav className="admin-nav-tabs" aria-label="Admin dashboard sections">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={16} /> Overview & Pulse
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'registrations' ? 'active' : ''}`}
          onClick={() => setActiveTab('registrations')}
        >
          <TrendingUp size={16} /> Registrations & Regions
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'flow' ? 'active' : ''}`}
          onClick={() => setActiveTab('flow')}
        >
          <Compass size={16} /> User Flow & Funnel
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          <Users size={16} /> Teacher Directory ({totalTeacherCount})
        </button>
      </nav>

      {/* Active Tab Surface */}
      <main style={{ minHeight: '400px' }}>
        {activeTab === 'overview' && (
          <AdminOverviewTab metrics={metrics} activity={activity} loading={loading} />
        )}

        {activeTab === 'registrations' && (
          <AdminRegistrationsTab
            trends={trends}
            regionStats={regionStats}
            totalTeachers={metrics?.totalUsers ?? teachers.length}
            loading={loading}
          />
        )}

        {activeTab === 'flow' && (
          <AdminUserFlowTab flowData={flowData} loading={loading} />
        )}

        {activeTab === 'directory' && (
          <AdminTeacherDirectoryTab
            teachers={teachers}
            totalCount={totalTeacherCount}
            regionStats={regionStats}
            loading={loading}
            filters={directoryFilters}
            onFilterChange={setDirectoryFilters}
            onInspectTeacher={(userId) => void inspectTeacher(userId)}
          />
        )}
      </main>

      {/* Teacher Detail Inspector Modal */}
      {selectedTeacherId && (
        <AdminTeacherDetailModal
          details={teacherDetails}
          loading={detailsLoading}
          onClose={closeInspector}
        />
      )}
    </div>
  )
}
