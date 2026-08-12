import { ArrowLeft, Check, ClipboardCheck, FileCheck2, PauseCircle, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { applyAssessmentItemSuggestion, enrichAssessmentVisualsSequentially, generateAssessmentItemSuggestion } from '../lib/assessmentGeneration'
import { createAssessmentMasterPlan } from '../lib/assessmentMasterPlanner'
import { minimumAssessmentV2Points, questionTypeSuitability, validateAssessmentV2Setup, type AssessmentV2Setup } from '../lib/assessmentGenerationV2'
import { createAssessmentFromMasterPlan, saveAssessmentDocument, saveAssessmentItemVisualCheckpoint } from '../lib/assessmentRepository'
import { loadTosDocuments } from '../lib/tosRepository'
import { ASSESSMENT_QUESTION_TYPES, type AssessmentCpdKey, type AssessmentRecord, type AssessmentVisualPolicy, type QuestionType } from '../types/assessment'
import type { TosRecord } from '../types/tos'
import { extractErrorMessage, typeLabel } from './assessmentUi'

const DEFAULT_TYPES: QuestionType[] = [...ASSESSMENT_QUESTION_TYPES]
const CPD_ORDER: AssessmentCpdKey[] = ['remembering', 'understanding', 'applying', 'analyzing', 'evaluating', 'creating', 'other']
const CPD_LABELS: Record<AssessmentCpdKey, string> = { remembering: 'Remembering', understanding: 'Understanding', applying: 'Applying', analyzing: 'Analyzing', evaluating: 'Evaluating', creating: 'Creating', other: 'Other' }

type GenerationStage = 'planning' | 'questions' | 'visuals' | 'finishing' | 'paused'
type GenerationState = { stage: GenerationStage; current: number; total: number; message: string; model?: string }

function replaceItem(record: AssessmentRecord, item: AssessmentRecord['items'][number]): AssessmentRecord {
  return { ...record, items: record.items.map((candidate) => candidate.id === item.id ? item : candidate) }
}

export function AssessmentNewPage() {
  const { user, isDemo } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tosDocuments, setTosDocuments] = useState<TosRecord[]>([])
  const [selectedId, setSelectedId] = useState(searchParams.get('tos') ?? '')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [generationInstructions, setGenerationInstructions] = useState('')
  const [totalPoints, setTotalPoints] = useState(40)
  const [pointsTouched, setPointsTouched] = useState(false)
  const [allowedTypes, setAllowedTypes] = useState<QuestionType[]>(DEFAULT_TYPES)
  const [visualPolicy, setVisualPolicy] = useState<AssessmentVisualPolicy>('balanced')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generation, setGeneration] = useState<GenerationState | null>(null)
  const [workingRecord, setWorkingRecord] = useState<AssessmentRecord | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    void loadTosDocuments(user.id, isDemo)
      .then((documents) => {
        if (!active) return
        const finals = documents.filter((document) => document.status === 'final')
        setTosDocuments(finals)
        const requested = finals.find((document) => document.id === (searchParams.get('tos') ?? ''))
        setSelectedId((current) => requested?.id ?? finals.find((document) => document.id === current)?.id ?? finals[0]?.id ?? '')
      })
      .catch((nextError) => { if (active) setError(extractErrorMessage(nextError, 'Unable to load finalized TOS documents.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id, isDemo, searchParams])

  const selected = useMemo(() => tosDocuments.find((document) => document.id === selectedId) ?? null, [tosDocuments, selectedId])

  useEffect(() => {
    if (!selected || pointsTouched || !allowedTypes.length) return
    const sourceSize = Number(selected.content.totalItems)
    try {
      const minimum = minimumAssessmentV2Points(selected, allowedTypes)
      const suggested = Math.max(Number.isSafeInteger(sourceSize) && sourceSize > 0 ? sourceSize : 1, minimum)
      setTotalPoints(suggested)
    } catch {
      // The live coverage validator explains incompatible type selections.
      if (Number.isSafeInteger(sourceSize) && sourceSize > 0) setTotalPoints(sourceSize)
    }
  }, [selected?.id, pointsTouched, allowedTypes])

  const setup = useMemo<AssessmentV2Setup>(() => ({
    totalPoints,
    allowedTypes,
    visualPolicy,
    generationInstructions: generationInstructions.trim(),
  }), [totalPoints, allowedTypes, visualPolicy, generationInstructions])
  const setupValidation = useMemo(() => validateAssessmentV2Setup(selected, setup), [selected, setup])
  const cpdSummary = useMemo(() => {
    const totals = new Map<AssessmentCpdKey, number>()
    setupValidation.pointBuckets.forEach((bucket) => totals.set(bucket.cpdKey, (totals.get(bucket.cpdKey) ?? 0) + bucket.pointsAllocated))
    return CPD_ORDER.filter((key) => (totals.get(key) ?? 0) > 0).map((key) => ({ key, label: CPD_LABELS[key], points: totals.get(key) ?? 0 }))
  }, [setupValidation.pointBuckets])

  function toggleType(type: QuestionType) {
    setAllowedTypes((current) => current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type])
  }

  async function generateAssessment(resumeRecord?: AssessmentRecord) {
    if (!user || !selected) return
    const currentValidation = validateAssessmentV2Setup(selected, setup)
    if (!currentValidation.ready) { setError(currentValidation.errors[0]?.message ?? 'Complete the assessment setup before generating.'); return }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setError('')
    let working = resumeRecord ?? workingRecord
    try {
      if (!working) {
        setGeneration({ stage: 'planning', current: 0, total: 1, message: 'Designing the full assessment plan…' })
        const planned = await createAssessmentMasterPlan({ tos: selected, setup, demo: isDemo, title: title.trim(), instructions: instructions.trim(), signal: controller.signal })
        setGeneration({ stage: 'planning', current: 1, total: 1, message: `Master plan ready${planned.model ? ` · ${planned.model}` : ''}`, model: planned.model })
        working = await createAssessmentFromMasterPlan(selected, planned.plan, user.id, isDemo, title.trim() || undefined, instructions.trim(), visualPolicy, generationInstructions.trim(), allowedTypes)
        setWorkingRecord(working)
      }

      const pendingQuestions = working.items.filter((item) => item.authorshipState === 'empty' || !item.prompt.trim())
      let completedQuestions = working.items.length - pendingQuestions.length
      setGeneration({ stage: 'questions', current: completedQuestions, total: working.items.length, message: pendingQuestions.length ? 'Generating questions from the frozen master plan…' : 'All questions are already saved.' })

      for (const pending of pendingQuestions) {
        if (controller.signal.aborted) throw new DOMException('Generation cancelled.', 'AbortError')
        const source = working.items.find((item) => item.id === pending.id) ?? pending
        const suggestion = await generateAssessmentItemSuggestion({
          assessment: working,
          item: source,
          demo: isDemo,
          teacherContext: generationInstructions.trim(),
          signal: controller.signal,
          onQuestionReady: async (draftSuggestion) => {
            const savedDraftItem = applyAssessmentItemSuggestion(source, draftSuggestion, { source: 'generated' })
            working = replaceItem(working!, savedDraftItem)
            working = await saveAssessmentDocument(working, isDemo)
            setWorkingRecord(working)
          },
        })
        const currentItem = working.items.find((item) => item.id === source.id) ?? source
        const finishedItem = applyAssessmentItemSuggestion(currentItem, suggestion, { source: suggestion.repairAttempted ? 'repair' : 'generated' })
        working = replaceItem(working, finishedItem)
        working = await saveAssessmentDocument(working, isDemo)
        setWorkingRecord(working)
        completedQuestions += 1
        setGeneration({ stage: 'questions', current: completedQuestions, total: working.items.length, message: `Question ${completedQuestions} of ${working.items.length} saved.` })
        if (suggestion.quotaPaused) throw new Error('Generation paused after saving the current question because the active AI capacity was exhausted. Retry to continue from the saved checkpoint.')
      }

      const visualIds = working.items.filter((item) => item.visualRequirement === 'required').map((item) => item.id)
      if (visualIds.length) {
        setGeneration({ stage: 'visuals', current: 0, total: visualIds.length, message: 'Creating and verifying planned diagrams…' })
        const visualSummary = await enrichAssessmentVisualsSequentially({
          assessment: working,
          demo: isDemo,
          itemIds: visualIds,
          signal: controller.signal,
          onItem: async (item) => {
            working = replaceItem(working!, item)
            working = await saveAssessmentItemVisualCheckpoint(working, item, isDemo)
            setWorkingRecord(working)
          },
          onProgress: (progress) => setGeneration({ stage: 'visuals', current: progress.processed, total: progress.total, message: progress.status === 'success' ? `Diagram ${progress.processed} of ${progress.total} verified and saved.` : `Diagram ${progress.processed} of ${progress.total} needs review.` }),
        })
        if (visualSummary.providerPaused) throw new Error('Generation paused after saving completed diagrams because provider capacity was exhausted. Retry to continue from the saved checkpoint.')
      }

      setGeneration({ stage: 'finishing', current: 1, total: 1, message: 'Preparing the completed assessment for teacher review…' })
      const finalSaved = await saveAssessmentDocument(working, isDemo)
      setWorkingRecord(finalSaved)
      navigate(`/assessments/${finalSaved.id}?generated=v2`)
    } catch (nextError) {
      if (controller.signal.aborted || (nextError instanceof DOMException && nextError.name === 'AbortError')) {
        setGeneration({ stage: 'paused', current: 0, total: 1, message: 'Generation stopped. Completed work remains saved.' })
        return
      }
      const message = extractErrorMessage(nextError, 'Assessment generation paused. Completed work remains saved.')
      setError(message)
      setGeneration({ stage: 'paused', current: 0, total: 1, message })
    }
  }

  function cancelGeneration() {
    controllerRef.current?.abort()
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Loading finalized TOS documents…</strong></div>
  if (error && !tosDocuments.length) return <EmptyState icon={ClipboardCheck} title="Assessment setup unavailable" description={error}><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Back to assessments</Link></EmptyState>
  if (!tosDocuments.length) return <>
    <PageHeader eyebrow="Assessment studio" title="New assessment" description="Assessment generation starts from a finalized Table of Specifications." actions={<Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link>} />
    <EmptyState icon={ShieldCheck} title="Finalize a TOS first" description="There are no finalized TOS documents available. Draft TOS documents are intentionally not selectable as assessment sources."><Link className="button primary" to="/tos"><ShieldCheck size={16} /> Open TOS Builder</Link></EmptyState>
  </>

  if (generation) {
    const stageFraction = generation.total > 0 ? Math.max(0, Math.min(1, generation.current / generation.total)) : 0
    const pct = generation.stage === 'planning' ? Math.max(4, Math.round(stageFraction * 10))
      : generation.stage === 'questions' ? Math.round(10 + stageFraction * 65)
        : generation.stage === 'visuals' ? Math.round(75 + stageFraction * 20)
          : generation.stage === 'finishing' ? 99
            : workingRecord ? Math.max(10, Math.round(((workingRecord.items.filter((item) => item.prompt.trim()).length) / Math.max(1, workingRecord.items.length)) * 65 + 10)) : 4
    return <main className="assessment-generation-focus" aria-live="polite">
      <div className="assessment-generation-card">
        <span className="assessment-generation-icon"><Sparkles size={28} /></span>
        <small>Assessment Generation V2</small>
        <h1>{generation.stage === 'paused' ? 'Generation paused' : 'Creating your assessment'}</h1>
        <p>{generation.message}</p>
        <div className="assessment-generation-progress" aria-label="Generation progress"><span style={{ width: `${pct}%` }} /></div>
        {generation.stage !== 'planning' && generation.stage !== 'finishing' && generation.stage !== 'paused' && <strong>{generation.current} / {generation.total}</strong>}
        {error && <div className="form-message error" role="alert">{error}</div>}
        <div className="assessment-generation-actions">
          {generation.stage === 'paused'
            ? <><button className="button primary" type="button" onClick={() => void generateAssessment(workingRecord ?? undefined)}><Sparkles size={16} /> Retry remaining</button><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Exit</Link></>
            : <button className="button ghost" type="button" onClick={cancelGeneration}><PauseCircle size={16} /> Stop safely</button>}
        </div>
        <small>Question previews stay hidden until generation finishes. Completed questions and diagrams are checkpointed before the next stage continues.</small>
      </div>
    </main>
  }

  return <>
    <PageHeader eyebrow="Assessment Generation V2" title="Create assessment" description="Set the point total and allowed formats first. GuroDesk checks cognitive coverage, designs one master plan, then generates the complete paper before showing question previews." actions={<Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link>} />
    <div className="assessment-v2-setup">
      <section className="panel assessment-v2-source">
        <div className="assessment-section-heading"><span>1</span><div><h2>Assessment source</h2><p>Choose one finalized TOS.</p></div></div>
        <div className="assessment-source-list" role="listbox" aria-label="Finalized TOS documents">
          {tosDocuments.map((document) => {
            const chosen = selectedId === document.id
            return <button key={document.id} type="button" role="option" aria-selected={chosen} className={`assessment-source-option ${chosen ? 'selected' : ''}`} onClick={() => { setSelectedId(document.id); setPointsTouched(false) }}>
              <span className="assessment-source-option-icon">{chosen ? <Check size={17} /> : <FileCheck2 size={17} />}</span>
              <span><strong>{document.title || 'Untitled TOS'}</strong><small>{[document.content.gradeLevel, document.content.learningArea, document.content.schoolYear].filter(Boolean).join(' · ')}</small><small>{document.content.rows.length} competencies · finalized TOS</small></span>
            </button>
          })}
        </div>
      </section>

      <section className="panel assessment-v2-config">
        <div className="assessment-section-heading"><span>2</span><div><h2>Set assessment requirements</h2><p>Total points are the assessment size. Logical question count is planned automatically.</p></div></div>
        <div className="assessment-v2-fields">
          <label>Total points<input type="number" min="1" max="1000" step="1" value={totalPoints} onChange={(event) => { setPointsTouched(true); setTotalPoints(Number(event.target.value)) }} /></label>
          <label>Visual policy<select value={visualPolicy} onChange={(event) => setVisualPolicy(event.target.value as AssessmentVisualPolicy)}><option value="off">Off</option><option value="balanced">Balanced · default</option><option value="more_visuals">More visuals</option></select></label>
          <label className="assessment-v2-wide">Assessment title <small>(optional)</small><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selected?.content.assessmentTitle || 'e.g. First summative assessment'} /></label>
          <label className="assessment-v2-wide">Directions for learners <small>(optional)</small><textarea rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Instructions shown on the assessment" /></label>
          <label className="assessment-v2-wide">Planning guidance <small>(optional)</small><textarea rows={3} value={generationInstructions} onChange={(event) => setGenerationInstructions(event.target.value)} placeholder="e.g. Prefer concise real-world applications; avoid trick questions." /></label>
        </div>

        <div className="assessment-v2-type-heading"><div><strong>Allowed question types · classified by CPD</strong><small>Strong CPDs are the formats GuroDesk may rely on for that cognitive demand. Evaluating and Creating require a strong higher-order format.</small></div><button className="button ghost compact" type="button" onClick={() => setAllowedTypes(DEFAULT_TYPES)}>Select all</button></div>
        <div className="assessment-v2-types">{ASSESSMENT_QUESTION_TYPES.map((type) => {
          const area = selected?.content.learningArea ?? ''
          const strong = CPD_ORDER.filter((cpd) => cpd !== 'other' && questionTypeSuitability(type, cpd, area) === 'strong')
          const allowed = CPD_ORDER.filter((cpd) => cpd !== 'other' && questionTypeSuitability(type, cpd, area) === 'allowed')
          return <label key={type} className={allowedTypes.includes(type) ? 'selected' : ''}>
            <input type="checkbox" checked={allowedTypes.includes(type)} onChange={() => toggleType(type)} />
            <span className="assessment-v2-type-name">{allowedTypes.includes(type) ? <Check size={14} /> : <X size={14} />}{typeLabel(type)}</span>
            <small><b>Strong:</b> {strong.length ? strong.map((cpd) => CPD_LABELS[cpd]).join(', ') : '—'}</small>
            {allowed.length > 0 && <small><b>Also usable:</b> {allowed.map((cpd) => CPD_LABELS[cpd]).join(', ')}</small>}
          </label>
        })}</div>
      </section>

      <section className="panel assessment-v2-coverage">
        <div className="assessment-section-heading"><span>3</span><div><h2>Coverage check</h2><p>Every positive Cognitive Process Dimension allocation in the TOS must be feasible with the selected formats.</p></div></div>
        {cpdSummary.length ? <div className="assessment-v2-cpd-grid">{cpdSummary.map((entry) => <div key={entry.key}><span className="status-dot ready" /><strong>{entry.label}</strong><small>{entry.points} pts</small></div>)}</div> : <p className="muted">Select a finalized TOS to calculate its point blueprint.</p>}
        {setupValidation.errors.map((issue) => <div className="form-message error" key={issue.key}>{issue.message}</div>)}
        {setupValidation.warnings.map((issue) => <div className="form-message" key={issue.key}>{issue.message}</div>)}
        {!setupValidation.errors.length && <div className="assessment-v2-ready"><ShieldCheck size={18} /><div><strong>Ready to plan</strong><small>{totalPoints} points will be allocated deterministically across the TOS before Gemini designs the logical questions.</small></div></div>}
        {error && <div className="form-message error" role="alert">{error}</div>}
        <div className="assessment-v2-actions"><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Cancel</Link><button className="button primary" type="button" disabled={!selected || !setupValidation.ready} onClick={() => void generateAssessment()}><Sparkles size={17} /> Generate assessment</button></div>
      </section>
    </div>
  </>
}
