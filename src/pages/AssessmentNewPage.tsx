import { ArrowLeft, ArrowRight, Check, ClipboardCheck, FileCheck2, PauseCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import { applyAssessmentItemSuggestion, enrichAssessmentVisualsSequentially, generateAssessmentItemSuggestion } from '../lib/assessmentGeneration'
import { createAssessmentMasterPlan } from '../lib/assessmentMasterPlanner'
import { minimumAssessmentV2Points, validateAssessmentV2Setup, type AssessmentV2Setup } from '../lib/assessmentGenerationV2'
import { createAssessmentFromMasterPlan, saveAssessmentDocument, saveAssessmentItemVisualCheckpoint } from '../lib/assessmentRepository'
import { loadTosDocuments } from '../lib/tosRepository'
import { ASSESSMENT_QUESTION_TYPES, type AssessmentCpdKey, type AssessmentRecord, type AssessmentVisualPolicy, type QuestionType } from '../types/assessment'
import type { TosRecord } from '../types/tos'
import { extractErrorMessage, typeLabel } from './assessmentUi'

const DEFAULT_TYPES: QuestionType[] = [...ASSESSMENT_QUESTION_TYPES]
const CPD_ORDER: AssessmentCpdKey[] = ['remembering', 'understanding', 'applying', 'analyzing', 'evaluating', 'creating', 'other']
const CPD_LABELS: Record<AssessmentCpdKey, string> = { remembering: 'Remembering', understanding: 'Understanding', applying: 'Applying', analyzing: 'Analyzing', evaluating: 'Evaluating', creating: 'Creating', other: 'Other' }

type SetupStep = 1 | 2 | 3
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
  const [step, setStep] = useState<SetupStep>(1)
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

  const visualPolicyLabel = visualPolicy === 'off' ? 'No automatic visuals' : visualPolicy === 'more_visuals' ? 'More visuals' : 'Balanced visuals'
  const pointsReady = Number.isSafeInteger(totalPoints) && totalPoints >= 1 && totalPoints <= 1000

  return <>
    <PageHeader eyebrow="Assessment Generation V2" title="Create assessment" description="Set up the assessment in three short steps. GuroDesk keeps the TOS and cognitive coverage rules in the background, then generates the complete paper before showing question previews." actions={<Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link>} />

    <div className="assessment-v2-wizard-shell">
      <div className="assessment-v2-stepper" aria-label="Assessment setup progress">
        {([
          [1, 'Source'],
          [2, 'Setup'],
          [3, 'Formats'],
        ] as const).map(([number, label]) => <div key={number} className={`assessment-v2-step ${step === number ? 'active' : step > number ? 'done' : ''}`}>
          <span>{step > number ? <Check size={14} /> : number}</span>
          <strong>{label}</strong>
        </div>)}
      </div>

      {step === 1 && <section className="panel assessment-v2-wizard-card">
        <header className="assessment-v2-wizard-heading">
          <span className="assessment-v2-wizard-number">1</span>
          <div><h2>Choose assessment source</h2><p>Select the finalized TOS this assessment should follow.</p></div>
        </header>

        <div className="assessment-v2-source-list" role="listbox" aria-label="Finalized TOS documents">
          {tosDocuments.map((document) => {
            const chosen = selectedId === document.id
            return <button key={document.id} type="button" role="option" aria-selected={chosen} className={`assessment-v2-source-card ${chosen ? 'selected' : ''}`} onClick={() => { setSelectedId(document.id); setPointsTouched(false) }}>
              <span className="assessment-v2-source-icon">{chosen ? <Check size={18} /> : <FileCheck2 size={18} />}</span>
              <span className="assessment-v2-source-copy">
                <strong>{document.title || 'Untitled TOS'}</strong>
                <small>{[document.content.gradeLevel, document.content.learningArea, document.content.schoolYear].filter(Boolean).join(' · ')}</small>
                <small>{document.content.rows.length} competencies</small>
              </span>
              {chosen && <span className="assessment-v2-selected-pill">Selected</span>}
            </button>
          })}
        </div>

        <footer className="assessment-v2-wizard-footer">
          <Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Cancel</Link>
          <button className="button primary" type="button" disabled={!selected} onClick={() => setStep(2)}>Continue <ArrowRight size={16} /></button>
        </footer>
      </section>}

      {step === 2 && <section className="panel assessment-v2-wizard-card">
        <header className="assessment-v2-wizard-heading">
          <span className="assessment-v2-wizard-number">2</span>
          <div><h2>Assessment setup</h2><p>Total points are the assessment size. GuroDesk plans the logical question count automatically.</p></div>
        </header>

        <div className="assessment-v2-primary-fields">
          <label className="assessment-v2-points-field">
            <span>Total points</span>
            <input type="number" inputMode="numeric" min="1" max="1000" step="1" value={totalPoints} onChange={(event) => { setPointsTouched(true); setTotalPoints(Number(event.target.value)) }} />
            <small>Multi-point questions use ranges automatically, such as 16–20.</small>
          </label>

          <label>
            <span>Assessment title <small>(optional)</small></span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selected?.content.assessmentTitle || 'e.g. First summative assessment'} />
          </label>

          <label>
            <span>Directions for learners <small>(optional)</small></span>
            <textarea rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Instructions shown on the assessment" />
          </label>
        </div>

        <div className="assessment-v2-visual-section">
          <div><strong>Visuals</strong><small>Choose how often diagrams may be planned when they genuinely help the question.</small></div>
          <div className="assessment-v2-segmented" role="group" aria-label="Visual policy">
            {([
              ['off', 'Off', 'Text-first'],
              ['balanced', 'Balanced', 'Recommended'],
              ['more_visuals', 'More', 'When useful'],
            ] as const).map(([value, label, hint]) => <button key={value} type="button" className={visualPolicy === value ? 'selected' : ''} aria-pressed={visualPolicy === value} onClick={() => setVisualPolicy(value)}><strong>{label}</strong><small>{hint}</small></button>)}
          </div>
        </div>

        <details className="assessment-v2-advanced">
          <summary>Advanced planning options</summary>
          <label>
            <span>Planning guidance <small>(optional)</small></span>
            <textarea rows={3} value={generationInstructions} onChange={(event) => setGenerationInstructions(event.target.value)} placeholder="e.g. Prefer concise real-world applications; avoid trick questions." />
          </label>
        </details>

        <footer className="assessment-v2-wizard-footer">
          <button className="button ghost" type="button" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button>
          <button className="button primary" type="button" disabled={!pointsReady} onClick={() => setStep(3)}>Continue <ArrowRight size={16} /></button>
        </footer>
      </section>}

      {step === 3 && <section className="panel assessment-v2-wizard-card assessment-v2-formats-card">
        <header className="assessment-v2-wizard-heading assessment-v2-formats-heading">
          <span className="assessment-v2-wizard-number">3</span>
          <div><h2>Choose question formats</h2><p>Select the formats GuroDesk may use. Cognitive coverage is checked automatically.</p></div>
          <div className="assessment-v2-format-actions"><span>{allowedTypes.length} selected</span><button type="button" className="button ghost compact" onClick={() => setAllowedTypes(DEFAULT_TYPES)}>Select all</button><button type="button" className="button ghost compact" onClick={() => setAllowedTypes([])}>Clear</button></div>
        </header>

        <div className="assessment-v2-format-grid">
          {ASSESSMENT_QUESTION_TYPES.map((type) => {
            const selectedType = allowedTypes.includes(type)
            return <label key={type} className={`assessment-v2-format-chip ${selectedType ? 'selected' : ''}`}>
              <input type="checkbox" checked={selectedType} onChange={() => toggleType(type)} />
              <span className="assessment-v2-format-check">{selectedType && <Check size={14} />}</span>
              <strong>{typeLabel(type)}</strong>
            </label>
          })}
        </div>

        <div className={`assessment-v2-coverage-compact ${setupValidation.ready ? 'ready' : 'needs-attention'}`}>
          <div className="assessment-v2-coverage-title"><ShieldCheck size={19} /><div><strong>{setupValidation.ready ? 'All required cognitive levels are covered' : 'Coverage needs attention'}</strong><small>{setupValidation.ready ? 'Your selected formats can assess every cognitive level required by this TOS.' : 'Adjust the selected formats or point total before generating.'}</small></div></div>
          {cpdSummary.length > 0 && <div className="assessment-v2-coverage-chips">{cpdSummary.map((entry) => <span key={entry.key}><Check size={12} /> {entry.label}<b>{entry.points}</b></span>)}</div>}
          {setupValidation.errors.map((issue) => <div className="form-message error" key={issue.key}>{issue.message}</div>)}
          {setupValidation.warnings.map((issue) => <div className="form-message" key={issue.key}>{issue.message}</div>)}
        </div>

        <div className="assessment-v2-ready-summary">
          <div><small>Source</small><strong>{selected?.title || 'Finalized TOS'}</strong></div>
          <div><small>Total</small><strong>{totalPoints} points</strong></div>
          <div><small>Formats</small><strong>{allowedTypes.length} selected</strong></div>
          <div><small>Visual policy</small><strong>{visualPolicyLabel}</strong></div>
        </div>

        {error && <div className="form-message error" role="alert">{error}</div>}

        <footer className="assessment-v2-wizard-footer assessment-v2-generate-footer">
          <button className="button ghost" type="button" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button>
          <button className="button primary assessment-v2-generate-button" type="button" disabled={!selected || !setupValidation.ready} onClick={() => void generateAssessment()}><Sparkles size={17} /> Generate assessment</button>
        </footer>
      </section>}
    </div>
  </>

}
