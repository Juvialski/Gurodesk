import {
  ArrowDown,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Compass,
  FileCheck2,
  Flame,
  Layers,
  Sparkles,
  Users,
} from 'lucide-react'
import type { AdminUserFlowData } from '../../types/admin'

export type AdminUserFlowTabProps = {
  flowData: AdminUserFlowData | null
  loading: boolean
}

export function AdminUserFlowTab({ flowData, loading }: AdminUserFlowTabProps) {
  if (loading && !flowData) {
    return (
      <div className="home-empty-state" style={{ padding: '60px 20px' }}>
        <span className="loader" />
        <strong>Analyzing user journeys and funnel metrics…</strong>
      </div>
    )
  }

  if (!flowData) {
    return (
      <div className="home-empty-state">
        <Compass size={32} />
        <strong>User flow data unavailable</strong>
        <p>Could not load funnel stages.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Visual Conversion Funnel */}
      <section className="panel" style={{ padding: '24px' }}>
        <div className="panel-heading" style={{ marginBottom: '20px' }}>
          <div>
            <span className="eyebrow">Journey Conversion</span>
            <h2 style={{ fontSize: '18px', margin: '4px 0', color: 'var(--navy)' }}>Teacher Lifecycle & Funnel Progression</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Step-by-step progression from initial registration to regular classroom instruction and remediation.
            </p>
          </div>
        </div>

        <div className="admin-funnel-stack">
          {flowData.funnelStages.map((stage, index) => {
            const isFirst = index === 0
            const prevStage = !isFirst ? flowData.funnelStages[index - 1] : null
            const stepConversion = prevStage && prevStage.count > 0
              ? Math.round((stage.count / prevStage.count) * 100)
              : stage.percentageOfTotal

            return (
              <div key={stage.id} className="admin-funnel-step">
                <div className="admin-funnel-step-header">
                  <div className="admin-funnel-step-title">
                    <div className="admin-funnel-step-num">{stage.stepNumber}</div>
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--navy)' }}>{stage.label}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>— {stage.description}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--navy)' }}>{stage.count}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '4px' }}>
                        ({stage.percentageOfTotal}% of total)
                      </span>
                    </div>

                    {!isFirst && (
                      <span
                        className="admin-badge-pill"
                        title={`${stepConversion}% retained from previous step (${stage.dropoffPercentage}% overall drop-off)`}
                        style={{
                          background: stepConversion >= 70 ? '#dcfce7' : stepConversion >= 40 ? '#fef3c7' : '#fee2e2',
                          color: stepConversion >= 70 ? '#15803d' : stepConversion >= 40 ? '#b45309' : '#b91c1c',
                        }}
                      >
                        {stepConversion}% from step {stage.stepNumber - 1}
                      </span>
                    )}
                  </div>
                </div>

                <div className="admin-funnel-track">
                  <div
                    className="admin-funnel-bar"
                    style={{
                      width: `${stage.percentageOfTotal}%`,
                      background:
                        stage.percentageOfTotal >= 80
                          ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                          : stage.percentageOfTotal >= 50
                            ? 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)'
                            : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Feature Adoption Matrix */}
      <section className="panel" style={{ padding: '24px' }}>
        <div className="panel-heading" style={{ marginBottom: '16px' }}>
          <div>
            <span className="eyebrow">Feature Utilization</span>
            <h2 style={{ fontSize: '18px', margin: '4px 0', color: 'var(--navy)' }}>Workflow & Tool Adoption Breakdown</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Proportion of active teachers authoring content in each specialized subsystem.
            </p>
          </div>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Feature / Subsystem</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Active Teachers</th>
                <th style={{ textAlign: 'right' }}>% of Onboarded</th>
                <th style={{ textAlign: 'right' }}>Total Records Created</th>
              </tr>
            </thead>
            <tbody>
              {flowData.featureAdoptions.map((item) => (
                <tr key={item.featureName}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={16} color="#2563eb" />
                      <strong>{item.featureName}</strong>
                    </div>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '12.5px' }}>
                    {item.description}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>
                    {item.activeTeachers}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span className="admin-badge-pill" style={{ fontWeight: 700 }}>
                        {item.percentageOfOnboarded}%
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#1d4ed8' }}>
                    {item.totalEntitiesCreated > 0 ? item.totalEntitiesCreated : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
