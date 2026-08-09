import { Archive, ArrowRight, ClipboardCheck, Copy, Download, FileCheck2, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { archiveAssessmentDocument, duplicateAssessmentDocument, loadAssessmentDocuments } from '../lib/assessmentRepository'
import { loadTosDocuments } from '../lib/tosRepository'
import type { AssessmentRecord } from '../types/assessment'
import type { TosRecord } from '../types/tos'
import { assessmentCompletion, extractErrorMessage, normalizeAssessment } from './assessmentUi'

function displayDate(value: string) {
  if (!value) return 'Not yet saved'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not yet saved' : date.toLocaleDateString()
}

export function AssessmentsPage() {
  const { user, isDemo } = useApp()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<AssessmentRecord[]>([])
  const [finalTos, setFinalTos] = useState<TosRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')

  async function refresh() {
    if (!user) return
    setLoading(true)
    try {
      const [nextDocuments, tosDocuments] = await Promise.all([
        loadAssessmentDocuments(user.id, isDemo),
        loadTosDocuments(user.id, isDemo),
      ])
      setDocuments(nextDocuments)
      setFinalTos(tosDocuments.filter((document) => document.status === 'final'))
      setError('')
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to load assessments.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [user?.id, isDemo])

  async function duplicate(document: AssessmentRecord) {
    setWorkingId(document.id)
    try {
      const created = await duplicateAssessmentDocument(document, isDemo)
      navigate(`/assessments/${created.id}`)
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to duplicate this assessment.'))
    } finally {
      setWorkingId('')
    }
  }

  async function archive(document: AssessmentRecord) {
    if (!user) return
    const view = normalizeAssessment(document)
    if (!window.confirm(`Archive “${view.title}”? It will leave the active assessment list.`)) return
    setWorkingId(document.id)
    try {
      await archiveAssessmentDocument(document.id, user.id, isDemo)
      await refresh()
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to archive this assessment.'))
    } finally {
      setWorkingId('')
    }
  }

  return <>
    <PageHeader
      eyebrow="Assessment studio · Phase 4"
      title="Assessments"
      description="Build teacher-reviewed assessment items from finalized Tables of Specifications. Results, item analysis, and remediation remain future work."
      actions={<Link className="button primary" to="/assessments/new"><Plus size={16} /> New assessment</Link>}
    />

    <section className="assessment-boundary panel">
      <span className="assessment-boundary-icon"><ShieldCheck size={20} /></span>
      <div>
        <strong>Finalized TOS → teacher-reviewed items</strong>
        <p>GuroDesk preserves each item’s competency and cognitive mapping. AI may suggest wording, but you decide what is accepted and exported.</p>
      </div>
      <span className="assessment-future-note">Results / item analysis / remediation: future</span>
    </section>

    {loading && <div className="panel lesson-loading"><span className="loader" /><strong>Loading assessments…</strong></div>}
    {!loading && error && <EmptyState icon={ClipboardCheck} title="Assessments could not be loaded" description={error} />}
    {!loading && !error && !documents.length && <EmptyState icon={ClipboardCheck} title="No assessments yet" description={finalTos.length ? 'Start from a finalized TOS. Draft TOS documents cannot be used as assessment sources.' : 'Finalize a TOS first. Assessment creation is intentionally limited to finalized TOS documents so every item has verified coverage.'}>
      {finalTos.length
        ? <Link className="button primary" to="/assessments/new"><Plus size={16} /> Create from finalized TOS</Link>
        : <Link className="button secondary" to="/tos"><ShieldCheck size={16} /> Open TOS Builder</Link>}
    </EmptyState>}

    {!loading && !error && documents.length > 0 && <section className="assessment-card-grid">
      {documents.map((document) => {
        const view = normalizeAssessment(document)
        const completion = assessmentCompletion(document)
        const canEdit = view.status === 'draft'
        return <article className="panel assessment-card" key={document.id}>
          <div className="assessment-card-top">
            <span className={`assessment-status ${view.status}`}><FileCheck2 size={13} /> {view.status}</span>
            {isDemo && <span className="assessment-demo-chip"><Sparkles size={12} /> Local demo</span>}
          </div>
          <h2>{view.title}</h2>
          <p className="assessment-card-context">{[view.gradeLevel, view.learningArea, view.schoolYear].filter(Boolean).join(' · ') || 'Assignment context not set'}</p>
          <div className="assessment-source-card"><small>Source TOS</small><strong>{view.sourceTosTitle}</strong><span>{view.sourceTos?.id ? 'Finalized coverage preserved' : 'Finalized source'}</span></div>
          <div className="assessment-card-metrics">
            <span><strong>{view.items.length || view.totalItems}</strong><small>items</small></span>
            <span><strong>{completion.filled}/{completion.total}</strong><small>complete</small></span>
            <span><strong>{completion.percent}%</strong><small>complete</small></span>
          </div>
          <div className="assessment-progress" aria-label={`${completion.percent}% of assessment items have question text`}><span style={{ width: `${completion.percent}%` }} /></div>
          <div className="assessment-card-meta"><span>Updated {displayDate(view.updatedAt)}</span><span>{view.items.filter((item) => item.authorshipState === 'teacher_accepted').length} accepted</span></div>
          <div className="assessment-card-actions">
            <button aria-label={`Archive ${view.title}`} className="icon-button danger" disabled={workingId === document.id} type="button" onClick={() => void archive(document)} title="Archive"><Archive size={16} /></button>
            <button className="button ghost" disabled={workingId === document.id} type="button" onClick={() => void duplicate(document)}><Copy size={14} /> Duplicate</button>
            <Link className="button ghost" to={`/assessments/${document.id}/print`}><Download size={14} /> Export</Link>
            <Link className="button secondary" to={`/assessments/${document.id}`}>{canEdit ? 'Open editor' : 'Review'} <ArrowRight size={14} /></Link>
          </div>
        </article>
      })}
    </section>}
  </>
}
