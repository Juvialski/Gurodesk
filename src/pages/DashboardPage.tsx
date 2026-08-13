import { ArrowRight, BookOpenCheck, CalendarDays, ChartNoAxesColumnIncreasing, ClipboardCheck, Plus, School, TableProperties, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { ActionCard } from '../components/ui/ActionCard'
import { StatusSummary } from '../components/ui/StatusSummary'
import { useApp } from '../contexts/AppContext'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { loadAssessmentDocuments } from '../lib/assessmentRepository'
import { loadLessonPlans } from '../lib/repository'
import { loadResultSessions, type ResultSessionListSummary } from '../lib/resultsRepository'
import { loadTosDocuments } from '../lib/tosRepository'

type RecentWorkItem = {
  id: string
  title: string
  kind: string
  status: string
  detail: string
  updatedAt: string
  to: string
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

export function DashboardPage() {
  const { profile, assignments, user, isDemo } = useApp()
  const { selection } = useWorkspaceSelection(user?.id)
  const teacherName = profile?.fullName?.split(' ')[0] || 'Teacher'
  const sectionCount = assignments.reduce((sum, assignment) => sum + assignment.sections.length, 0)
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const hasActiveAssignments = assignments.some((assignment) => assignment.isActive)
  const selectedAssignment = assignments.find((assignment) => assignment.id === selection.assignmentId && assignment.isActive) ?? null
  const assignmentQuery = selectedAssignment ? `?assignment=${encodeURIComponent(selectedAssignment.id)}` : ''
  const [recentWork, setRecentWork] = useState<RecentWorkItem[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setRecentWork([])
      return
    }
    let active = true
    setRecentLoading(true)
    void Promise.allSettled([
      loadLessonPlans(user.id, isDemo),
      loadTosDocuments(user.id, isDemo),
      loadAssessmentDocuments(user.id, isDemo),
      loadResultSessions(user.id, isDemo),
    ]).then(([lessonResult, tosResult, assessmentResult, resultResult]) => {
      if (!active) return
      const work: RecentWorkItem[] = []
      if (lessonResult.status === 'fulfilled') work.push(...lessonResult.value.map((plan) => ({
        id: plan.id,
        title: plan.title || 'Untitled lesson plan',
        kind: 'Lesson plan',
        status: plan.status,
        detail: [plan.content.gradeLevel, plan.content.learningArea].filter(Boolean).join(' · ') || 'Teacher document',
        updatedAt: plan.updatedAt,
        to: `/lesson-plans/${plan.id}`,
      })))
      if (tosResult.status === 'fulfilled') work.push(...tosResult.value.map((tos) => ({
        id: tos.id,
        title: tos.title || 'Untitled TOS',
        kind: 'Table of Specifications',
        status: tos.status,
        detail: `${tos.content.totalItems} items · ${tos.content.rows.length} competencies`,
        updatedAt: tos.updatedAt,
        to: `/tos/${tos.id}`,
      })))
      if (assessmentResult.status === 'fulfilled') work.push(...assessmentResult.value.map((assessment) => ({
        id: assessment.id,
        title: assessment.title || 'Untitled assessment',
        kind: 'Test / Quiz',
        status: assessment.status,
        detail: `${assessment.items.length} question${assessment.items.length === 1 ? '' : 's'}`,
        updatedAt: assessment.updatedAt,
        to: `/assessments/${assessment.id}`,
      })))
      if (resultResult.status === 'fulfilled') work.push(...resultResult.value.map((session: ResultSessionListSummary) => ({
        id: session.id,
        title: session.title || 'Untitled result entry',
        kind: 'Results',
        status: session.status,
        detail: `${session.encodedLearnerCount} of ${session.learnerCount} learners complete`,
        updatedAt: session.updatedAt,
        to: `/results/${session.id}`,
      })))
      setRecentWork(work.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3))
      setRecentLoading(false)
    }).catch(() => {
      if (active) {
        setRecentWork([])
        setRecentLoading(false)
      }
    })
    return () => { active = false }
  }, [isDemo, user?.id])

  return (
    <div className="home-page">
      <PageHeader
        eyebrow="Teacher workspace"
        title={`${greeting}, ${teacherName}`}
        description={profile?.schoolName ? `${profile.schoolName} · SY ${profile.schoolYear}` : 'Pick a task to move your teaching work forward.'}
        actions={<Link className="button primary home-create-button" to="/create"><Plus size={18} /> Create</Link>}
      />

      <section className="home-task-section" aria-labelledby="home-tasks-title">
        <div className="home-section-heading"><div><span className="eyebrow">Start here</span><h2 id="home-tasks-title">What do you want to create?</h2></div><Link className="text-link" to="/create">See all tasks <ArrowRight size={15} /></Link></div>
        <div className="home-task-grid">
          <ActionCard to={`/lesson-plans/new${assignmentQuery}`} title="Lesson Plan" description="Start with a topic, then add verified curriculum alignment as needed." actionLabel="Start" icon={BookOpenCheck} tone="blue" />
          <ActionCard to={`/tos/new${assignmentQuery}`} title="TOS" description="Plan assessment coverage from taught competencies." actionLabel="Start" icon={TableProperties} tone="green" />
          <ActionCard to="/assessments/new" title="Test / Quiz" description="Create a teacher-reviewed test from a finalized TOS." actionLabel="Start" icon={ClipboardCheck} tone="amber" />
          <ActionCard to="/results" title="Enter Results" description="Record answers or scores and review class evidence." actionLabel="Start" icon={ChartNoAxesColumnIncreasing} tone="slate" />
        </div>
      </section>

      <section className="home-lower-grid">
        <div className="panel home-panel">
          <div className="home-section-heading"><div><span className="eyebrow">Continue working</span><h2>Saved work</h2></div><Link className="text-link" to="/files">Documents <ArrowRight size={15} /></Link></div>
          {recentLoading ? <div className="home-empty-state"><span className="loader" aria-hidden="true" /><strong>Loading your recent work…</strong></div> : recentWork.length > 0 ? <div className="recent-work-list">{recentWork.map((work) => <Link className="recent-work-row" key={`${work.kind}-${work.id}`} to={work.to}><span className="recent-work-icon"><CalendarDays size={18} aria-hidden="true" /></span><span><strong>{work.title}</strong><small>{work.kind} · {work.detail}</small></span><span className={`recent-work-status ${work.status}`}>{formatStatus(work.status)}</span><ArrowRight size={16} aria-hidden="true" /></Link>)}</div> : <div className="home-empty-state"><span className="home-empty-icon"><CalendarDays size={22} aria-hidden="true" /></span><strong>Your recent work will appear here</strong><p>Open a task above to create your first saved document.</p><Link className="button secondary" to="/files">Open Documents</Link></div>}
        </div>

        <div className="panel home-panel home-attention-panel">
          <div className="home-section-heading"><div><span className="eyebrow">Needs attention</span><h2>Next useful step</h2></div></div>
          {!hasActiveAssignments ? (
            <StatusSummary tone="warning" icon={<School size={17} />} label="Add a class before creating documents" detail="Your class setup is saved with your profile." />
          ) : !selectedAssignment ? (
            <StatusSummary tone="info" icon={<UsersRound size={17} />} label="Choose a class context" detail="Use the context bar above to prefill related workflows." />
          ) : (
            <StatusSummary tone="success" icon={<ClipboardCheck size={17} />} label="You are ready to create" detail="Your selected class context can be reused across supported workflows." />
          )}
          <div className="home-attention-actions">
            <Link className="button ghost" to={!hasActiveAssignments ? '/classes' : '/create'}>{!hasActiveAssignments ? 'Add a class' : 'Choose a task'} <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="panel home-classes-panel" aria-labelledby="home-classes-title">
        <div className="home-section-heading"><div><span className="eyebrow">Your teaching</span><h2 id="home-classes-title">Classes</h2></div><Link className="text-link" to="/classes">Manage classes <ArrowRight size={15} /></Link></div>
        {assignments.length === 0 ? (
          <div className="home-empty-state compact"><span className="home-empty-icon"><School size={22} aria-hidden="true" /></span><strong>No classes added yet</strong><p>Add at least one class to unlock context-aware creation.</p><Link className="button primary" to="/classes"><Plus size={16} /> Add class</Link></div>
        ) : (
          <div className="home-class-list">
            {assignments.map((assignment) => <Link className="home-class-row" to="/classes" key={assignment.id}>
              <span className="home-class-grade">{assignment.gradeLevel.replace('Grade ', 'G')}</span>
              <span><strong>{assignment.learningArea}</strong><small>{assignment.sections.join(' · ') || 'No sections listed'}</small></span>
              <span className="home-class-count">{assignment.sections.length} {assignment.sections.length === 1 ? 'section' : 'sections'}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>)}
          </div>
        )}
        {assignments.length > 0 && <p className="home-class-footnote"><UsersRound size={15} aria-hidden="true" /> {assignments.length} assignment{assignments.length === 1 ? '' : 's'} · {sectionCount} section{sectionCount === 1 ? '' : 's'} · {profile?.schoolYear || 'School year not set'}</p>}
      </section>

      <section className="home-ai-note">
        <StatusSummary tone="neutral" icon={<BookOpenCheck size={17} />} label="AI assistance is optional" detail="Connect it later in Settings if you want AI-assisted drafts. Non-AI tools remain available." />
        <Link className="text-link" to="/settings#ai-assistance">Open AI settings <ArrowRight size={15} /></Link>
      </section>
    </div>
  )
}
