import { Archive, ArrowRight, BookOpenCheck, CalendarDays, Copy, Download, FileCheck2, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { LESSON_PLANNING_POLICY } from '../data/lessonPlanningPolicy'
import { archiveLessonPlan, duplicateLessonPlan, loadLessonPlans } from '../lib/repository'
import type { LessonPlanRecord } from '../types/lessonPlan'

export function LessonPlansPage() {
  const { user, isDemo } = useApp()
  const [plans, setPlans] = useState<LessonPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  async function refresh() {
    if (!user) return
    setLoading(true)
    try {
      setPlans(await loadLessonPlans(user.id, isDemo))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load lesson plans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [user?.id, isDemo])

  async function archive(id: string) {
    if (!user) return
    await archiveLessonPlan(id, user.id, isDemo)
    await refresh()
  }

  async function duplicate(plan: LessonPlanRecord) {
    setDuplicatingId(plan.id)
    setError(null)
    try {
      await duplicateLessonPlan(plan, isDemo)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to duplicate this lesson plan.')
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Planning · Phase 3.6"
        title="Lesson Plans"
        description="Topic-first, teacher-led ILAW planning with flexible verified curriculum alignment, guided AI suggestions, and printable Word/PDF exports."
        actions={<Link className="button primary" to="/lesson-plans/new"><Plus size={16} /> New lesson plan</Link>}
      />

      <section className="policy-banner panel">
        <span className="policy-banner-icon"><ShieldCheck size={20} /></span>
        <div><strong>{LESSON_PLANNING_POLICY.code} · ILAW</strong><p>{LESSON_PLANNING_POLICY.aiRule}</p></div>
        <a href={LESSON_PLANNING_POLICY.sourceUrl} target="_blank" rel="noreferrer" className="text-link">Official source <ArrowRight size={14} /></a>
      </section>

      {loading && <div className="panel lesson-loading"><span className="loader" /><strong>Loading lesson plans…</strong></div>}
      {!loading && error && <EmptyState icon={CalendarDays} title="Lesson plans could not be loaded" description={error} />}
      {!loading && !error && !plans.length && (
        <EmptyState icon={BookOpenCheck} title="No lesson plans yet" description="Start with what you are teaching, then add zero, one, or several verified competencies. GuroDesk provides the ILAW structure while you keep control of every instructional decision.">
          <Link className="button primary" to="/lesson-plans/new"><Plus size={16} /> Create first lesson plan</Link>
        </EmptyState>
      )}

      {!loading && !error && plans.length > 0 && (
        <section className="lesson-card-grid">
          {plans.map((plan) => (
            <article className="panel lesson-card" key={plan.id}>
              <div className="lesson-card-top">
                <span className={`plan-status ${plan.status}`}><FileCheck2 size={13} /> {plan.status}</span>
                {plan.content.aiDeclaration.used && <span className="ai-used-chip"><Sparkles size={12} /> AI declared</span>}
              </div>
              <h2>{plan.title || 'Untitled lesson'}</h2>
              <p>{plan.content.gradeLevel} · {plan.content.learningArea} · {plan.content.curriculumPeriodLabel || 'Curriculum period not set'}</p>
              <div className="lesson-card-competency"><small>Topic / lesson focus</small><span>{plan.content.lessonFocus || plan.content.lessonTitle || 'Topic not entered'}</span></div>
              <div className="lesson-card-competency"><small>{plan.content.curriculumAlignments.length ? `${plan.content.curriculumAlignments.length} verified curriculum alignment${plan.content.curriculumAlignments.length === 1 ? '' : 's'}` : 'Teacher-provided topic · no curriculum alignment'}</small><span>{plan.content.competency.text || plan.content.alignmentPurpose.replaceAll('_', ' ')}</span></div>
              <div className="lesson-card-meta"><span>{plan.content.numberOfSessions} session{plan.content.numberOfSessions === 1 ? '' : 's'}</span><span>Updated {new Date(plan.updatedAt).toLocaleDateString()}</span></div>
              <div className="lesson-card-actions">
                <button className="icon-button danger" type="button" onClick={() => void archive(plan.id)} title="Archive"><Archive size={16} /></button>
                <button className="icon-button" type="button" disabled={duplicatingId === plan.id} onClick={() => void duplicate(plan)} title="Duplicate lesson plan" aria-label="Duplicate lesson plan"><Copy size={16} /></button>
                <Link className="button ghost" to={`/lesson-plans/${plan.id}/print`}><Download size={14} /> Export</Link>
                <Link className="button secondary" to={`/lesson-plans/${plan.id}`}>Open plan <ArrowRight size={14} /></Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  )
}
