import {
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
  FileText,
  ChartNoAxesColumnIncreasing,
  Flame,
} from 'lucide-react'
import type { AdminActivityEvent, AdminOverviewMetrics } from '../../types/admin'

export type AdminOverviewTabProps = {
  metrics: AdminOverviewMetrics | null
  activity: AdminActivityEvent[]
  loading: boolean
}

export function AdminOverviewTab({ metrics, activity, loading }: AdminOverviewTabProps) {
  if (loading && !metrics) {
    return (
      <div className="home-empty-state" style={{ padding: '60px 20px' }}>
        <span className="loader" />
        <strong>Loading administrative metrics…</strong>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="home-empty-state">
        <Users size={32} />
        <strong>Metrics unavailable</strong>
        <p>Could not fetch administrative overview data.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top 6 KPI Metric Cards */}
      <div className="admin-metrics-grid">
        <article className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-label">Total Teachers</span>
            <div className="admin-metric-icon blue"><Users size={20} /></div>
          </div>
          <div className="admin-metric-value">{metrics.totalUsers}</div>
          <div className="admin-metric-hint positive">
            <TrendingUp size={14} /> +{metrics.newUsersLast7Days} in last 7 days
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-label">Onboarding Rate</span>
            <div className="admin-metric-icon green"><CheckCircle2 size={20} /></div>
          </div>
          <div className="admin-metric-value">{metrics.onboardingRatePercentage}%</div>
          <div className="admin-metric-hint neutral">
            {metrics.onboardingCompletedCount} of {metrics.totalUsers} completed
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-label">Active Classes</span>
            <div className="admin-metric-icon purple"><GraduationCap size={20} /></div>
          </div>
          <div className="admin-metric-value">{metrics.totalTeachingAssignments}</div>
          <div className="admin-metric-hint neutral">
            Teaching assignments set up
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-label">Lesson Plans</span>
            <div className="admin-metric-icon amber"><BookOpenCheck size={20} /></div>
          </div>
          <div className="admin-metric-value">{metrics.totalLessonPlans}</div>
          <div className="admin-metric-hint neutral">
            DepEd DLL / DLP documents
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-label">Assessments & TOS</span>
            <div className="admin-metric-icon rose"><ClipboardCheck size={20} /></div>
          </div>
          <div className="admin-metric-value">{metrics.totalAssessments + metrics.totalTosDocuments}</div>
          <div className="admin-metric-hint neutral">
            {metrics.totalAssessments} tests · {metrics.totalTosDocuments} TOS
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-label">Evaluations & Results</span>
            <div className="admin-metric-icon slate"><ChartNoAxesColumnIncreasing size={20} /></div>
          </div>
          <div className="admin-metric-value">{metrics.totalResultSessions}</div>
          <div className="admin-metric-hint neutral">
            {metrics.totalLearnersEvaluated} learner outcomes recorded
          </div>
        </article>
      </div>

      {/* Secondary Pulse Layout: Summary Card + Recent Activity Feed */}
      <div className="admin-pulse-layout">
        {/* Workspace Health & Velocity Highlights */}
        <section className="panel" style={{ padding: '24px' }}>
          <div className="panel-heading" style={{ marginBottom: '18px' }}>
            <div>
              <span className="eyebrow">Adoption Pulse</span>
              <h2 style={{ fontSize: '18px', margin: '4px 0', color: 'var(--navy)' }}>System Activity & Engagement</h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                Overview of registration velocity and teacher workspace utilization.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Last 24 Hours</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--navy)', marginTop: '4px' }}>+{metrics.newUsersLast24Hours}</div>
              <small style={{ color: '#64748b' }}>new registrations</small>
            </div>

            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Last 30 Days</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--navy)', marginTop: '4px' }}>+{metrics.newUsersLast30Days}</div>
              <small style={{ color: '#64748b' }}>new teachers</small>
            </div>

            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active (7 Days)</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{metrics.activeUsersLast7Days}</div>
              <small style={{ color: '#64748b' }}>teachers active</small>
            </div>

            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>AI BYOK Connected</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>{metrics.aiConfiguredCount}</div>
              <small style={{ color: '#64748b' }}>Gemini key users</small>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)', marginBottom: '10px' }}>Key Adoption Indicators</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <strong>{metrics.onboardingCompletedCount}</strong> teachers completed school identification and profile setup.
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                <FileText size={16} color="#2563eb" />
                <strong>{metrics.totalLessonPlans + metrics.totalAssessments + metrics.totalTosDocuments}</strong> total instructional documents authored across the system.
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                <Flame size={16} color="#ea580c" />
                <strong>{metrics.totalRemediationPlans}</strong> remedial intervention plans prepared for struggling students.
              </li>
            </ul>
          </div>
        </section>

        {/* Live Activity Stream */}
        <section className="panel" style={{ padding: '24px' }}>
          <div className="panel-heading" style={{ marginBottom: '16px' }}>
            <div>
              <span className="eyebrow">Recent Feed</span>
              <h2 style={{ fontSize: '18px', margin: '4px 0', color: 'var(--navy)' }}>System Events</h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Latest registrations and document actions</p>
            </div>
          </div>

          <div className="admin-activity-list">
            {activity.slice(0, 6).map((item) => (
              <div className="admin-activity-item" key={item.id}>
                <div className="admin-activity-icon">
                  {item.type === 'user_registered' && <Users size={14} />}
                  {item.type === 'onboarding_completed' && <CheckCircle2 size={14} />}
                  {item.type === 'lesson_plan_created' && <BookOpenCheck size={14} />}
                  {item.type === 'assessment_created' && <ClipboardCheck size={14} />}
                  {item.type === 'results_encoded' && <ChartNoAxesColumnIncreasing size={14} />}
                  {item.type === 'remediation_created' && <Sparkles size={14} />}
                  {!['user_registered', 'onboarding_completed', 'lesson_plan_created', 'assessment_created', 'results_encoded', 'remediation_created'].includes(item.type) && <Clock size={14} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <strong style={{ color: 'var(--navy)', fontSize: '13px' }}>{item.userName}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span style={{ color: '#475569', fontSize: '12px' }}>{item.title}</span>
                  <small style={{ color: '#94a3b8', fontSize: '11px' }}>{item.schoolName} · {item.region.split('(')[0]}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
