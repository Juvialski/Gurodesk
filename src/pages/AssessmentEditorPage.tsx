import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Copy,
  FileDown,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import * as assessmentValidation from '../lib/assessmentValidation'
import { generateAssessmentItemSuggestion, generateMissingAssessmentItems } from '../lib/assessmentGeneration'
import { duplicateAssessmentDocument, loadAssessmentDocument, saveAssessmentDocument } from '../lib/assessmentRepository'
import type {
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentChoice,
  AssessmentItem,
  AssessmentRecord,
  QuestionType,
} from '../types/assessment'
import {
  answerForType,
  assessmentCompletion,
  cloneItem,
  mappingDetails,
  mappingLabel,
  normalizeAssessment,
  recordWithItems,
  stateLabel,
} from './assessmentUi'

type ValidationSummary = { ready: boolean; errors: string[]; warnings: string[] }
type SuggestionMap = Record<string, AssessmentItem>

const TYPE_OPTIONS: Array<{ value: QuestionType; label: string; hint: string }> = [
  { value: 'multiple_choice', label: 'Multiple choice', hint: 'Choose one option' },
  { value: 'true_false', label: 'True / False', hint: 'Binary response' },
  { value: 'short_answer', label: 'Short answer', hint: 'Accepted answers' },
  { value: 'constructed_response', label: 'Constructed response', hint: 'Expected response + rubric' },
]

function text(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function valueAt(value: unknown, ...keys: string[]) {
  const record = object(value)
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key]
  return undefined
}

function answerForCandidate(item: AssessmentItem, candidate: Record<string, unknown>): AssessmentAnswer {
  const sourceAnswer = valueAt(candidate, 'answer')
  if (sourceAnswer && typeof sourceAnswer === 'object' && (sourceAnswer as { type?: unknown }).type === item.questionType) {
    return structuredClone(sourceAnswer) as AssessmentAnswer
  }
  if (item.questionType === 'multiple_choice') {
    const choices = valueAt(candidate, 'choices', 'options')
    const choiceId = text(valueAt(candidate, 'choiceId', 'correctChoiceId', 'correctAnswer', 'correct_answer'))
    return {
      type: 'multiple_choice',
      choices: Array.isArray(choices) ? choices.map((choice, index) => {
        if (typeof choice === 'string') return { id: String.fromCharCode(65 + index), text: choice }
        const record = object(choice)
        return { id: text(valueAt(record, 'id', 'key', 'label')) || String.fromCharCode(65 + index), text: text(valueAt(record, 'text', 'label', 'value')) }
      }) : item.answer.type === 'multiple_choice' ? item.answer.choices.map((choice) => ({ ...choice })) : [],
      choiceId,
    }
  }
  if (item.questionType === 'true_false') {
    const answer = valueAt(candidate, 'value', 'trueFalseAnswer', 'true_false_answer', 'correctAnswer', 'answer')
    return { type: 'true_false', value: typeof answer === 'boolean' ? answer : text(answer).toLowerCase() === 'true' }
  }
  if (item.questionType === 'short_answer') {
    const accepted = valueAt(candidate, 'acceptedAnswers', 'accepted_answers', 'acceptedAnswer')
    return { type: 'short_answer', acceptedAnswers: Array.isArray(accepted) ? accepted.map(text).filter(Boolean) : text(accepted).split(/\r?\n|;/).map((value) => value.trim()).filter(Boolean), caseSensitive: false }
  }
  return {
    type: 'constructed_response',
    expectedResponse: text(valueAt(candidate, 'expectedResponse', 'expected_response', 'modelAnswer', 'model_answer')),
    sampleResponse: text(valueAt(candidate, 'sampleResponse', 'sample_response')),
    rubricGuidance: text(valueAt(candidate, 'rubricGuidance', 'rubric', 'scoringRubric', 'scoring_rubric')),
  }
}

function candidateItem(current: AssessmentItem, value: unknown): AssessmentItem {
  const candidate = object(value)
  // The AI may propose editable question fields, but question type remains a
  // teacher-controlled choice and is never relabeled from a suggestion.
  const safeType = current.questionType
  const base = cloneItem(current)
  const item = {
    ...base,
    prompt: text(valueAt(candidate, 'prompt', 'question', 'stem')) || current.prompt,
    answer: answerForCandidate(base, candidate),
    rationale: text(valueAt(candidate, 'rationale', 'explanation', 'answerRationale')) || current.rationale,
    teacherNotes: text(valueAt(candidate, 'teacherNotes', 'teacher_notes')) || current.teacherNotes,
    points: valueAt(candidate, 'points', 'pointValue', 'point_value') === undefined ? current.points : number(valueAt(candidate, 'points', 'pointValue', 'point_value'), 1),
    authorshipState: 'ai_suggestion' as const,
  }
  return item
}

