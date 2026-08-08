import { Archive, ArrowRight, BookOpenCheck, CalendarDays, FileCheck2, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { LESSON_PLANNING_POLICY } from '../data/lessonPlanningPolicy'
import { archiveLessonPlan, loadLessonPlans } from '../lib/repository'
import type { LessonPlanRecord } from '../types/lessonPlan'

export function LessonPlansPage() {
  const { user, isDemo } = useApp()
  const [plans, setPlans] = useState<LessonPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <>
      <PageHeader
        eyebrow="Planning · Phase 3"
        title="Lesson Plans"
        description="Teacher-led ILAW planning grounded in verified curriculum records, with policy-safe AI support for refinement and routine technical tasks."
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
        <EmptyState icon={BookOpenCheck} title="No lesson plans yet" description="Start from a verified curriculum competency. GuroDesk will provide the ILAW structure and keep the teacher in control of the instructional decisions.">
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
              <div className="lesson-card-competency"><small>Competency</small><span>{plan.content.competency.text || 'Not attached'}</span></div>
              <div className="lesson-card-meta"><span>{plan.content.numberOfSessions} session{plan.content.numberOfSessions === 1 ? '' : 's'}</span><span>Updated {new Date(plan.updatedAt).toLocaleDateString()}</span></div>
              <div className="lesson-card-actions">
                <button className="icon-button danger" type="button" onClick={() => void archive(plan.id)} title="Archive"><Archive size={16} /></button>
                <Link className="button secondary" to={`/lesson-plans/${plan.id}`}>Open plan <ArrowRight size={14} /></Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  )
}
