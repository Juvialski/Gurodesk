import { ArrowLeft, BookOpenCheck, CheckCircle2, CircleAlert, FileCheck2, Lightbulb, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AiAssistTextarea } from '../components/AiAssistTextarea'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { buildAiDeclaration, LESSON_PLANNING_POLICY } from '../data/lessonPlanningPolicy'
import { createBlankLessonPlan } from '../lib/lessonPlanFactory'
import { validateLessonPlan } from '../lib/lessonPlanValidation'
import {
  loadCurriculumNavigator,
  loadLessonPlan,
  loadSchoolYearCalendar,
  loadTeacherLessonPreferences,
  runLessonAiSupport,
  saveLessonPlan,
} from '../lib/repository'
import type { CurriculumNavigatorBundle, SchoolYearCalendar } from '../types/curriculum'
import type { AiSupportType, LessonAiSupportResponse, LessonPlanContent, LessonPlanRecord, LessonQuickDraft } from '../types/lessonPlan'
import { createDefaultTeacherLessonPreferences, type TeacherLessonPreferences } from '../types/teachingSetup'

const QUICK_DRAFT_LABELS: Array<[keyof LessonQuickDraft, string]> = [
  ['lessonTitle', 'Lesson title'],
  ['learningObjectives', 'Learning objectives'],
  ['homeBasedAlternative', 'Home-based alternative'],
  ['preLessonActivity', 'Pre-lesson activity'],
  ['lessonFlow', 'Lesson flow'],
  ['integrationContextualization', 'Integration & contextualization'],
  ['inclusionAccommodations', 'Inclusion / accommodations'],
  ['formativeAssessments', 'Formative assessments'],
  ['evidenceOfLearning', 'Evidence of learning'],
  ['nextSteps', 'Next steps'],
  ['extendedLearning', 'Extended learning'],
]