function unwrapCandidate(value: unknown): unknown {
  const nested = valueAt(value, 'candidate', 'suggestion', 'generatedItem', 'item')
  return nested && typeof nested === 'object' ? nested : value
}

function resultItemId(value: unknown) {
  return text(valueAt(value, 'itemId', 'item_id', 'assessmentItemId', 'assessment_item_id', 'id'))
    || text(valueAt(valueAt(value, 'candidate', 'suggestion', 'generatedItem', 'item'), 'itemId', 'item_id', 'id'))
}

function localValidation(record: AssessmentRecord): ValidationSummary {
  const errors: string[] = []
  const warnings: string[] = []
  if (!record.title.trim()) errors.push('Add an assessment title before finalizing.')
  if (!record.items.length) errors.push('Add at least one assessment item before finalizing.')
  record.items.forEach((item) => {
    const label = `Item ${item.itemNumber}`
    if (!item.prompt.trim()) errors.push(`${label}: add a question.`)
    if (!Number.isFinite(item.points) || (item.points ?? 0) <= 0) errors.push(`${label}: points must be greater than zero.`)
    const answer = item.answer
    if (answer.type === 'multiple_choice') {
      if (answer.choices.length < 2 || answer.choices.some((choice) => !choice.text.trim())) errors.push(`${label}: add at least two complete choices.`)
      if (!answer.choiceId || !answer.choices.some((choice) => choice.id === answer.choiceId)) errors.push(`${label}: choose a correct answer.`)
    }
    if (item.answer.type === 'true_false' && typeof item.answer.value !== 'boolean') errors.push(`${label}: choose True or False.`)
    if (item.answer.type === 'short_answer' && !item.answer.acceptedAnswers.some((answer) => answer.trim())) errors.push(`${label}: add at least one accepted answer.`)
    if (item.answer.type === 'constructed_response') {
      if (!item.answer.expectedResponse.trim()) errors.push(`${label}: add an expected response.`)
      if (!item.answer.sampleResponse.trim()) warnings.push(`${label}: sample response is still blank.`)
      if (!item.answer.rubricGuidance?.trim()) warnings.push(`${label}: rubric guidance is still blank.`)
    }
  })
  return { ready: errors.length === 0, errors, warnings }
}

function apiValidation(record: AssessmentRecord): ValidationSummary {
  const local = localValidation(record)
  const api = assessmentValidation as unknown as Record<string, unknown>
  const validator = api.validateAssessment
  if (typeof validator !== 'function') return local
  try {
    const result = object((validator as (assessment: AssessmentRecord, mode: 'final') => unknown)({ ...record, status: 'final' }, 'final'))
    const errors = Array.isArray(result.errors) ? result.errors.map((issue) => text(object(issue).message || issue)).filter(Boolean) : local.errors
    const warnings = Array.isArray(result.warnings) ? result.warnings.map((issue) => text(object(issue).message || issue)).filter(Boolean) : local.warnings
    return { ready: errors.length === 0 && warnings.length === 0 && result.ready !== false, errors, warnings }
  } catch {
    return local
  }
}

