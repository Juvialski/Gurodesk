import { ArrowLeft, BookOpenCheck, CheckCircle2, CircleAlert, FileCheck2, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AiAssistTextarea } from '../components/AiAssistTextarea'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { buildAiDeclaration, LESSON_PLANNING_POLICY } from '../data/lessonPlanningPolicy'
import { createBlankLessonPlan } from '../lib/lessonPlanFactory'
import { validateLessonPlan } from '../lib/lessonPlanValidation'
import { loadCurriculumNavigator, loadLessonPlan, loadSchoolYearCalendar, saveLessonPlan } from '../lib/repository'
import type { CurriculumNavigatorBundle, SchoolYearCalendar } from '../types/curriculum'
import type { AiSupportType, LessonPlanContent, LessonPlanRecord } from '../types/lessonPlan'

export function LessonPlanEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, assignments, isDemo } = useApp()
  const requestedAssignmentId = searchParams.get('assignment') ?? ''
  const requestedCompetencyId = searchParams.get('competency') ?? ''
  const [assignmentId, setAssignmentId] = useState(requestedAssignmentId || assignments[0]?.id || '')
  const [plan, setPlan] = useState<LessonPlanRecord | null>(null)
  const [bundle, setBundle] = useState<CurriculumNavigatorBundle | null>(null)
  const [calendar, setCalendar] = useState<SchoolYearCalendar | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const assignment = assignments.find((item) => item.id === assignmentId) ?? null

  useEffect(() => {
    if (!user || !assignments.length) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const initialize = async () => {
      if (!isNew && id) {
        const existing = await loadLessonPlan(id, user.id, isDemo)
        if (!existing) throw new Error('This lesson plan was not found or you do not have access to it.')
        if (cancelled) return
        setPlan(existing)
        setAssignmentId(existing.assignmentId ?? assignments[0].id)
        return
      }
      const initialAssignment = assignments.find((item) => item.id === (requestedAssignmentId || assignmentId)) ?? assignments[0]
      if (cancelled) return
      setAssignmentId(initialAssignment.id)
      setPlan(createBlankLessonPlan(user.id, initialAssignment))
    }

    void initialize().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to open lesson plan.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, isNew, user?.id, isDemo])

  useEffect(() => {
    if (!assignment) return
    let cancelled = false
    Promise.all([
      loadCurriculumNavigator(assignment.schoolYear, assignment.gradeLevel, assignment.learningArea, isDemo),
      loadSchoolYearCalendar(assignment.schoolYear, isDemo),
    ]).then(([nextBundle, nextCalendar]) => {
      if (cancelled) return
      setBundle(nextBundle)
      setCalendar(nextCalendar)
      setPlan((current) => {
        if (!current) return current
        const next = structuredClone(current)
        if (isNew && current.assignmentId !== assignment.id) {
          const reset = createBlankLessonPlan(current.userId, assignment)
          return reset
        }
        if (!next.content.gradingTermLabel) next.content.gradingTermLabel = nextCalendar?.periods[0]?.label ?? ''
        if (!next.content.curriculumPeriodLabel) next.content.curriculumPeriodLabel = nextBundle.periods[0]?.label ?? ''
        const targetCompetency = nextBundle.competencies.find((item) => item.id === (requestedCompetencyId || next.content.competency.id))
        if (targetCompetency && !next.content.competency.id) {
          next.content.competency = {
            id: targetCompetency.id,
            code: targetCompetency.competencyCode,
            text: targetCompetency.competencyText,
            sourcePage: targetCompetency.sourcePage,
            sourceTitle: nextBundle.source?.title ?? null,
          }
          const period = nextBundle.periods.find((item) => item.id === targetCompetency.academicPeriodId)
          if (period) next.content.curriculumPeriodLabel = period.label
          const standard = nextBundle.standards.find((item) => item.academicPeriodId === targetCompetency.academicPeriodId && item.standardType === 'performance')
          next.content.performanceStandard = standard?.standardText ?? ''
        }
        return next
      })
    }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to resolve curriculum context.') })
    return () => { cancelled = true }
  }, [assignmentId, assignment?.schoolYear, assignment?.gradeLevel, assignment?.learningArea, isDemo])

  const validation = useMemo(() => plan ? validateLessonPlan(plan.content) : null, [plan])
  const period = bundle?.periods.find((item) => item.label === plan?.content.curriculumPeriodLabel) ?? bundle?.periods[0] ?? null
  const visibleCompetencies = bundle?.competencies.filter((item) => !period || item.academicPeriodId === period.id) ?? []

  function updateContent(mutator: (content: LessonPlanContent) => void) {
    setSavedMessage('')
    setPlan((current) => {
      if (!current) return current
      const next = structuredClone(current)
      mutator(next.content)
      next.title = next.content.lessonTitle || `${next.content.gradeLevel} ${next.content.learningArea} lesson`
      next.schoolYear = next.content.schoolYear
      next.academicPeriodLabel = next.content.curriculumPeriodLabel || null
      return next
    })
  }

  function changeAssignment(nextId: string) {
    if (!isNew) return
    setAssignmentId(nextId)
    const nextAssignment = assignments.find((item) => item.id === nextId)
    if (nextAssignment && user) setPlan(createBlankLessonPlan(user.id, nextAssignment))
  }

  function selectCurriculumPeriod(label: string) {
    updateContent((content) => {
      content.curriculumPeriodLabel = label
      content.competency = { id: '', code: null, text: '', sourcePage: null, sourceTitle: bundle?.source?.title ?? null }
      content.performanceStandard = ''
    })
  }

  function selectCompetency(competencyId: string) {
    const competency = bundle?.competencies.find((item) => item.id === competencyId)
    if (!competency) return
    updateContent((content) => {
      content.competency = {
        id: competency.id,
        code: competency.competencyCode,
        text: competency.competencyText,
        sourcePage: competency.sourcePage,
        sourceTitle: bundle?.source?.title ?? null,
      }
      const standard = bundle?.standards.find((item) => item.academicPeriodId === competency.academicPeriodId && item.standardType === 'performance')
      content.performanceStandard = standard?.standardText ?? ''
    })
  }

  function markAiUsed(supportType: AiSupportType) {
    updateContent((content) => {
      const operations = [...content.aiDeclaration.operations, supportType]
      content.aiDeclaration = buildAiDeclaration(operations, false)
    })
  }

  async function save(status: 'draft' | 'final') {
    if (!plan) return
    if (status === 'final' && !validation?.ready) return
    setSaving(true)
    setError(null)
    try {
      const next: LessonPlanRecord = { ...plan, status }
      const saved = await saveLessonPlan(next, isDemo)
      setPlan(saved)
      setSavedMessage(status === 'final' ? 'Lesson plan marked final.' : 'Draft saved.')
      if (isNew) navigate(`/lesson-plans/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lesson plan.')
    } finally {
      setSaving(false)
    }
  }

  if (!assignments.length) {
    return <EmptyState icon={BookOpenCheck} title="Add a teaching assignment first" description="Lesson planning starts from your teaching load so curriculum and policy context can be resolved correctly." />
  }
  if (loading || !plan) return <div className="panel lesson-loading"><span className="loader" /><strong>Opening lesson workspace…</strong></div>
  if (error && !plan) return <EmptyState icon={CircleAlert} title="Lesson plan could not be opened" description={error} />

  const aiContext = {
    gradeLevel: plan.content.gradeLevel,
    learningArea: plan.content.learningArea,
    competencyText: plan.content.competency.text,
    teacherIntent: plan.content.intentions.learningObjectives,
  }

  return (
    <>
      <PageHeader
        eyebrow="ILAW lesson planning · Phase 3"
        title={isNew ? 'New lesson plan' : plan.title || 'Lesson plan'}
        description="GuroDesk supplies the verified curriculum context and planning structure. You make the instructional decisions; AI can only refine text you already authored."
        actions={<div className="editor-header-actions"><Link to="/lesson-plans" className="button ghost"><ArrowLeft size={15} /> Back</Link><button className="button primary" disabled={saving} onClick={() => void save('draft')}><Save size={15} /> Save draft</button></div>}
      />

      <section className="policy-banner panel warning">
        <span className="policy-banner-icon"><ShieldCheck size={20} /></span>
        <div><strong>Teacher judgment is required</strong><p>{LESSON_PLANNING_POLICY.aiRule} AI buttons stay disabled until you write the section yourself.</p></div>
        <span className="policy-code">{LESSON_PLANNING_POLICY.code}</span>
      </section>

      {error && <div className="editor-alert error"><CircleAlert size={15} /> {error}</div>}
      {savedMessage && <div className="editor-alert success"><CheckCircle2 size={15} /> {savedMessage}</div>}

      <div className="lesson-editor-grid">
        <div className="lesson-editor-main">
          <section className="panel editor-section">
            <div className="editor-section-head"><div><span className="ilaw-letter neutral">01</span><div><span className="eyebrow">Lesson details</span><h2>Class and curriculum context</h2></div></div></div>
            <div className="form-grid two">
              <label>Teaching assignment<select value={assignmentId} disabled={!isNew} onChange={(event) => changeAssignment(event.target.value)}>{assignments.map((item) => <option key={item.id} value={item.id}>{item.gradeLevel} · {item.learningArea}</option>)}</select></label>
              <label>Lesson title<input value={plan.content.lessonTitle} onChange={(event) => updateContent((c) => { c.lessonTitle = event.target.value })} placeholder="Teacher-chosen lesson title" /></label>
              <label>Curriculum-guide period<select value={plan.content.curriculumPeriodLabel} onChange={(event) => selectCurriculumPeriod(event.target.value)} disabled={!bundle?.available}>{bundle?.periods.map((item) => <option key={item.id}>{item.label}</option>)}</select></label>
              <label>School grading term<select value={plan.content.gradingTermLabel} onChange={(event) => updateContent((c) => { c.gradingTermLabel = event.target.value })}>{calendar?.periods.map((item) => <option key={item.id}>{item.label}</option>)}</select></label>
              <label>Lesson date<input type="date" value={plan.content.lessonDate} onChange={(event) => updateContent((c) => { c.lessonDate = event.target.value })} /></label>
              <label>Week / schedule<input value={plan.content.weekLabel} onChange={(event) => updateContent((c) => { c.weekLabel = event.target.value })} placeholder="e.g. Week 3" /></label>
              <label>No. of sessions<input type="number" min="1" max="20" value={plan.content.numberOfSessions} onChange={(event) => updateContent((c) => { c.numberOfSessions = Math.max(1, Number(event.target.value) || 1) })} /></label>
              <label>Minutes per session<input type="number" min="10" max="300" value={plan.content.durationMinutes} onChange={(event) => updateContent((c) => { c.durationMinutes = Math.max(10, Number(event.target.value) || 60) })} /></label>
            </div>
            <div className="section-picker"><strong>Sections</strong><div>{assignment?.sections.map((section) => <label className="check-chip" key={section}><input type="checkbox" checked={plan.content.sections.includes(section)} onChange={(event) => updateContent((c) => { c.sections = event.target.checked ? [...new Set([...c.sections, section])] : c.sections.filter((item) => item !== section) })} /> {section}</label>)}</div></div>
            <label className="full-field">Verified competency<select value={plan.content.competency.id} onChange={(event) => selectCompetency(event.target.value)} disabled={!bundle?.available}><option value="">Choose a verified competency</option>{visibleCompetencies.map((item) => <option key={item.id} value={item.id}>{item.sortOrder}. {item.competencyText}</option>)}</select></label>
            {plan.content.competency.text && <div className="competency-grounding"><ShieldCheck size={16} /><div><strong>{plan.content.competency.code || 'Verified competency'}</strong><p>{plan.content.competency.text}</p><small>{plan.content.competency.sourceTitle}{plan.content.competency.sourcePage ? ` · p. ${plan.content.competency.sourcePage}` : ''}</small></div></div>}
            {plan.content.performanceStandard && <div className="standard-grounding"><small>Performance standard</small><p>{plan.content.performanceStandard}</p></div>}
            <AiAssistTextarea label="References" sectionKey="references" value={plan.content.references} onChange={(value) => updateContent((c) => { c.references = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={3} placeholder="Books, modules, websites, teacher-made materials, etc." />
          </section>

          <section className="panel editor-section ilaw-section intentions-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">I</span><div><span className="eyebrow">Intentions</span><h2>What learners need to learn</h2></div></div><span className="teacher-decision-chip">Teacher decision</span></div>
            <AiAssistTextarea label="Learner context / readiness" sectionKey="learnerContext" value={plan.content.learnerContext} onChange={(value) => updateContent((c) => { c.learnerContext = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} placeholder="What do you know about this class that should shape the lesson? Avoid learner names or sensitive personal data." help="Use class-level context only. Do not enter learner names, addresses, diagnoses, or other sensitive personal information." />
            <AiAssistTextarea label="Learning objectives" sectionKey="intentions.learningObjectives" value={plan.content.intentions.learningObjectives} onChange={(value) => updateContent((c) => { c.intentions.learningObjectives = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} placeholder="Write the clear, focused objectives you want learners to demonstrate." help="DO 016 requires the teacher to unpack, cluster, or sequence competencies. AI cannot create these objectives for you, but it may refine your wording afterward." />
          </section>

          <section className="panel editor-section ilaw-section learning-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">L</span><div><span className="eyebrow">Learning Experience</span><h2>How learners will engage and learn</h2></div></div><span className="teacher-decision-chip">Teacher decision</span></div>
            <AiAssistTextarea label="Learning resources" sectionKey="learningExperience.resources" value={plan.content.learningExperience.resources} onChange={(value) => updateContent((c) => { c.learningExperience.resources = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={3} placeholder="Resources selected by the teacher" />
            <AiAssistTextarea label="Home-based / Hinay alternative" sectionKey="learningExperience.homeBasedAlternative" value={plan.content.learningExperience.homeBasedAlternative} onChange={(value) => updateContent((c) => { c.learningExperience.homeBasedAlternative = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={3} placeholder="Alternative resource/activity if face-to-face instruction is interrupted" />
            <AiAssistTextarea label="Pre-lesson activity" sectionKey="learningExperience.preLessonActivity" value={plan.content.learningExperience.preLessonActivity} onChange={(value) => updateContent((c) => { c.learningExperience.preLessonActivity = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Brief readiness check, routine, or prior-knowledge activation" />
            <AiAssistTextarea label="Lesson flow" sectionKey="learningExperience.lessonFlow" value={plan.content.learningExperience.lessonFlow} onChange={(value) => updateContent((c) => { c.learningExperience.lessonFlow = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={8} placeholder="Write the sequence, interactions, prompts, practice, and adjustments you intend to use." help="AI cannot design the learning experience or instructional strategy. Once you have designed it, GuroDesk may organize or polish your wording." />
            <AiAssistTextarea label="Integration & contextualization" sectionKey="learningExperience.integrationContextualization" value={plan.content.learningExperience.integrationContextualization} onChange={(value) => updateContent((c) => { c.learningExperience.integrationContextualization = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Real-life, local, cultural, community, technology, or cross-learning-area connections" />
            <AiAssistTextarea label="Inclusion / accommodations" sectionKey="learningExperience.inclusionAccommodations" value={plan.content.learningExperience.inclusionAccommodations} onChange={(value) => updateContent((c) => { c.learningExperience.inclusionAccommodations = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Classroom-level supports, accommodations, or modifications where applicable" />
          </section>

          <section className="panel editor-section ilaw-section assessment-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">A</span><div><span className="eyebrow">Assessing Learning</span><h2>Evidence gathered during learning</h2></div></div><span className="teacher-decision-chip">Teacher decision</span></div>
            <AiAssistTextarea label="Formative assessments" sectionKey="assessingLearning.formativeAssessments" value={plan.content.assessingLearning.formativeAssessments} onChange={(value) => updateContent((c) => { c.assessingLearning.formativeAssessments = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={6} placeholder="Checks you will use throughout the session" />
            <AiAssistTextarea label="What evidence will show learning?" sectionKey="assessingLearning.evidenceOfLearning" value={plan.content.assessingLearning.evidenceOfLearning} onChange={(value) => updateContent((c) => { c.assessingLearning.evidenceOfLearning = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Describe the evidence you will look for before moving forward." />
          </section>

          <section className="panel editor-section ilaw-section ways-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">W</span><div><span className="eyebrow">Ways Forward</span><h2>Reflection and next instructional steps</h2></div></div><span className="teacher-decision-chip">Teacher judgment</span></div>
            <AiAssistTextarea label="Reflection" sectionKey="waysForward.reflection" value={plan.content.waysForward.reflection} onChange={(value) => updateContent((c) => { c.waysForward.reflection = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={5} placeholder="After teaching, record what the evidence showed and what you noticed." />
            <AiAssistTextarea label="Next steps / intervention" sectionKey="waysForward.nextSteps" value={plan.content.waysForward.nextSteps} onChange={(value) => updateContent((c) => { c.waysForward.nextSteps = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={5} placeholder="Reteaching, remediation, enrichment, adjustment, or next lesson decision" />
            <AiAssistTextarea label="Extended learning opportunities" sectionKey="waysForward.extendedLearning" value={plan.content.waysForward.extendedLearning} onChange={(value) => updateContent((c) => { c.waysForward.extendedLearning = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Optional reinforcement, enrichment, or remediation beyond the session" />
          </section>
        </div>

        <aside className="lesson-editor-side">
          <section className="panel validation-panel">
            <span className="eyebrow">ILAW self-check</span>
            <div className="validation-score"><strong>{validation?.score ?? 0}%</strong><span>{validation?.ready ? 'Ready to finalize' : 'Draft needs attention'}</span></div>
            <div className="validation-list">{validation?.items.map((item) => <div className={`validation-item ${item.passed ? 'passed' : ''}`} key={item.key}>{item.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}<div><strong>{item.label}</strong><small>{item.detail}</small></div></div>)}</div>
          </section>

          <section className="panel ai-declaration-panel">
            <span className="eyebrow">AI use declaration</span>
            <div className="ai-declaration-title"><Sparkles size={17} /><strong>{plan.content.aiDeclaration.used ? 'AI assistance recorded' : 'No AI used'}</strong></div>
            <p>{plan.content.aiDeclaration.statement}</p>
            {plan.content.aiDeclaration.used && <label className="review-check"><input type="checkbox" checked={plan.content.aiDeclaration.reviewedByTeacher} onChange={(event) => updateContent((c) => { c.aiDeclaration = buildAiDeclaration(c.aiDeclaration.operations, event.target.checked) })} /> I reviewed, validated, and adapted all AI-assisted text.</label>}
          </section>

          <section className="panel final-actions-panel">
            <span className="eyebrow">Document status</span>
            <div className="current-status"><FileCheck2 size={16} /><strong>{plan.status}</strong></div>
            <button className="button primary full" disabled={saving} onClick={() => void save('draft')}><Save size={15} /> Save draft</button>
            <button className="button secondary full" disabled={saving || !validation?.ready} onClick={() => void save('final')}><CheckCircle2 size={15} /> Mark final</button>
            {!validation?.ready && <small>Complete the ILAW self-check before marking this plan final.</small>}
          </section>
        </aside>
      </div>
    </>
  )
}
