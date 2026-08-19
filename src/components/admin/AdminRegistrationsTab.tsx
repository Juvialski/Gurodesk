import { BarChart3, Globe, MapPin, TrendingUp, Users } from 'lucide-react'
import type { AdminRegionStat, AdminRegistrationTrendPoint } from '../../types/admin'

export type AdminRegistrationsTabProps = {
  trends: AdminRegistrationTrendPoint[]
  regionStats: AdminRegionStat[]
  totalTeachers: number
  loading: boolean
}

export function AdminRegistrationsTab({ trends, regionStats, totalTeachers, loading }: AdminRegistrationsTabProps) {
  if (loading && trends.length === 0) {
    return (
      <div className="home-empty-state" style={{ padding: '60px 20px' }}>
        <span className="loader" />
        <strong>Loading registration data…</strong>
      </div>
    )
  }

  const maxDaily = Math.max(...trends.map((t) => t.registrations), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Registration Timeline Chart */}
      <section className="panel" style={{ padding: '24px' }}>
        <div className="panel-heading" style={{ marginBottom: '20px' }}>
          <div>
            <span className="eyebrow">Growth Velocity</span>
            <h2 style={{ fontSize: '18px', margin: '4px 0', color: 'var(--navy)' }}>New Teacher Registrations Over Time</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Daily registration volume and cumulative account expansion.
            </p>
          </div>
        </div>

        {trends.length === 0 ? (
          <div className="home-empty-state compact">
            <TrendingUp size={24} />
            <p>No registration data recorded in this period.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Visual Bar Chart */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '10px',
              height: '180px',
              padding: '16px 8px 8px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              overflowX: 'auto',
            }}>
              {trends.map((point) => {
                const heightPercent = Math.max(Math.round((point.registrations / maxDaily) * 100), 12)
                return (
                  <div
                    key={point.date}
                    style={{
                      flex: 1,
                      minWidth: '38px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                    title={`${point.date}: ${point.registrations} registrations (${point.cumulative} total)`}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8' }}>
                      {point.registrations}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '28px',
                        height: `${heightPercent}%`,
                        background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {point.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Regional & Division Adoption Table */}
      <section className="panel" style={{ padding: '24px' }}>
        <div className="panel-heading" style={{ marginBottom: '16px' }}>
          <div>
            <span className="eyebrow">Geographic Reach</span>
            <h2 style={{ fontSize: '18px', margin: '4px 0', color: 'var(--navy)' }}>Regional DepEd Distribution</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Teacher registrations, onboarding completion, and document activity by DepEd Region.
            </p>
          </div>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Region</th>
                <th style={{ textAlign: 'right' }}>Teachers</th>
                <th style={{ textAlign: 'right' }}>% of Total</th>
                <th style={{ textAlign: 'right' }}>Onboarded</th>
                <th style={{ textAlign: 'right' }}>Divisions</th>
                <th style={{ textAlign: 'right' }}>Documents Created</th>
              </tr>
            </thead>
            <tbody>
              {regionStats.map((item, index) => {
                const percentage = totalTeachers > 0 ? Math.round((item.teacherCount / totalTeachers) * 100) : 0
                return (
                  <tr key={item.region}>
                    <td style={{ fontWeight: 700, color: '#94a3b8' }}>{index + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={15} color="#2563eb" />
                        <strong>{item.region}</strong>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>
                      {item.teacherCount}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="admin-badge-pill">{percentage}%</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`admin-badge-status ${item.onboardingCount === item.teacherCount ? 'completed' : 'pending'}`}>
                        {item.onboardingCount} / {item.teacherCount}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#475569' }}>
                      {item.divisionsCount}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#1d4ed8' }}>
                      {item.documentCount}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