export function AssessmentEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, isDemo } = useApp()
  const [record, setRecord] = useState<AssessmentRecord | null>(null)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiWorking, setAiWorking] = useState('')
  const [batchWorking, setBatchWorking] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 })
  const [batchMessage, setBatchMessage] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestionMap>({})
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [validation, setValidation] = useState<ValidationSummary | null>(null)
  const [validationOpen, setValidationOpen] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const batchControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!user || !id) return
    let active = true
    setLoading(true)
    void loadAssessmentDocument(id, user.id, isDemo)
      .then((nextRecord) => {
        if (!active) return
        if (!nextRecord) throw new Error('Assessment not found or you do not have access to it.')
        const normalized = normalizeAssessment(nextRecord)
        setRecord(normalized)
        setTitle(normalized.title === 'Untitled assessment' ? '' : normalized.title)
        setInstructions(normalized.instructions)
        setSelectedIndex(0)
        setSuggestions({})
        setError('')
      })
      .catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to open the assessment editor.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, user?.id, isDemo])

  const view = record ? normalizeAssessment(record) : null
  const current = view?.items[selectedIndex] ?? null
  const readOnly = view ? view.status !== 'draft' : false
  const completion = record ? assessmentCompletion(record) : { filled: 0, total: 0, percent: 0 }

  useEffect(() => {
    if (view && selectedIndex >= view.items.length) setSelectedIndex(Math.max(0, view.items.length - 1))
  }, [selectedIndex, view?.items.length])

  useEffect(() => () => {
    controllerRef.current?.abort()
    batchControllerRef.current?.abort()
  }, [])

  function replaceItems(nextItems: AssessmentItem[]) {
    if (!record || !view || readOnly) return
    setRecord(recordWithItems(record, nextItems, view.status, title, instructions))
    setSavedMessage('')
  }

  // Generation is validated against the persisted item mapping and question
  // type. Save the current draft first so a teacher's just-made edits cannot
  // make the server reject an otherwise valid suggestion request.
  async function saveForGeneration(): Promise<AssessmentRecord | null> {
    if (!record || !view || readOnly) return null
    const nextRecord = recordWithItems(record, view.items, 'draft', title.trim(), instructions)
    setSaving(true)
    setError('')
    try {
      const saved = await saveAssessmentDocument(nextRecord, isDemo)
      setRecord(saved)
      setTitle(saved.title)
      setInstructions(saved.instructions)
      setSavedMessage('Draft saved before generation.')
      return saved
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save the draft before generation.')
      return null
    } finally {
      setSaving(false)
    }
  }

  function updateItem(index: number, updater: (item: AssessmentItem) => AssessmentItem) {
    if (!record || !view || readOnly) return
    const item = view.items[index]
    if (!item) return
    const next = updater(cloneItem(item))
    if (!next.prompt.trim()) next.authorshipState = 'empty'
    else if (item.authorshipState === 'ai_suggestion' || item.authorshipState === 'teacher_accepted' || item.authorshipState === 'teacher_edited') next.authorshipState = 'teacher_edited'
    else next.authorshipState = 'manual'
    replaceItems(view.items.map((currentItem, itemIndex) => itemIndex === index ? next : currentItem))
  }

  function selectIndex(index: number) {
    if (!view || index < 0 || index >= view.items.length) return
    setSelectedIndex(index)
    window.requestAnimationFrame(() => document.getElementById(`assessment-item-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function save(status: 'draft' | 'final' = 'draft') {
    if (!record || !view || readOnly) return
    const nextRecord = recordWithItems(record, view.items, status, title.trim(), instructions)
    if (status === 'final') {
      const summary = apiValidation(nextRecord)
      setValidation(summary)
      setValidationOpen(true)
      if (!summary.ready) {
        setError('Resolve the validation issues before finalizing this assessment.')
        return
      }
    }
    setSaving(true)
    setError('')
    try {
      const saved = await saveAssessmentDocument(nextRecord, isDemo)
      setRecord(saved)
      setTitle(saved.title)
      setInstructions(saved.instructions)
      setSavedMessage(status === 'final' ? 'Assessment finalized and locked.' : 'Draft saved.')
      if (status === 'final') setValidation(apiValidation(saved))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save this assessment.')
    } finally {
      setSaving(false)
    }
  }

  async function duplicate() {
    if (!record) return
    setSaving(true)
    try {
      const created = await duplicateAssessmentDocument(record, isDemo)
      navigate(`/assessments/${created.id}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to duplicate this assessment.')
    } finally {
      setSaving(false)
    }
  }

  async function generateItem(index: number, alternative = false) {
    if (!record || !view || readOnly) return
    const currentItem = view.items[index]
    if (!currentItem || aiWorking || saving || batchWorking) return
    setAiWorking(currentItem.id)
    setError('')
    let controller: AbortController | null = null
    try {
      const persisted = await saveForGeneration()
      if (!persisted) return
      const persistedView = normalizeAssessment(persisted)
      const item = persistedView.items[index]
      if (!item) return
      controllerRef.current?.abort()
      controller = new AbortController()
      controllerRef.current = controller
      const response = await generateAssessmentItemSuggestion({ assessment: persisted, item, demo: isDemo, alternative, teacherContext: persisted.instructions, signal: controller.signal })
      setSuggestions((currentSuggestions) => ({ ...currentSuggestions, [item.id]: candidateItem(item, unwrapCandidate(response)) }))
    } catch (nextError) {
      if (!controller?.signal.aborted) setError(nextError instanceof Error ? nextError.message : 'Unable to generate an item suggestion.')
    } finally {
      if (controller && controllerRef.current === controller) controllerRef.current = null
      setAiWorking('')
    }
  }

  function acceptSuggestion(index: number) {
    if (!record || !view || readOnly) return
    const item = view.items[index]
    const suggestion = suggestions[item.id]
    if (!suggestion) return
    const accepted = { ...cloneItem(suggestion), authorshipState: 'teacher_accepted' as const }
    replaceItems(view.items.map((currentItem, itemIndex) => itemIndex === index ? accepted : currentItem))
    setSuggestions((currentSuggestions) => { const next = { ...currentSuggestions }; delete next[item.id]; return next })
    setSavedMessage('Suggestion accepted. Save the draft when you are ready.')
  }

  async function generateMissing() {
    if (!record || !view || readOnly || saving || batchWorking || aiWorking) return
    setBatchWorking(true)
    setBatchMessage('')
    setError('')
    let controller: AbortController | null = null
    try {
      const persisted = await saveForGeneration()
      if (!persisted) return
      const persistedView = normalizeAssessment(persisted)
      const missingItems = persistedView.items.filter((item) => !item.prompt.trim() && !suggestions[item.id])
      if (!missingItems.length) {
        setBatchMessage('All empty items already have a suggestion preview. Review and accept them before generating again.')
        return
      }
      controller = new AbortController()
      batchControllerRef.current?.abort()
      batchControllerRef.current = controller
      setBatchProgress({ completed: 0, total: missingItems.length })
      const runMissing = generateMissingAssessmentItems as unknown as (options: Record<string, unknown>) => Promise<unknown>
      // The current bounded workflow skips any item with existing content. Keep
      // previews out of persisted state, but pass them as temporary content so
      // a second batch run cannot regenerate the same preview.
      const assessmentForBatch: AssessmentRecord = {
        ...persisted,
        items: persisted.items.map((item) => {
          const suggestion = suggestions[item.id]
          return suggestion ? { ...item, prompt: suggestion.prompt, answer: suggestion.answer, authorshipState: 'ai_suggestion' as const } : item
        }),
      }
      const response = await runMissing({
        assessment: assessmentForBatch,
        demo: isDemo,
        itemIds: missingItems.map((item) => item.id),
        concurrency: 2,
        signal: controller.signal,
        onProgress: (progress: unknown) => {
          if (typeof progress === 'number') setBatchProgress((currentProgress) => ({ ...currentProgress, completed: Math.min(currentProgress.total, progress) }))
          else {
            const value = object(progress)
            const status = text(value.status)
            if (status === 'success' || status === 'failed' || status === 'cancelled') setBatchProgress((currentProgress) => ({ ...currentProgress, completed: Math.min(currentProgress.total, currentProgress.completed + 1) }))
          }
        },
        onItem: (value: unknown) => {
          const itemId = resultItemId(value)
          const target = (missingItems.find((item) => item.id === itemId) ?? missingItems.find((item) => !suggestions[item.id]))
          if (!target) return
          setSuggestions((currentSuggestions) => ({ ...currentSuggestions, [target.id]: candidateItem(target, unwrapCandidate(value)) }))
        },
      })
      const summary = object(response)
      const successCount = number(summary.succeeded ?? summary.successes ?? summary.completed, batchProgress.completed)
      const failures = Array.isArray(summary.errors) ? summary.errors.length : number(summary.failed, 0)
      setBatchMessage(`${successCount} suggestion${successCount === 1 ? '' : 's'} ready for review${failures ? ` · ${failures} failed` : ''}.`)
    } catch (nextError) {
      if (controller?.signal.aborted) setBatchMessage('Batch generation cancelled. Suggestions already received remain available for review.')
      else setError(nextError instanceof Error ? nextError.message : 'Unable to generate missing items.')
    } finally {
      if (controller && batchControllerRef.current === controller) batchControllerRef.current = null
      setBatchWorking(false)
    }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Opening assessment editor…</strong></div>
  if (error && !record) return <EmptyState icon={CircleAlert} title="Assessment unavailable" description={error}><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Back to assessments</Link></EmptyState>
  if (!record || !view) return null
  if (!view.items.length) return <EmptyState icon={ClipboardCheck} title="Assessment has no items" description="The source TOS did not provide any assessment items. Recreate the assessment from a finalized TOS."><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Back to assessments</Link></EmptyState>

  return <>
    <PageHeader eyebrow="Assessment studio · Phase 4" title={view.status === 'draft' ? 'Assessment editor' : 'Final assessment'} description="Review every teacher-authored or AI-suggested item before saving. TOS item numbers and competency mappings are immutable." actions={<div className="assessment-header-actions"><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link><Link className="button ghost" to={`/assessments/${view.id}/print`}><FileDown size={16} /> Export</Link></div>} />
    {view.status !== 'draft' && <div className="assessment-locked panel"><ShieldCheck size={18} /><div><strong>{view.status === 'final' ? 'This assessment is finalized and locked.' : 'This assessment is archived.'}</strong><p>{view.status === 'final' ? 'Duplicate it to create an editable draft.' : 'Archived assessments remain available for export.'}</p></div>{view.status === 'final' && <button className="button secondary" type="button" onClick={() => void duplicate()} disabled={saving}><Copy size={15} /> Duplicate</button>}</div>}
    {error && <div className="form-message error assessment-editor-message" role="alert">{error}</div>}
    {savedMessage && <div className="assessment-saved-message" role="status"><Check size={15} /> {savedMessage}</div>}

    <div className="assessment-editor-context panel"><div><small>Source TOS</small><strong>{view.sourceTosTitle}</strong><span>{[view.gradeLevel, view.learningArea, view.schoolYear].filter(Boolean).join(' · ')}</span></div><div className="assessment-editor-progress"><div><strong>{completion.filled}/{completion.total}</strong><span>items with question text</span></div><div className="assessment-progress"><span style={{ width: `${completion.percent}%` }} /></div></div>{!readOnly && <button className="button secondary assessment-batch-button" type="button" onClick={() => void generateMissing()} disabled={batchWorking || Boolean(aiWorking) || saving || !view.items.some((item) => !item.prompt.trim() && !suggestions[item.id])}><WandSparkles size={16} /> {batchWorking ? `Generating ${batchProgress.completed}/${batchProgress.total}` : 'Batch generate missing'}</button>}</div>
    <section className="panel assessment-details-panel" aria-labelledby="assessment-details-heading"><div className="assessment-details-heading"><div><small>Assessment details</small><strong id="assessment-details-heading">Title and learner directions</strong></div><span>{readOnly ? 'Locked after finalization' : 'Teacher-authored'}</span></div><div className="assessment-details-fields"><label>Assessment title<input disabled={readOnly} value={title} onChange={(event) => { setTitle(event.target.value); setSavedMessage('') }} placeholder="e.g. First summative test" /></label><label>Directions / instructions<textarea rows={3} disabled={readOnly} value={instructions} onChange={(event) => { setInstructions(event.target.value); setSavedMessage('') }} placeholder="Teacher-authored directions for learners" /></label></div></section>
    {batchWorking && <div className="assessment-batch-progress panel"><div><LoaderCircle size={17} className="spin" /><strong>Generating missing items</strong><span>{batchProgress.completed}/{batchProgress.total} complete · successes stay as separate suggestions</span></div><button className="button ghost" type="button" onClick={() => batchControllerRef.current?.abort()}><X size={15} /> Cancel</button></div>}
    {batchMessage && <div className="assessment-batch-message" role="status"><Sparkles size={15} /> {batchMessage}</div>}

    <div className="assessment-editor-layout"><aside className="assessment-item-navigator panel" aria-label="Assessment item navigator"><div className="assessment-navigator-heading"><div><small>Items</small><strong>{selectedIndex + 1} of {view.items.length}</strong></div><span>{completion.percent}% complete</span></div><nav className="assessment-item-buttons" aria-label="Choose assessment item">{view.items.map((item, index) => <button key={item.id} id={`assessment-item-${index}`} type="button" className={`assessment-item-button ${selectedIndex === index ? 'selected' : ''} state-${item.authorshipState}`} aria-current={selectedIndex === index ? 'step' : undefined} aria-label={`Item ${item.itemNumber}, ${stateLabel(item.authorshipState)}`} onClick={() => selectIndex(index)}><span>{item.itemNumber}</span><small>{stateLabel(item.authorshipState)}</small></button>)}</nav><div className="assessment-navigator-legend"><span className="state-dot empty" /> Empty <span className="state-dot suggestion" /> Suggestion <span className="state-dot accepted" /> Accepted</div></aside>
      <main className="assessment-editor-main"><section className="panel assessment-item-card"><div className="assessment-item-card-heading"><div><span className="assessment-item-number">{current?.itemNumber}</span><div><span className={`assessment-state-chip ${current?.authorshipState}`}>{current && stateLabel(current.authorshipState)}</span><h2>Question {current?.itemNumber}</h2></div></div><div className="assessment-item-nav-actions"><button className="icon-button" type="button" disabled={selectedIndex <= 0} onClick={() => selectIndex(selectedIndex - 1)} aria-label="Previous item"><ChevronLeft size={19} /></button><button className="icon-button" type="button" disabled={selectedIndex >= view.items.length - 1} onClick={() => selectIndex(selectedIndex + 1)} aria-label="Next item"><ChevronRight size={19} /></button></div></div>
        {current && <><div className="assessment-mapping-card"><div><small>Immutable TOS mapping</small><div className="assessment-mapping-badges"><span>{current.competencySnapshot.code || 'Competency'}</span><span>{current.cognitiveCategorySnapshot.shortLabel || current.cognitiveCategorySnapshot.label || 'Cognitive category'}</span></div><strong>{mappingLabel(current)}</strong><span>{mappingDetails(current)}</span></div><span className="assessment-mapping-lock"><ShieldCheck size={14} /> Locked</span></div><div className="assessment-type-picker" role="radiogroup" aria-label="Question type"><span className="assessment-field-label">Question type</span><div>{TYPE_OPTIONS.map((option) => <button key={option.value} type="button" role="radio" aria-checked={current.questionType === option.value} className={current.questionType === option.value ? 'selected' : ''} disabled={readOnly} onClick={() => updateItem(selectedIndex, (item) => ({ ...item, questionType: option.value, answer: option.value === item.questionType ? item.answer : answerForType(option.value) }))}><strong>{option.label}</strong><small>{option.hint}</small></button>)}</div></div><label className="assessment-question-field">Question / prompt<textarea rows={5} disabled={readOnly} value={current.prompt} onChange={(event) => updateItem(selectedIndex, (item) => ({ ...item, prompt: event.target.value }))} placeholder="Write the question learners should answer." /></label>{current.questionType === 'multiple_choice' && <MultipleChoiceEditor item={current} readOnly={readOnly} onChange={(updater) => updateItem(selectedIndex, updater)} />}{current.questionType === 'true_false' && <TrueFalseEditor item={current} readOnly={readOnly} onChange={(answer) => updateItem(selectedIndex, (item) => ({ ...item, answer: { type: 'true_false', value: answer } }))} />}{current.questionType === 'short_answer' && <ShortAnswerEditor item={current} readOnly={readOnly} onChange={(answers) => updateItem(selectedIndex, (item) => ({ ...item, answer: { type: 'short_answer', acceptedAnswers: answers, caseSensitive: item.answer.type === 'short_answer' ? item.answer.caseSensitive : false } }))} />}{current.questionType === 'constructed_response' && <ConstructedResponseEditor item={current} readOnly={readOnly} onChange={(answer) => updateItem(selectedIndex, (item) => ({ ...item, answer }))} />}{current.questionType !== 'constructed_response' && <CommonFields item={current} readOnly={readOnly} onChange={(updater) => updateItem(selectedIndex, updater)} />}{current.questionType === 'constructed_response' && <label className="assessment-question-field">Points<input type="number" min="0" step="1" disabled={readOnly} value={current.points ?? 1} onChange={(event) => updateItem(selectedIndex, (item) => ({ ...item, points: number(event.target.value, 0) }))} /></label>}<label className="assessment-question-field">Teacher notes <small>Private planning note; not shown in student preview.</small><textarea rows={3} disabled={readOnly} value={current.teacherNotes ?? ''} onChange={(event) => updateItem(selectedIndex, (item) => ({ ...item, teacherNotes: event.target.value }))} placeholder="Optional note for your review" /></label></>}
      {current?.questionType === 'constructed_response' && <label className="assessment-question-field assessment-constructed-rationale">Rationale / answer explanation<textarea rows={3} disabled={readOnly} value={current.rationale ?? ''} onChange={(event) => updateItem(selectedIndex, (item) => ({ ...item, rationale: event.target.value }))} placeholder="Optional teacher-facing rationale" /></label>}
      </section>
      {!readOnly && current && <section className="panel assessment-ai-card"><div className="assessment-ai-heading"><div><span className="eyebrow">Teacher-controlled assistance</span><h2>Review an item suggestion</h2><p>Suggestions are previews. They never replace accepted or manually edited content without your action.</p></div><Sparkles size={22} /></div><div className="assessment-ai-actions"><button className="button secondary" type="button" disabled={Boolean(aiWorking) || batchWorking || saving} onClick={() => void generateItem(selectedIndex, Boolean(current.prompt.trim()))}><WandSparkles size={15} /> {aiWorking === current.id ? 'Generating…' : current.prompt ? 'Generate alternative' : 'Generate item'}</button>{current.prompt && <button className="button ghost" type="button" disabled={Boolean(aiWorking) || batchWorking || saving} onClick={() => void generateItem(selectedIndex, true)}><RefreshCw size={15} /> Regenerate explicitly</button>}</div>{isDemo && <p className="assessment-demo-note"><Info size={14} /> Local demo suggestion · not Gemini. Signed-in workspaces use the configured generation service.</p>}{suggestions[current.id] && <SuggestionPreview suggestion={suggestions[current.id]} onAccept={() => acceptSuggestion(selectedIndex)} />}</section>}
      <div className="assessment-prev-next"><button className="button ghost" type="button" disabled={selectedIndex <= 0} onClick={() => selectIndex(selectedIndex - 1)}><ChevronLeft size={16} /> Previous</button><span>Item {current?.itemNumber} of {view.items.length}</span><button className="button ghost" type="button" disabled={selectedIndex >= view.items.length - 1} onClick={() => selectIndex(selectedIndex + 1)}>Next <ChevronRight size={16} /></button></div></main></div>

    {!readOnly && <div className="assessment-sticky-actions"><button className="button secondary" type="button" disabled={saving || Boolean(aiWorking) || batchWorking} onClick={() => void save('draft')}><Save size={16} /> {saving ? 'Saving…' : 'Save draft'}</button><button className="button primary" type="button" disabled={saving || Boolean(aiWorking) || batchWorking} onClick={() => void save('final')}><Check size={16} /> Finalize assessment</button></div>}
    {validation && <section className={`panel assessment-validation ${validation.ready ? 'ready' : 'needs-attention'}`}><div className="assessment-validation-summary"><div><strong>{validation.ready ? 'Ready to finalize' : 'Review before finalizing'}</strong><span>{validation.errors.length} error{validation.errors.length === 1 ? '' : 's'} · {validation.warnings.length} warning{validation.warnings.length === 1 ? '' : 's'}</span></div><button className="button ghost" type="button" onClick={() => setValidationOpen((value) => !value)} aria-expanded={validationOpen}>{validationOpen ? 'Hide details' : 'Show details'}</button></div>{validationOpen && <div className="assessment-validation-details">{validation.errors.map((message) => <p className="error" key={`error-${message}`}><CircleAlert size={14} /> {message}</p>)}{validation.warnings.map((message) => <p className="warning" key={`warning-${message}`}><Info size={14} /> {message}</p>)}</div>}</section>}
  </>
}

function MultipleChoiceEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) {
  const answer = item.answer.type === 'multiple_choice' ? item.answer : { type: 'multiple_choice' as const, choices: [], choiceId: '' }
  function setChoices(choices: AssessmentChoice[]) { onChange((current) => ({ ...current, answer: { type: 'multiple_choice', choices, choiceId: answer.choiceId } })) }
  return <fieldset className="assessment-choice-editor"><legend>Choices and correct answer</legend><div className="assessment-choice-list">{answer.choices.map((choice, index) => <div className="assessment-choice-row" key={choice.id}><input className="assessment-choice-radio" type="radio" name={`correct-choice-${item.id}`} checked={answer.choiceId === choice.id} disabled={readOnly} onChange={() => onChange((current) => ({ ...current, answer: { ...answer, choiceId: choice.id } }))} aria-label={`Mark choice ${index + 1} correct`} /><span className="assessment-choice-letter">{String.fromCharCode(65 + index)}</span><input value={choice.text} disabled={readOnly} onChange={(event) => setChoices(answer.choices.map((currentChoice) => currentChoice.id === choice.id ? { ...currentChoice, text: event.target.value } : currentChoice))} placeholder={`Choice ${String.fromCharCode(65 + index)}`} aria-label={`Choice ${index + 1}`} /><button className="icon-button danger" type="button" disabled={readOnly || answer.choices.length <= 2} onClick={() => { const next = answer.choices.filter((currentChoice) => currentChoice.id !== choice.id); const nextCorrect = answer.choiceId === choice.id ? next[0]?.id ?? '' : answer.choiceId; onChange((current) => ({ ...current, answer: { type: 'multiple_choice', choices: next, choiceId: nextCorrect } })) }} aria-label={`Remove choice ${index + 1}`}><X size={15} /></button></div>)}</div><button className="button ghost assessment-add-choice" type="button" disabled={readOnly || answer.choices.length >= 6} onClick={() => setChoices([...answer.choices, { id: crypto.randomUUID(), text: '' }])}><Plus size={15} /> Add choice</button><small className="assessment-field-help">Select the radio control beside the correct choice. The answer is hidden from student preview.</small></fieldset>
}

function TrueFalseEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (answer: boolean) => void }) {
  const value = item.answer.type === 'true_false' ? item.answer.value : false
  return <fieldset className="assessment-choice-editor"><legend>Correct answer</legend><div className="assessment-binary-options" role="radiogroup" aria-label="True or false answer">{[true, false].map((answer) => <button key={String(answer)} type="button" role="radio" aria-checked={value === answer} className={value === answer ? 'selected' : ''} disabled={readOnly} onClick={() => onChange(answer)}>{answer ? 'True' : 'False'}</button>)}</div><small className="assessment-field-help">The answer is teacher-facing and is excluded from student preview.</small></fieldset>
}

function ShortAnswerEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (answers: string[]) => void }) {
  const answers = item.answer.type === 'short_answer' ? item.answer.acceptedAnswers : []
  return <label className="assessment-question-field">Accepted answers <small>One answer per line. Match behavior remains teacher-controlled.</small><textarea rows={4} disabled={readOnly} value={answers.join('\n')} onChange={(event) => onChange(event.target.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))} placeholder="Enter accepted answer variants" /></label>
}

function ConstructedResponseEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (answer: Extract<AssessmentAnswer, { type: 'constructed_response' }>) => void }) {
  const answer = item.answer.type === 'constructed_response' ? item.answer : { type: 'constructed_response' as const, expectedResponse: '', sampleResponse: '', rubricGuidance: '' }
  return <div className="assessment-two-field-grid"><label>Expected response<textarea rows={4} disabled={readOnly} value={answer.expectedResponse} onChange={(event) => onChange({ ...answer, expectedResponse: event.target.value })} placeholder="What should a strong response include?" /></label><label>Sample response<textarea rows={4} disabled={readOnly} value={answer.sampleResponse} onChange={(event) => onChange({ ...answer, sampleResponse: event.target.value })} placeholder="Teacher-authored example" /></label><label>Rubric / scoring guide<textarea rows={4} disabled={readOnly} value={answer.rubricGuidance ?? ''} onChange={(event) => onChange({ ...answer, rubricGuidance: event.target.value })} placeholder="Teacher-authored criteria" /></label></div>
}

