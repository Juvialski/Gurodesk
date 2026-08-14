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
      eyebrow="Assessment studio"
      title="Assessments"
      description="Create teacher-reviewed assessments from Tables of Specifications, lesson plans, unit modules, or authentic performance tasks with 4-level rubrics."
      actions={<Link className="button primary" to="/assessments/new"><Plus size={16} /> New assessment</Link>}
    />

    <section className="assessment-boundary panel">
      <span className="assessment-boundary-icon"><ShieldCheck size={20} /></span>
      <div>
        <strong>Verified Curriculum & Lesson Plans → Balanced Coverage → Teacher Review</strong>
        <p>GuroDesk preserves curriculum competencies and cognitive mappings across TOS exams, lesson quizzes, unit quizzes, and authentic performance tasks with analytic rubrics. You review and finalize every assessment before encoding results.</p>
      </div>
      <span className="assessment-future-note">Results and item analysis stay linked to the finalized assessment snapshot.</span>
    </section>

    {loading && <div className="panel lesson-loading"><span className="loader" /><strong>Loading assessments…</strong></div>}
    {!loading && error && <EmptyState icon={ClipboardCheck} title="Assessments could not be loaded" description={error} />}
    {!loading && !error && !documents.length && <EmptyState icon={ClipboardCheck} title="No assessments yet" description="Create an assessment from a finalized TOS, a single lesson plan, a multi-lesson unit, or an authentic performance task with rubrics.">
      <Link className="button primary" to="/assessments/new"><Plus size={16} /> Create new assessment</Link>
    </EmptyState>}

    {!loading && !error && documents.length > 0 && <section className="assessment-card-grid">
      {documents.map((document) => {
        const view = normalizeAssessment(document)
        const completion = assessmentCompletion(document)
        const canEdit = view.status === 'draft'
        const isV2 = Number(view.settings?.schemaVersion ?? 1) >= 2 && view.settings?.generationVersion === 'v2' && view.settings?.numberingMode === 'point_ranges'
        return <article className="panel assessment-card" key={document.id}>
          <div className="assessment-card-top">
            <span className={`assessment-status ${view.status}`}><FileCheck2 size={13} /> {view.status}</span>
            {view.mode === 'performance_task' && <span className="badge primary">Performance Task</span>}
            {view.mode === 'lesson_quiz' && <span className="badge">Lesson Quiz</span>}
            {view.mode === 'unit_quiz' && <span className="badge">Unit Quiz</span>}
            {(view.mode === 'standard' || !view.mode) && <span className="badge">TOS Exam</span>}
            {isDemo && <span className="assessment-demo-chip"><Sparkles size={12} /> Local demo</span>}
          </div>
          <h2>{view.title}</h2>
          <p className="assessment-card-context">{[view.gradeLevel, view.learningArea, view.schoolYear].filter(Boolean).join(' · ') || 'Assignment context not set'}</p>
          <div className="assessment-source-card">
            {view.mode === 'performance_task' ? (
              <>
                <small>Authentic Task</small>
                <strong>{view.performanceTask?.expectedOutput || 'Product / Performance Output'}</strong>
                <span>{view.performanceTask?.rubric?.criteria?.length || 4} rubric criteria · {view.performanceTask?.grouping || 'Individual'}</span>
              </>
            ) : view.mode === 'lesson_quiz' ? (
              <>
                <small>Source Lesson Plan</small>
                <strong>{view.sourceLessonTitle || 'Daily Lesson Plan'}</strong>
                <span>Formative Quiz</span>
              </>
            ) : view.mode === 'unit_quiz' ? (
              <>
                <small>Source Unit</small>
                <strong>{view.sourceLessonTitles?.join(', ') || `${view.sourceLessons?.length || 0} Lessons`}</strong>
                <span>Multi-Lesson Unit</span>
              </>
            ) : (
              <>
                <small>Source TOS</small>
                <strong>{view.sourceTosTitle || 'Finalized TOS'}</strong>
                <span>{view.sourceTos?.id ? 'Finalized coverage preserved' : 'Finalized source'}</span>
              </>
            )}
          </div>
          <div className="assessment-card-metrics">
            {view.mode === 'performance_task' ? (
              <>
                <span><strong>{view.performanceTask?.rubric?.totalPoints || view.totalPoints || 0}</strong><small>rubric pts</small></span>
                <span><strong>{view.performanceTask?.milestones?.length || 0}</strong><small>milestones</small></span>
              </>
            ) : isV2 ? (
              <>
                <span><strong>{completion.totalPoints}</strong><small>points</small></span>
                <span><strong>{view.items.length}</strong><small>questions</small></span>
              </>
            ) : (
              <span><strong>{view.items.length || view.totalItems}</strong><small>items</small></span>
            )}
            <span><strong>{view.mode === 'performance_task' ? '100%' : `${completion.percent}%`}</strong><small>{view.mode === 'performance_task' ? 'configured' : 'generated'}</small></span>
          </div>
          <div className="assessment-progress" aria-label={`${completion.percent}% of assessment questions have content`}><span style={{ width: `${completion.percent}%` }} /></div>
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