export function LessonPlanEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, assignments, isDemo } = useApp()
  const requestedAssignmentId = searchParams.get('assignment') ?? ''
  const requestedCompetencyId = searchParams.get('competency') ?? ''
  const [assignmentId, setAssignmentId] = useState(requestedAssignmentId || assignments[0]?.id || '')
  const [plan, setPlan] = useState<LessonPlanRecord | null>(null)
  const [bundle, setBundle] = useState<CurriculumNavigatorBundle | null>(null)
  const [calendar, setCalendar] = useState<SchoolYearCalendar | null>(null)
  const [preferences, setPreferences] = useState<TeacherLessonPreferences>(() => createDefaultTeacherLessonPreferences(user?.id ?? ''))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [quickDraftLoading, setQuickDraftLoading] = useState(false)
  const [quickDraftPreview, setQuickDraftPreview] = useState<LessonAiSupportResponse | null>(null)
  const [quickDraftMessage, setQuickDraftMessage] = useState<string | null>(null)

  const assignment = assignments.find((item) => item.id === assignmentId) ?? null

  function freshPlan(userId: string, targetAssignment: (typeof assignments)[number]) {
    const next = createBlankLessonPlan(userId, targetAssignment)
    next.content.durationMinutes = preferences.defaultDurationMinutes || 60
    return next
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadTeacherLessonPreferences(user.id, isDemo).then((next) => {
      if (cancelled) return
      setPreferences(next)
      setPlan((current) => {
        if (!current || !isNew || current.id || current.content.durationMinutes !== 60) return current
        const copy = structuredClone(current)
        copy.content.durationMinutes = next.defaultDurationMinutes || 60
        return copy
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, isDemo])

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
      setPlan(freshPlan(user.id, initialAssignment))
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
        if (isNew && current.assignmentId !== assignment.id) return freshPlan(current.userId, assignment)
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
  const periodCompetencies = bundle?.competencies.filter((item) => !period || item.academicPeriodId === period.id) ?? []
  // Never leave a verified competency select silently empty when verified rows exist.
  // If a legacy/imported period ID does not match, show all verified competencies and
  // make the mismatch visible instead of presenting a dead mobile dropdown.
  const periodMappingFallback = Boolean(bundle?.competencies.length && period && periodCompetencies.length === 0)
  const visibleCompetencies = periodMappingFallback ? (bundle?.competencies ?? []) : periodCompetencies

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
    if (nextAssignment && user) setPlan(freshPlan(user.id, nextAssignment))
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
      const pending = content.aiSuggestionReview?.pendingSections ?? []
      content.aiDeclaration = buildAiDeclaration(operations, pending.length === 0)
    })
  }

  function setResources(value: string) {
    updateContent((content) => {
      content.learningExperience.resources = value
      content.resourcesVerifiedByTeacher = false
    })
  }

  function appendSavedResource(resource: string) {
    updateContent((content) => {
      const current = content.learningExperience.resources.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
      if (!current.includes(resource)) current.push(resource)
      content.learningExperience.resources = current.join('\n')
      content.resourcesVerifiedByTeacher = false
    })
  }

  async function prepareQuickDraft() {
    const activePlan = plan
    if (!activePlan || !activePlan.content.competency.id) {
      setQuickDraftMessage('Choose a verified competency first.')
      return
    }
    setQuickDraftLoading(true)
    setQuickDraftMessage(null)
    try {
      const result = await runLessonAiSupport({
        supportType: 'quick_draft',
        sectionKey: 'lesson.quick_draft',
        text: '',
        documentId: activePlan.id || undefined,
        lessonContext: aiContext,
      }, isDemo)
      if (!result.draft) throw new Error('Gemini returned no Quick Draft.')
      setQuickDraftPreview(result)
    } catch (err) {
      setQuickDraftMessage(err instanceof Error ? err.message : 'Quick Draft could not be prepared.')
    } finally {
      setQuickDraftLoading(false)
    }
  }

  function applyQuickDraft() {
    const draft = quickDraftPreview?.draft
    if (!draft) return
    const applied: string[] = []
    updateContent((content) => {
      const use = (sectionKey: string, current: string, suggestion: string | undefined, setter: (value: string) => void) => {
        if (!current.trim() && suggestion?.trim()) {
          setter(suggestion.trim())
          applied.push(sectionKey)
        }
      }
      use('lessonTitle', content.lessonTitle, draft.lessonTitle, (value) => { content.lessonTitle = value })
      use('intentions.learningObjectives', content.intentions.learningObjectives, draft.learningObjectives, (value) => { content.intentions.learningObjectives = value })
      use('learningExperience.homeBasedAlternative', content.learningExperience.homeBasedAlternative, draft.homeBasedAlternative, (value) => { content.learningExperience.homeBasedAlternative = value })
      use('learningExperience.preLessonActivity', content.learningExperience.preLessonActivity, draft.preLessonActivity, (value) => { content.learningExperience.preLessonActivity = value })
      use('learningExperience.lessonFlow', content.learningExperience.lessonFlow, draft.lessonFlow, (value) => { content.learningExperience.lessonFlow = value })
      use('learningExperience.integrationContextualization', content.learningExperience.integrationContextualization, draft.integrationContextualization, (value) => { content.learningExperience.integrationContextualization = value })
      use('learningExperience.inclusionAccommodations', content.learningExperience.inclusionAccommodations, draft.inclusionAccommodations, (value) => { content.learningExperience.inclusionAccommodations = value })
      use('assessingLearning.formativeAssessments', content.assessingLearning.formativeAssessments, draft.formativeAssessments, (value) => { content.assessingLearning.formativeAssessments = value })
      use('assessingLearning.evidenceOfLearning', content.assessingLearning.evidenceOfLearning, draft.evidenceOfLearning, (value) => { content.assessingLearning.evidenceOfLearning = value })
      use('waysForward.nextSteps', content.waysForward.nextSteps, draft.nextSteps, (value) => { content.waysForward.nextSteps = value })
      use('waysForward.extendedLearning', content.waysForward.extendedLearning, draft.extendedLearning, (value) => { content.waysForward.extendedLearning = value })

      const pending = [...new Set([...(content.aiSuggestionReview?.pendingSections ?? []), ...applied])]
      content.aiSuggestionReview = { pendingSections: pending, lastQuickDraftAt: new Date().toISOString() }
      content.aiDeclaration = buildAiDeclaration([...content.aiDeclaration.operations, 'quick_draft'], pending.length === 0)
    })
    setQuickDraftPreview(null)
    setQuickDraftMessage('Quick Draft was applied to empty fields only. Existing teacher text was preserved. Review the highlighted sections before finalizing.')
  }

  function confirmAllAiReview() {
    updateContent((content) => {
      content.aiSuggestionReview = { ...(content.aiSuggestionReview ?? { lastQuickDraftAt: null }), pendingSections: [] }
      content.aiDeclaration = buildAiDeclaration(content.aiDeclaration.operations, true)
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
    performanceStandard: plan.content.performanceStandard,
    teacherIntent: plan.content.intentions.learningObjectives,
    curriculumPeriodLabel: plan.content.curriculumPeriodLabel,
    gradingTermLabel: plan.content.gradingTermLabel,
    durationMinutes: plan.content.durationMinutes,
    numberOfSessions: plan.content.numberOfSessions,
    learnerContext: plan.content.learnerContext || preferences.typicalClassProfile,
    currentFormativeAssessment: plan.content.assessingLearning.formativeAssessments,
    teachingSetup: {
      languagePreference: preferences.languagePreference,
      typicalClassProfile: preferences.typicalClassProfile,
      availableTechnology: preferences.availableTechnology,
      preferredApproaches: preferences.preferredApproaches,
      actualResources: plan.content.resourcesVerifiedByTeacher
        ? plan.content.learningExperience.resources.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
        : [],
      resourceNotes: preferences.resourceNotes,
    },
  }
  const pendingSections = plan.content.aiSuggestionReview?.pendingSections ?? []
  const pending = (sectionKey: string) => pendingSections.includes(sectionKey)

  return (
    <>
      <PageHeader
        eyebrow="ILAW lesson planning · Phase 3.5"
        title={isNew ? 'New lesson plan' : plan.title || 'Lesson plan'}
        description="Start from verified curriculum. GuroDesk can prepare optional objectives, activities, assessment, and ways-forward suggestions; you choose and adapt the final plan. Resources and references stay teacher-verified."
        actions={<div className="editor-header-actions"><Link to="/lesson-plans" className="button ghost"><ArrowLeft size={15} /> Back</Link><button className="button primary" disabled={saving} onClick={() => void save('draft')}><Save size={15} /> Save draft</button></div>}
      />

      <section className="policy-banner panel warning">
        <span className="policy-banner-icon"><ShieldCheck size={20} /></span>
        <div><strong>AI suggestions are starting points</strong><p>{LESSON_PLANNING_POLICY.aiRule} GuroDesk never auto-fills specific books, page numbers, materials, or devices.</p></div>
        <span className="policy-code">{LESSON_PLANNING_POLICY.code}</span>
      </section>

      {error && <div className="editor-alert error"><CircleAlert size={15} /> {error}</div>}
      {savedMessage && <div className="editor-alert success"><CheckCircle2 size={15} /> {savedMessage}</div>}

      <section className="panel quick-draft-panel">
        <div className="quick-draft-heading"><span className="quick-draft-icon"><Sparkles size={19} /></span><div><span className="eyebrow">Fast planning</span><h2>Quick Draft suggestions</h2><p>One Gemini call prepares a coherent set of suggestions for empty planning fields. Your existing text is never overwritten, and resources, references, and post-lesson reflection are never generated.</p></div><button className="button secondary" disabled={quickDraftLoading || !plan.content.competency.id} onClick={() => void prepareQuickDraft()}>{quickDraftLoading ? <span className="mini-spinner" /> : <Lightbulb size={15} />} Prepare suggestions</button></div>
        {quickDraftMessage && <div className="quick-draft-message">{quickDraftMessage}</div>}
        {quickDraftPreview?.draft && <div className="quick-draft-preview"><div className="quick-draft-preview-head"><div><strong>Review before applying</strong><small>{quickDraftPreview.model === 'demo-local-preview' ? 'Local demo preview' : `${quickDraftPreview.model}${quickDraftPreview.thinkingLevel === 'high' ? ' · high thinking' : ''}${quickDraftPreview.fallbackUsed ? ' · Lite fallback used' : ''}`}</small></div><p>Only currently empty fields will be filled.</p></div><div className="quick-draft-preview-list">{QUICK_DRAFT_LABELS.map(([key, label]) => quickDraftPreview.draft?.[key] ? <div key={key}><span>{label}</span><p>{quickDraftPreview.draft[key]}</p></div> : null)}</div><div className="quick-draft-preview-actions"><button className="button ghost" onClick={() => setQuickDraftPreview(null)}>Discard</button><button className="button primary" onClick={applyQuickDraft}><CheckCircle2 size={15} /> Apply to empty fields</button></div></div>}
        {pendingSections.length > 0 && <div className="quick-draft-pending"><CircleAlert size={16} /><div><strong>{pendingSections.length} Quick Draft section{pendingSections.length === 1 ? '' : 's'} need your review</strong><p>Edit anything you want, then confirm when the suggested text matches your actual class and intended instruction.</p></div><button className="button secondary" onClick={confirmAllAiReview}><CheckCircle2 size={15} /> I reviewed all</button></div>}
      </section>

      <div className="lesson-editor-grid">
        <div className="lesson-editor-main">
          <section className="panel editor-section">
            <div className="editor-section-head"><div><span className="ilaw-letter neutral">01</span><div><span className="eyebrow">Lesson details</span><h2>Class and curriculum context</h2></div></div></div>
            <div className="form-grid two">
              <label>Teaching assignment<select value={assignmentId} disabled={!isNew} onChange={(event) => changeAssignment(event.target.value)}>{assignments.map((item) => <option key={item.id} value={item.id}>{item.gradeLevel} · {item.learningArea}</option>)}</select></label>
              <label className={pending('lessonTitle') ? 'pending-control' : ''}>Lesson title<input value={plan.content.lessonTitle} onChange={(event) => updateContent((c) => { c.lessonTitle = event.target.value })} placeholder="Teacher-chosen lesson title" />{pending('lessonTitle') && <small className="pending-review-label">Quick Draft · review</small>}</label>
              <label>Curriculum-guide period<select value={plan.content.curriculumPeriodLabel} onChange={(event) => selectCurriculumPeriod(event.target.value)} disabled={!bundle?.available}>{bundle?.periods.map((item) => <option key={item.id}>{item.label}</option>)}</select></label>
              <label>School grading term<select value={plan.content.gradingTermLabel} onChange={(event) => updateContent((c) => { c.gradingTermLabel = event.target.value })}>{calendar?.periods.map((item) => <option key={item.id}>{item.label}</option>)}</select></label>
              <label>Lesson date<input type="date" value={plan.content.lessonDate} onChange={(event) => updateContent((c) => { c.lessonDate = event.target.value })} /></label>
              <label>Week / schedule<input value={plan.content.weekLabel} onChange={(event) => updateContent((c) => { c.weekLabel = event.target.value })} placeholder="e.g. Week 3" /></label>
              <label>No. of sessions<input type="number" min="1" max="20" value={plan.content.numberOfSessions} onChange={(event) => updateContent((c) => { c.numberOfSessions = Math.max(1, Number(event.target.value) || 1) })} /></label>
              <label>Minutes per session<input type="number" min="10" max="300" value={plan.content.durationMinutes} onChange={(event) => updateContent((c) => { c.durationMinutes = Math.max(10, Number(event.target.value) || 60) })} /></label>
            </div>
            <div className="section-picker"><strong>Sections</strong><div>{assignment?.sections.map((section) => <label className="check-chip" key={section}><input type="checkbox" checked={plan.content.sections.includes(section)} onChange={(event) => updateContent((c) => { c.sections = event.target.checked ? [...new Set([...c.sections, section])] : c.sections.filter((item) => item !== section) })} /> {section}</label>)}</div></div>
            <label className="full-field">Verified competency<select value={plan.content.competency.id} onChange={(event) => selectCompetency(event.target.value)} disabled={!bundle?.available || visibleCompetencies.length === 0}><option value="">{bundle === null ? 'Loading verified competencies…' : visibleCompetencies.length === 0 ? 'No verified competencies available' : 'Choose a verified competency'}</option>{visibleCompetencies.map((item) => <option key={item.id} value={item.id}>{item.sortOrder}. {item.competencyText}</option>)}</select></label>
            {bundle && !bundle.available && <div className="curriculum-inline-status warning"><CircleAlert size={15} /><div><strong>Verified curriculum unavailable for this assignment</strong><p>{bundle.coverageNote || 'No verified curriculum bundle was returned.'}</p></div></div>}
            {bundle?.available && visibleCompetencies.length === 0 && <div className="curriculum-inline-status warning"><CircleAlert size={15} /><div><strong>No competency rows were returned</strong><p>{bundle.coverageNote || 'Try reopening the lesson. GuroDesk will not invent competencies.'}</p></div></div>}
            {periodMappingFallback && <div className="curriculum-inline-status warning"><CircleAlert size={15} /><div><strong>Period mapping needs review</strong><p>The selected period did not match the imported competency period IDs, so all verified competencies are shown rather than leaving this selector empty.</p></div></div>}
            {bundle?.coverageNote?.includes('Verified local manifest fallback') && <div className="curriculum-inline-status info"><ShieldCheck size={15} /><div><strong>Verified manifest fallback active</strong><p>{bundle.coverageNote}</p></div></div>}
            {plan.content.competency.text && <div className="competency-grounding"><ShieldCheck size={16} /><div><strong>{plan.content.competency.code || 'Verified competency'}</strong><p>{plan.content.competency.text}</p><small>{plan.content.competency.sourceTitle}{plan.content.competency.sourcePage ? ` · p. ${plan.content.competency.sourcePage}` : ''}</small></div></div>}
            {plan.content.performanceStandard && <div className="standard-grounding"><small>Performance standard</small><p>{plan.content.performanceStandard}</p></div>}
            <label className="full-field teacher-verified-field">References<textarea rows={3} value={plan.content.references} onChange={(event) => updateContent((c) => { c.references = event.target.value })} placeholder="Only books, modules, websites, page numbers, or teacher-made materials you actually used." /><small>Teacher-entered only. GuroDesk will not generate citations or page numbers.</small></label>
          </section>

          <section className="panel editor-section ilaw-section intentions-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">I</span><div><span className="eyebrow">Intentions</span><h2>What learners need to learn</h2></div></div><span className="teacher-decision-chip">Teacher approves</span></div>
            {preferences.typicalClassProfile && !plan.content.learnerContext.trim() && <div className="saved-setup-callout"><span>Saved class profile available</span><button className="button ghost" onClick={() => updateContent((c) => { c.learnerContext = preferences.typicalClassProfile })}>Use saved profile</button></div>}
            <AiAssistTextarea label="Learner context / readiness" sectionKey="learnerContext" value={plan.content.learnerContext} onChange={(value) => updateContent((c) => { c.learnerContext = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} placeholder="What do you know about this class that should shape the lesson? Avoid learner names or sensitive personal data." help="Teacher-provided class-level context only. AI does not invent learner needs." />
            <AiAssistTextarea label="Learning objectives" sectionKey="intentions.learningObjectives" value={plan.content.intentions.learningObjectives} onChange={(value) => updateContent((c) => { c.intentions.learningObjectives = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} placeholder="Choose, edit, or write the focused objectives you want learners to demonstrate." help="GuroDesk can propose alternatives grounded in the verified competency; you choose and adapt the final objectives." suggestionType="suggest_learning_objectives" suggestionLabel="Suggest objectives" pendingQuickDraft={pending('intentions.learningObjectives')} />
          </section>

          <section className="panel editor-section ilaw-section learning-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">L</span><div><span className="eyebrow">Learning Experience</span><h2>How learners will engage and learn</h2></div></div><span className="teacher-decision-chip">Teacher approves</span></div>

            <div className="teacher-resource-field">
              <div className="field-label-row"><span>Learning resources</span><small>Teacher-verified only</small></div>
              <textarea rows={4} value={plan.content.learningExperience.resources} onChange={(event) => setResources(event.target.value)} placeholder="Enter only materials, books, modules, devices, or other resources you will actually use." />
              {preferences.actualResources.length > 0 && <div className="saved-resource-chips"><span>From My teaching setup:</span>{preferences.actualResources.map((resource) => <button type="button" key={resource} onClick={() => appendSavedResource(resource)}>+ {resource}</button>)}</div>}
              <div className="resource-actions"><button type="button" className="button ghost" onClick={() => updateContent((c) => { c.learningExperience.resources = 'No additional learning resources required.'; c.resourcesVerifiedByTeacher = true })}>No additional resources</button><label className="review-check"><input type="checkbox" checked={plan.content.resourcesVerifiedByTeacher} onChange={(event) => updateContent((c) => { c.resourcesVerifiedByTeacher = event.target.checked })} /> I verified these are resources I actually use for this lesson.</label></div>
              <small className="field-help">AI suggestions are constrained by the resources and technology you entered in Settings, but this field itself is never AI-filled.</small>
            </div>

            <AiAssistTextarea label="Home-based / Hinay alternative" sectionKey="learningExperience.homeBasedAlternative" value={plan.content.learningExperience.homeBasedAlternative} onChange={(value) => updateContent((c) => { c.learningExperience.homeBasedAlternative = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={3} placeholder="Alternative activity if face-to-face instruction is interrupted" suggestionType="suggest_home_alternative" suggestionLabel="Suggest alternatives" pendingQuickDraft={pending('learningExperience.homeBasedAlternative')} />
            <AiAssistTextarea label="Pre-lesson activity" sectionKey="learningExperience.preLessonActivity" value={plan.content.learningExperience.preLessonActivity} onChange={(value) => updateContent((c) => { c.learningExperience.preLessonActivity = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Brief readiness check, routine, or prior-knowledge activation" suggestionType="suggest_pre_lesson" suggestionLabel="Suggest openings" pendingQuickDraft={pending('learningExperience.preLessonActivity')} />
            <AiAssistTextarea label="Lesson flow" sectionKey="learningExperience.lessonFlow" value={plan.content.learningExperience.lessonFlow} onChange={(value) => updateContent((c) => { c.learningExperience.lessonFlow = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={8} placeholder="Choose or write the sequence, interactions, prompts, practice, and adjustments you intend to use." help="Suggestions use the verified competency, available time, and your saved teaching preferences. They cannot invent unlisted materials or technology." suggestionType="suggest_lesson_flow" suggestionLabel="Suggest lesson flows" pendingQuickDraft={pending('learningExperience.lessonFlow')} />
            <AiAssistTextarea label="Integration & contextualization" sectionKey="learningExperience.integrationContextualization" value={plan.content.learningExperience.integrationContextualization} onChange={(value) => updateContent((c) => { c.learningExperience.integrationContextualization = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Real-life, local, cultural, community, technology, or cross-learning-area connections" suggestionType="suggest_contextualization" suggestionLabel="Suggest contexts" pendingQuickDraft={pending('learningExperience.integrationContextualization')} />
            <AiAssistTextarea label="Inclusion / accommodations" sectionKey="learningExperience.inclusionAccommodations" value={plan.content.learningExperience.inclusionAccommodations} onChange={(value) => updateContent((c) => { c.learningExperience.inclusionAccommodations = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Classroom-level supports, accommodations, or modifications where applicable" help="Suggestions are universal supports only; Gemini is instructed not to infer diagnoses or sensitive learner needs." suggestionType="suggest_inclusion" suggestionLabel="Suggest supports" pendingQuickDraft={pending('learningExperience.inclusionAccommodations')} />
          </section>

          <section className="panel editor-section ilaw-section assessment-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">A</span><div><span className="eyebrow">Assessing Learning</span><h2>Evidence gathered during learning</h2></div></div><span className="teacher-decision-chip">Teacher approves</span></div>
            <AiAssistTextarea label="Formative assessments" sectionKey="assessingLearning.formativeAssessments" value={plan.content.assessingLearning.formativeAssessments} onChange={(value) => updateContent((c) => { c.assessingLearning.formativeAssessments = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={6} placeholder="Checks you will use throughout the session" suggestionType="suggest_formative_assessment" suggestionLabel="Suggest checks" pendingQuickDraft={pending('assessingLearning.formativeAssessments')} />
            <AiAssistTextarea label="What evidence will show learning?" sectionKey="assessingLearning.evidenceOfLearning" value={plan.content.assessingLearning.evidenceOfLearning} onChange={(value) => updateContent((c) => { c.assessingLearning.evidenceOfLearning = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Describe the evidence you will look for before moving forward." suggestionType="suggest_evidence_of_learning" suggestionLabel="Suggest evidence" pendingQuickDraft={pending('assessingLearning.evidenceOfLearning')} />
          </section>

          <section className="panel editor-section ilaw-section ways-section">
            <div className="editor-section-head"><div><span className="ilaw-letter">W</span><div><span className="eyebrow">Ways Forward</span><h2>Reflection and next instructional steps</h2></div></div><span className="teacher-decision-chip">Teacher judgment</span></div>
            <AiAssistTextarea label="Reflection" sectionKey="waysForward.reflection" value={plan.content.waysForward.reflection} onChange={(value) => updateContent((c) => { c.waysForward.reflection = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={5} placeholder="After teaching, record what the evidence showed and what you noticed." help="Reflection stays teacher-authored because it describes what actually happened. AI may polish your wording afterward." />
            <AiAssistTextarea label="Next steps / intervention" sectionKey="waysForward.nextSteps" value={plan.content.waysForward.nextSteps} onChange={(value) => updateContent((c) => { c.waysForward.nextSteps = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={5} placeholder="Reteaching, remediation, enrichment, adjustment, or next lesson decision" suggestionType="suggest_next_steps" suggestionLabel="Suggest contingencies" pendingQuickDraft={pending('waysForward.nextSteps')} />
            <AiAssistTextarea label="Extended learning opportunities" sectionKey="waysForward.extendedLearning" value={plan.content.waysForward.extendedLearning} onChange={(value) => updateContent((c) => { c.waysForward.extendedLearning = value })} isDemo={isDemo} context={aiContext} onAiUsed={markAiUsed} documentId={plan.id || undefined} rows={4} placeholder="Optional reinforcement, enrichment, or remediation beyond the session" suggestionType="suggest_extended_learning" suggestionLabel="Suggest extensions" pendingQuickDraft={pending('waysForward.extendedLearning')} />
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
            {pendingSections.length > 0 && <button className="button secondary full" onClick={confirmAllAiReview}><CheckCircle2 size={15} /> Confirm Quick Draft review</button>}
            {plan.content.aiDeclaration.used && pendingSections.length === 0 && !plan.content.aiDeclaration.reviewedByTeacher && <label className="review-check"><input type="checkbox" checked={plan.content.aiDeclaration.reviewedByTeacher} onChange={(event) => updateContent((c) => { c.aiDeclaration = buildAiDeclaration(c.aiDeclaration.operations, event.target.checked) })} /> I reviewed, validated, and adapted all AI-assisted content.</label>}
            {plan.content.aiDeclaration.used && plan.content.aiDeclaration.reviewedByTeacher && pendingSections.length === 0 && <div className="review-complete"><CheckCircle2 size={14} /> Teacher review recorded</div>}
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
