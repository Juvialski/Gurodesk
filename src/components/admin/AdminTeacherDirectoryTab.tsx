import {
  Download,
  Eye,
  Filter,
  MapPin,
  Search,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import type { AdminDirectoryFilter, AdminRegionStat, AdminTeacherRecord } from '../../types/admin'
import { exportTeachersToCsv } from '../../lib/adminRepository'

export type AdminTeacherDirectoryTabProps = {
  teachers: AdminTeacherRecord[]
  totalCount: number
  regionStats: AdminRegionStat[]
  loading: boolean
  filters: AdminDirectoryFilter
  onFilterChange: (filters: AdminDirectoryFilter) => void
  onInspectTeacher: (userId: string) => void
}

export function AdminTeacherDirectoryTab({
  teachers,
  totalCount,
  regionStats,
  loading,
  filters,
  onFilterChange,
  onInspectTeacher,
}: AdminTeacherDirectoryTabProps) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery ?? '')

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    onFilterChange({ ...filters, searchQuery: searchInput, page: 1 })
  }

  function handleRegionChange(region: string) {
    onFilterChange({ ...filters, region, page: 1 })
  }

  function handleStatusChange(onboardingStatus: 'all' | 'completed' | 'pending') {
    onFilterChange({ ...filters, onboardingStatus, page: 1 })
  }

  function handleExportCsv() {
    exportTeachersToCsv(teachers)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Filters Bar */}
      <section className="panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="search"
                placeholder="Search teachers by name, email, school, division…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>
            <button type="submit" className="button secondary">
              Search
            </button>
          </form>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filters.region ?? 'all'}
              onChange={(e) => handleRegionChange(e.target.value)}
              style={{ width: 'auto', minWidth: '160px' }}
              aria-label="Filter by region"
            >
              <option value="all">All Regions</option>
              {regionStats.map((r) => (
                <option key={r.region} value={r.region}>{r.region}</option>
              ))}
            </select>

            <select
              value={filters.onboardingStatus ?? 'all'}
              onChange={(e) => handleStatusChange(e.target.value as 'all' | 'completed' | 'pending')}
              style={{ width: 'auto' }}
              aria-label="Filter by onboarding status"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Onboarding Complete</option>
              <option value="pending">Onboarding Pending</option>
            </select>

            <button type="button" className="button secondary" onClick={handleExportCsv} title="Download CSV spreadsheet">
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>
      </section>

      {/* Teacher Directory Table */}
      <div className="admin-table-container">
        {loading && teachers.length === 0 ? (
          <div className="home-empty-state" style={{ padding: '60px 20px' }}>
            <span className="loader" />
            <strong>Loading teacher directory…</strong>
          </div>
        ) : teachers.length === 0 ? (
          <div className="home-empty-state" style={{ padding: '40px 20px' }}>
            <Users size={32} />
            <strong>No teachers match your search or filter</strong>
            <p>Try adjusting your query or resetting region filters.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Teacher Profile</th>
                <th>School & Division</th>
                <th>Position</th>
                <th>Onboarding</th>
                <th style={{ textAlign: 'center' }}>Documents</th>
                <th>Registered</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    <div className="admin-teacher-chip">
                      <div className="admin-teacher-avatar">
                        {teacher.fullName.slice(0, 1).toUpperCase() || 'T'}
                      </div>
                      <div>
                        <strong>{teacher.fullName || 'Unnamed Teacher'}</strong>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{teacher.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '12.5px', color: 'var(--navy)' }}>{teacher.schoolName || 'School not set'}</strong>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {teacher.division || 'Division not set'} · {teacher.region.split('(')[0]}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className="admin-badge-pill">{teacher.positionTitle}</span>
                  </td>

                  <td>
                    <span className={`admin-badge-status ${teacher.onboardingCompleted ? 'completed' : 'pending'}`}>
                      {teacher.onboardingCompleted ? 'Complete' : 'Pending'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span className="admin-badge-pill" title="Lesson Plans">{teacher.lessonPlansCount} LP</span>
                      <span className="admin-badge-pill" title="Assessments">{teacher.assessmentsCount} Tests</span>
                      <span className="admin-badge-pill" title="TOS">{teacher.tosCount} TOS</span>
                      <span className="admin-badge-pill" title="Results">{teacher.resultSessionsCount} Res</span>
                    </div>
                  </td>

                  <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#64748b' }}>
                    {new Date(teacher.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="button ghost compact"
                      onClick={() => onInspectTeacher(teacher.id)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      <Eye size={14} /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Total Results Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', color: '#64748b', padding: '0 4px' }}>
        <span>Showing {teachers.length} of {totalCount} registered teachers</span>
      </div>
    </div>
  )
}
