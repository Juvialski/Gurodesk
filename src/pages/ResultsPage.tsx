import { ArrowLeft, ArrowRight, Check, ClipboardList, FileCheck2, FlaskConical, Plus, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { SimpleAdvancedToggle } from '../components/ui/SimpleAdvancedToggle'
import { ResultMetric } from '../components/results/ResultMetric'
import { useApp } from '../contexts/AppContext'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { loadAssessmentDocuments } from '../lib/assessmentRepository'
import { createAndStoreDemoResultsSample, createResultSession, loadClassLearners, loadResultSessions } from '../lib/resultsRepository'
import type { AssessmentRecord } from '../types/assessment'
import type { AssessmentResultSession } from '../types/results'
import '../results.css'
import '../workflows.css'

function dateLabel(value: string) {
  if (!value) return 'Not dated'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function sessionProgress(session: AssessmentResultSession) {
  type SessionSummary = { learnerCount?: unknown; encodedLearnerCount?: unknown; totalLearners?: unknown; encoded?: unknown }
  const withSummary = session as unknown as SessionSummary & { summary?: SessionSummary }
  const summary = withSummary.summary ?? withSummary
  const total = Number(summary.learnerCount ?? summary.totalLearners ?? (session.learners.length || Number.NaN))
  const encoded = Number(summary.encodedLearnerCount ?? summary.encoded ?? (session.entryMode === 'score_only'
    ? session.scoreOnlyOutcomes.filter((outcome) => outcome.rawScore !== null).length
    : new Set(session.itemOutcomes.map((outcome) => outcome.participantId)).size))
  if (!Number.isFinite(total) || !Number.isFinite(encoded) || total <= 0) return { label: '—', percentage: null, available: false }
  return { label: `${encoded}/${total}`, percentage: Math.min(100, Math.max(0, encoded / total * 100)), available: true }
}

export function ResultsPage() {
  const { user, assignments, isDemo } = useApp()
  const { selection, updateSelection } = useWorkspaceSelection(user?.id)
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([])
  const [sessions, setSessions] = useState<AssessmentResultSession[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [openNew, setOpenNew] = useState(false)
  const [entryStep, setEntryStep] = useState<1 | 2>(1)
  const [assessmentId, setAssessmentId] = useState('')
  const [assignmentId, setAssignmentId] = useState(selection.assignmentId ?? '')
  const [sectionName, setSectionName] = useState(selection.section ?? '')
  const [administrationDate, setAdministrationDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [title, setTitle] = useState('')
  const [entryMode, setEntryMode] = useState<AssessmentResultSession['entryMode']>('answer_sheet')
  const [learners, setLearners] = useState<Awaited<ReturnType<typeof loadClassLearners>>>([])
  const [selectedLearners, setSelectedLearners] = useState<string[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [learnersOpen, setLearnersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>(() => {
    try {
      return localStorage.getItem('gurodesk.results.view-mode') === 'advanced' ? 'advanced' : 'simple'
    } catch {
      return 'simple'
    }
  })

  const finalAssessments = useMemo(() => assessments.filter((assessment) => assessment.status === 'final'), [assessments])
  const selectedAssignment = assignments.find((assignment) => assignment.id === assignmentId)

  useEffect(() => {
    try {
      localStorage.setItem('gurodesk.results.view-mode', viewMode)
    } catch {
      // Local preference is optional; result sessions remain unchanged.
    }
  }, [viewMode])
  // A result session must never mix an assessment and teaching assignment.
  // Assessments without an owning assignment are intentionally unavailable.
  const compatibleAssessments = useMemo(() => finalAssessments.filter((assessment) => Boolean(assignmentId) && assessment.assignmentId === assignmentId), [assignmentId, finalAssessments])
  const demoSampleSource = useMemo(() => finalAssessments.find((assessment) => {
    const owningAssignment = assignments.find((assignment) => assignment.id === assessment.assignmentId)
    return Boolean(assessment.assignmentId && assessment.items.length > 0 && owningAssignment?.sections[0])
  }), [assignments, finalAssessments])

  async function refresh() {
    if (!user) return
    setLoading(true)
    try {
      const [nextAssessments, nextSessions] = await Promise.all([
        loadAssessmentDocuments(user.id, isDemo),
        // Archived history remains teacher-accessible for reports; it is
        // read-only in the session page and never offered for destructive edit.
        loadResultSessions(user.id, isDemo, { includeArchived: true }),
      ])
      setAssessments(nextAssessments)
      setSessions(nextSessions)
      setError('')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load results.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [user?.id, isDemo])

  useEffect(() => {
    if (!assignments.length) return
    const assignment = assignments.find((item) => item.id === assignmentId && item.isActive)
    if (!assignment) {
      const fallback = assignments.find((item) => item.isActive) ?? null
      setAssignmentId(fallback?.id ?? '')
      setSectionName(fallback?.sections[0] ?? '')
      return
    }
    if (!assignment.sections.includes(sectionName)) setSectionName(assignment.sections[0] ?? '')
  }, [assignmentId, assignments])

  useEffect(() => {
    if (!assignmentId) return
    updateSelection({ assignmentId, section: sectionName || null })
  }, [assignmentId, sectionName, updateSelection])

  useEffect(() => {
    const first = compatibleAssessments[0]
    if (!first) setAssessmentId('')
    else if (!compatibleAssessments.some((assessment) => assessment.id === assessmentId)) setAssessmentId(first.id)
  }, [compatibleAssessments])

  useEffect(() => {
    if (!user || !assignmentId || !sectionName) {
      setLearners([])
      setSelectedLearners([])
      setRosterLoading(false)
      return
    }
    let active = true
    setLearners([])
    setSelectedLearners([])
    setRosterLoading(true)
    void loadClassLearners(user.id, assignmentId, sectionName, isDemo)
      .then((nextLearners) => {
        if (!active) return
        setLearners(nextLearners)
        setSelectedLearners(nextLearners.filter((learner) => learner.status === 'active').map((learner) => learner.id))
      })
      .catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to load the roster.') })
      .finally(() => { if (active) setRosterLoading(false) })
    return () => { active = false }
  }, [assignmentId, sectionName, user?.id, isDemo])

  function beginNew() {
    setOpenNew(true)
    setEntryStep(1)
    setLearnersOpen(false)
    if (!assignmentId) setAssignmentId(assignments.find((assignment) => assignment.id === selection.assignmentId && assignment.isActive)?.id ?? assignments.find((assignment) => assignment.isActive)?.id ?? assignments[0]?.id ?? '')
  }

  async function create() {
    if (!user) return
    const assessment = finalAssessments.find((item) => item.id === assessmentId)
    const activeLearnerIds = new Set(learners.filter((learner) => learner.status === 'active').map((learner) => learner.id))
    if (rosterLoading || !assessment || assessment.assignmentId !== assignmentId || !assignmentId || !sectionName || selectedLearners.length === 0 || selectedLearners.some((learnerId) => !activeLearnerIds.has(learnerId))) {
      setError('Choose a finalized assessment, assignment section, and at least one active learner.')
      return
    }
    setWorking(true)
    setError('')
    try {
      const session = await createResultSession({
        assessmentId: assessment.id,
        assignmentId,
        sectionName,
        administrationDate,
        title: title.trim() || assessment.title,
        entryMode,
        learnerIds: selectedLearners,
      }, user.id, isDemo, assessment)
      navigate(`/results/${session.id}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create the result session.')
    } finally {
      setWorking(false)
    }
  }

  async function createDemoSample() {
    if (!isDemo || !user || !demoSampleSource || !demoSampleSource.assignmentId) return
    const owningAssignment = assignments.find((assignment) => assignment.id === demoSampleSource.assignmentId)
    const sampleSection = owningAssignment?.sections[0]
    if (!owningAssignment || !sampleSection) return
    setWorking(true); setError(''); setMessage('')
    try {
      const sample = await createAndStoreDemoResultsSample(demoSampleSource, user.id, owningAssignment.id, sampleSection)
      setSessions((current) => [sample, ...current.filter((session) => session.id !== sample.id)])
      setMessage('Clearly labelled demo results were created from the finalized assessment snapshot. No invented competency data was used.')
      navigate(`/results/${sample.id}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create the demo results sample.')
    } finally { setWorking(false) }
  }

  const totalActiveLearners = learners.filter((learner) => learner.status === 'active').length

  const selectedTargetAssessment = compatibleAssessments.find((a) => a.id === assessmentId)
  const isPerformanceTaskAssessment = selectedTargetAssessment?.mode === 'performance_task' || Boolean(selectedTargetAssessment?.performanceTask)

  return <>
    <PageHeader
      eyebrow="Assessment results"
      title="Results"
      description="Choose an assessment and class, then enter learner results in the way that fits your papers or performance rubrics."
      actions={<div className="results-header-actions"><SimpleAdvancedToggle mode={viewMode} onChange={setViewMode} /><button className="button primary" type="button" onClick={beginNew}><Plus size={16} /> Enter results</button>{isDemo && demoSampleSource && <button className="button ghost" type="button" disabled={working} onClick={() => void createDemoSample()}><FlaskConical size={16} /> Create labelled demo sample</button>}</div>}
    />

    <section className="results-metric-grid">
      <ResultMetric label="Result sets" value={sessions.length} hint="Drafts and finalized" icon={<ClipboardList size={17} />} />
      <ResultMetric label="Final assessments" value={finalAssessments.length} hint="Only finalized sources" tone="green" icon={<FileCheck2 size={17} />} />
      <ResultMetric label="Active learners" value={totalActiveLearners} hint="Selected class section" tone="amber" icon={<UsersRound size={17} />} />
    </section>

    {openNew && <section className={`panel results-setup-panel workflow-results-setup ${viewMode}`}>
      <div className="results-section-heading">
        <div>
          <h2>Enter results</h2>
          <p>Choose a finalized assessment and class to start recording learner results.</p>
        </div>
        <button className="button ghost" type="button" onClick={() => setOpenNew(false)}>Close</button>
      </div>

      {viewMode === 'simple' && (
        <nav className="workflow-wizard-stepper" aria-label="Result entry steps">
          <button
            type="button"
            className={`workflow-stepper-btn ${entryStep === 1 ? 'active' : ''} ${entryStep > 1 ? 'completed' : ''}`}
            onClick={() => setEntryStep(1)}
          >
            <span className="workflow-stepper-num">{entryStep > 1 ? <Check size={12} /> : '1'}</span>
            <span>1. Assessment & Method</span>
          </button>
          <button
            type="button"
            className={`workflow-stepper-btn ${entryStep === 2 ? 'active' : ''}`}
            onClick={() => setEntryStep(2)}
          >
            <span className="workflow-stepper-num">2</span>
            <span>2. Confirm Learners ({selectedLearners.length})</span>
          </button>
        </nav>
      )}

      {(viewMode === 'advanced' || entryStep === 1) && (
        <>
          <div className="results-form-grid">
            <label>{viewMode === 'simple' ? 'Assessment' : 'Finalized assessment'}<select value={assessmentId} onChange={(event) => {
              const nextId = event.target.value
              setAssessmentId(nextId)
              const target = compatibleAssessments.find((a) => a.id === nextId)
              if (target?.mode === 'performance_task' || Boolean(target?.performanceTask)) setEntryMode('rubric')
              else if (entryMode === 'rubric') setEntryMode('answer_sheet')
            }}><option value="">Choose assessment</option>{compatibleAssessments.map((assessment) => <option value={assessment.id} key={assessment.id}>{assessment.title} · {assessment.mode === 'performance_task' ? 'Performance Task (Rubric)' : `${assessment.items.length} items`}</option>)}</select>{viewMode === 'simple' && <small className="workflow-field-help">Only finalized assessments appear.</small>}</label>
            <label>{viewMode === 'simple' ? 'Class' : 'Assignment'}<select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">Choose class</option>{assignments.filter((assignment) => assignment.isActive).map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.gradeLevel} · {assignment.learningArea}</option>)}</select></label>
            <label>Section<select value={sectionName} onChange={(event) => setSectionName(event.target.value)} disabled={!selectedAssignment}><option value="">Choose section</option>{selectedAssignment?.sections.map((section) => <option value={section} key={section}>{section}</option>)}</select></label>
            {viewMode === 'advanced' && <><label>Administration date<input type="date" value={administrationDate} onChange={(event) => setAdministrationDate(event.target.value)} /></label><label className="results-form-wide">Title (optional)<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g., Quiz 1 results" /></label></>}
          </div>
          <div className="results-mode-picker"><strong>{viewMode === 'simple' ? 'How do you want to enter results?' : 'Encoding mode'}</strong><div className="results-segmented" role="group" aria-label="Result entry method">{(
            isPerformanceTaskAssessment
              ? [['rubric', 'Rubric scoring', 'Score 4-level criteria & qualitative notes']]
              : [
                ['answer_sheet', 'Enter answers', 'Best for objective tests'],
                ['item', 'Enter by question', 'Check one item across the class'],
                ['score_only', 'Enter scores only', 'Item analysis will be limited'],
              ]
          ).map(([value, label, hint]) => <button type="button" key={value} className={entryMode === value ? 'selected' : ''} onClick={() => setEntryMode(value as AssessmentResultSession['entryMode'])}><strong>{label}</strong><small>{hint}</small></button>)}</div></div>
          {entryMode === 'score_only' && <p className="workflow-limit-note">Scores-only entry is fastest when papers are already checked. Per-question item analysis will be limited.</p>}
          {viewMode === 'simple' && (
            <div className="workflow-step-footer">
              <button type="button" className="button ghost" onClick={() => setOpenNew(false)}>Cancel</button>
              <div className="workflow-step-footer-actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={!assessmentId || !assignmentId || !sectionName}
                  onClick={() => setEntryStep(2)}
                >
                  Next: Confirm Learners ({selectedLearners.length}) <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(viewMode === 'advanced' || entryStep === 2) && (
        <>
          <div className="results-learner-selection">
            <div className="results-section-heading compact">
              <div>
                <h3>{viewMode === 'simple' ? 'Active learners' : `Active learners in ${sectionName || 'this section'}`}</h3>
                <p>{selectedLearners.length} of {totalActiveLearners} selected · all active learners start selected.</p>
              </div>
              <div className="results-inline-actions">
                <button className="text-button" type="button" onClick={() => setSelectedLearners(learners.filter((learner) => learner.status === 'active').map((learner) => learner.id))}>Select all</button>
                <button className="text-button" type="button" onClick={() => setSelectedLearners([])}>Clear</button>
              </div>
            </div>
            <div className="results-selection-grid">
              {learners.filter((learner) => learner.status === 'active').map((learner) => (
                <label key={learner.id} className="results-selection-chip">
                  <input type="checkbox" checked={selectedLearners.includes(learner.id)} onChange={(event) => setSelectedLearners((current) => event.target.checked ? [...current, learner.id] : current.filter((id) => id !== learner.id))} />
                  <span>{learner.displayName}</span>
                </label>
              ))}
            </div>
            {learners.length === 0 && <p className="results-muted">No learners yet. <Link to={`/results/roster/${assignmentId}/${encodeURIComponent(sectionName)}`}>Open roster</Link> to add them.</p>}
          </div>

          <div className="workflow-step-footer">
            {viewMode === 'simple' ? (
              <button type="button" className="button ghost" onClick={() => setEntryStep(1)}>
                <ArrowLeft size={15} /> Back: Assessment & Method
              </button>
            ) : (
              <Link className="button ghost" to={`/results/roster/${assignmentId}/${encodeURIComponent(sectionName)}`}>Manage roster</Link>
            )}
            <div className="workflow-step-footer-actions">
              {viewMode === 'simple' && (
                <Link className="button ghost" to={`/results/roster/${assignmentId}/${encodeURIComponent(sectionName)}`}>Manage roster</Link>
              )}
              <button className="button primary" type="button" disabled={working || rosterLoading || !selectedLearners.length} onClick={() => void create()}>
                {working ? 'Starting…' : rosterLoading ? 'Loading learners…' : 'Start entering results'} <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>}

    {error && <div className="form-message error results-alert">{error}</div>}
    {message && <div className="form-message results-alert">{message}</div>}
    {loading && <div className="panel results-loading"><span className="loader" /><strong>Loading result sets…</strong></div>}
    {!loading && !error && !finalAssessments.length && <EmptyState icon={FileCheck2} title="Finalize an assessment first" description="Result sessions use only finalized assessments so the answer key, item numbers, competency mappings, and cognitive categories remain historically traceable."><Link className="button secondary" to="/assessments">Open assessments</Link></EmptyState>}
    {!loading && !error && finalAssessments.length > 0 && sessions.length === 0 && !openNew && <EmptyState icon={ClipboardList} title="No result sessions yet" description="Start with a class section and active learner roster. Enter answers, work one question at a time, or record scores only."><button className="button primary" type="button" onClick={beginNew}><Plus size={16} /> Enter results</button></EmptyState>}
    {!loading && sessions.length > 0 && <section className="results-session-grid">{sessions.map((session) => { const progress = sessionProgress(session); const sessionAssignment = assignments.find((assignment) => assignment.id === session.assignmentId); const assignmentLabel = sessionAssignment ? `${sessionAssignment.gradeLevel} · ${sessionAssignment.learningArea}` : 'Teaching assignment'; return <article className="panel results-session-card" key={session.id}><div className="results-session-top"><span className={`results-status ${session.status}`}>{session.status}</span><span>{session.entryMode === 'score_only' ? 'Scores only' : session.entryMode === 'rubric' ? 'Rubric scoring' : `${session.assessmentSnapshot.totalItems} items`}</span></div><h2>{session.title}</h2><p>{session.assessmentSnapshot.assessmentTitle}</p><div className="results-session-context"><span>{assignmentLabel} · {session.sectionName || 'Section'}</span><span>{dateLabel(session.administrationDate)}</span></div><div className="results-session-progress"><div><strong>{progress.label}</strong><small>{progress.available ? ' learners encoded' : ' open to view progress'}</small></div><div className="results-progress-track"><span style={{ width: `${progress.percentage ?? 0}%` }} /></div></div><div className="results-card-actions"><Link className="button secondary" to={`/results/${session.id}`}>{session.status === 'draft' ? 'Continue' : 'View class summary'} <ArrowRight size={14} /></Link><Link className="button ghost" to={`/results/${session.id}/analysis`}>Full analysis</Link></div></article> })}</section>}
  </>
}
