import {
  BookOpenCheck,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Mail,
  MapPin,
  School,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import type { AdminTeacherDetails } from '../../types/admin'

export type AdminTeacherDetailModalProps = {
  details: AdminTeacherDetails | null
  loading: boolean
  onClose: () => void
}

export function AdminTeacherDetailModal({ details, loading, onClose }: AdminTeacherDetailModalProps) {
  if (!details && !loading) return null

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div>
            <span className="eyebrow" style={{ color: '#2563eb' }}>Teacher Profile Inspector</span>
            <h2 style={{ fontSize: '18px', margin: '2px 0 0', color: 'var(--navy)' }}>
              {details?.fullName || 'Teacher Details'}
            </h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="admin-modal-body">
          {loading ? (
            <div className="home-empty-state" style={{ padding: '40px 0' }}>
              <span className="loader" />
              <strong>Loading teacher data…</strong>
            </div>
          ) : details ? (
            <>
              {/* Profile Card Summary */}
              <div style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '20px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {details.fullName.slice(0, 1).toUpperCase()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <strong style={{ fontSize: '16px', color: 'var(--navy)' }}>{details.fullName}</strong>
                    <span className={`admin-badge-status ${details.onboardingCompleted ? 'completed' : 'pending'}`}>
                      {details.onboardingCompleted ? 'Onboarding Complete' : 'Onboarding Pending'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px' }}>
                    <Mail size={14} />
                    <span>{details.email || 'No email provided'}</span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span className="admin-badge-pill">{details.positionTitle}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12.5px', marginTop: '4px' }}>
                    <School size={14} />
                    <span>{details.schoolName} {details.schoolId ? `(ID: ${details.schoolId})` : ''}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12.5px' }}>
                    <MapPin size={14} />
                    <span>{details.division}, {details.region} {details.district ? `· District: ${details.district}` : ''}</span>
                  </div>
                </div>
              </div>

              {/* Document Statistics Breakdown */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)', marginBottom: '10px' }}>
                  Authoring & Activity Totals
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Lesson Plans</small>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>{details.lessonPlansCount}</div>
                  </div>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Assessments</small>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>{details.assessmentsCount}</div>
                  </div>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>TOS Documents</small>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>{details.tosCount}</div>
                  </div>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Result Sessions</small>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>{details.resultSessionsCount}</div>
                  </div>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>AI Setup</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: details.hasAiConfigured ? '#16a34a' : '#64748b' }}>
                      {details.hasAiConfigured ? 'Active (BYOK)' : 'Standard'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Teaching Classes */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)', marginBottom: '10px' }}>
                  Teaching Assignments ({details.assignments.length})
                </h3>
                {details.assignments.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No active teaching assignments added yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {details.assignments.map((asg) => (
                      <div key={asg.id} style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{asg.gradeLevel} — {asg.learningArea}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Sections: {asg.sections.length > 0 ? asg.sections.join(', ') : 'None listed'}
                          </div>
                        </div>
                        <span className="admin-badge-pill">SY {asg.schoolYear}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Documents */}
              {details.recentDocuments.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)', marginBottom: '10px' }}>
                    Recent Authored Documents
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {details.recentDocuments.map((doc) => (
                      <div key={doc.id} style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{doc.title}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {doc.documentType.replace('_', ' ')} · {doc.academicPeriodLabel || 'Current period'}
                          </div>
                        </div>
                        <span className={`admin-badge-status ${doc.status === 'final' ? 'completed' : 'pending'}`}>
                          {doc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