function CommonFields({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) {
  return <div className="assessment-common-fields"><label>Points<input type="number" min="0" step="1" disabled={readOnly} value={item.points ?? 1} onChange={(event) => onChange((current) => ({ ...current, points: Math.max(0, number(event.target.value, 0)) }))} /></label><label>Rationale / answer explanation<textarea rows={3} disabled={readOnly} value={item.rationale ?? ''} onChange={(event) => onChange((current) => ({ ...current, rationale: event.target.value }))} placeholder="Optional teacher-facing rationale" /></label></div>
}

function SuggestionPreview({ suggestion, onAccept }: { suggestion: AssessmentItem; onAccept: () => void }) {
  return <div className="assessment-suggestion-preview"><div className="assessment-suggestion-heading"><div><span className="assessment-state-chip ai_suggestion">AI suggestion</span><strong>Preview only</strong></div><button className="button primary" type="button" onClick={onAccept}><Check size={15} /> Accept suggestion</button></div><p>{suggestion.prompt || 'No question text returned.'}</p>{suggestion.answer.type === 'multiple_choice' && <ol type="A">{suggestion.answer.choices.filter((choice) => choice.text).map((choice) => <li key={choice.id}>{choice.text}</li>)}</ol>}{suggestion.answer.type === 'true_false' && <span className="assessment-preview-answer">True / False</span>}{suggestion.answer.type === 'short_answer' && suggestion.answer.acceptedAnswers.length > 0 && <small>Accepted answer variants: {suggestion.answer.acceptedAnswers.join(', ')}</small>}{suggestion.answer.type === 'constructed_response' && suggestion.answer.expectedResponse && <small>Expected response: {suggestion.answer.expectedResponse}</small>}</div>
}
