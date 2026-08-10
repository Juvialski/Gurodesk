import { ArrowLeft, Check, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Copy, FileDown, Info, LoaderCircle, Lock, Plus, RefreshCw, RotateCcw, Save, ShieldCheck, Sparkles, WandSparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { AssessmentDiagram, AssessmentVisualEditor } from '../components/AssessmentDiagram'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import * as assessmentValidation from '../lib/assessmentValidation'
import { acceptAssessmentItemSuggestion, generateAssessmentItemSuggestion, generateMissingAssessmentItems, requestAssessmentVerification, teacherVerifyAndLockAssessmentItem, type AssessmentItemSuggestion } from '../lib/assessmentGeneration'
import { lockAssessmentItem, recoverSingleFillBlankStructure, unlockAssessmentItem } from '../lib/assessmentItemLifecycle'
import { checkpointAssessmentGenerationFailure, checkpointAssessmentGenerationSuccess, checkpointFailures, clearAssessmentGenerationCheckpoint, createAssessmentGenerationCheckpoint, loadAssessmentGenerationCheckpoint, pauseAssessmentGenerationCheckpoint, pendingAssessmentGenerationItemIds, recoverAssessmentGenerationItems, resumeAssessmentGenerationCheckpoint, saveAssessmentGenerationCheckpoint, type AssessmentGenerationFailure } from '../lib/assessmentGenerationResume'
import { assessmentUsageEstimate, type AssessmentUsageEstimate } from '../lib/assessmentRequestScheduler'
import { validateAssessmentItemDeterministic, verifierRequiresRepair } from '../lib/assessmentQa'
import { applyQuestionTypeDistributionToEmptySlots } from '../lib/assessmentDistribution'
import { reviewAssessmentForFinalization, finalReviewMessages, type AssessmentFinalReview } from '../lib/assessmentFinalReview'
import { duplicateAssessmentDocument, loadAssessmentDocument, saveAssessmentDocument } from '../lib/assessmentRepository'
import type { AssessmentAnswer, AssessmentChoice, AssessmentItem, AssessmentMatchingChoice, AssessmentMatchingMapping, AssessmentMatchingPrompt, AssessmentRecord, AssessmentScoringCriterion, AssessmentSettings, AssessmentSubpart, QuestionType } from '../types/assessment'
import { ASSESSMENT_QUESTION_TYPES } from '../types/assessment'
import { allowedQuestionTypes, answerForType, appendItemHistory, assessmentCompletion, cloneItem, defaultPointsForType, extractErrorMessage, isLocked, mappingDetails, mappingLabel, normalizeAssessment, pointsForItem, recordWithItems, stateLabel, typeLabel } from './assessmentUi'

type UnknownRecord = Record<string, unknown>
type SuggestionMap = Record<string, AssessmentItemSuggestion>
type ValidationSummary = { ready: boolean; errors: string[]; warnings: string[] }
type BatchProgressState = { processed: number; total: number; succeeded: number; failed: number; cancelled: number; remaining: number }

const EMPTY_BATCH_PROGRESS: BatchProgressState = { processed: 0, total: 0, succeeded: 0, failed: 0, cancelled: 0, remaining: 0 }

const TYPE_OPTIONS: Array<{ value: QuestionType; hint: string }> = [
  { value: 'multiple_choice', hint: 'Choose one option' }, { value: 'true_false', hint: 'Binary response' }, { value: 'short_answer', hint: 'Accepted answers' }, { value: 'constructed_response', hint: 'Expected response + rubric' }, { value: 'identification', hint: 'Name / term' }, { value: 'fill_in_the_blank', hint: 'One or more blanks' }, { value: 'numerical_answer', hint: 'Value, unit, tolerance' }, { value: 'problem_solving', hint: 'Method + partial credit' }, { value: 'matching', hint: 'Grouped columns' }, { value: 'multiple_select', hint: 'Select all; all-or-nothing' }, { value: 'essay', hint: 'Key points + rubric' },
]

function object(value: unknown): UnknownRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {} }
function text(value: unknown) { return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value) }
function number(value: unknown, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback }
function array(value: unknown) { return Array.isArray(value) ? value : [] }
function answerObject(item: AssessmentItem) { return item.answer as unknown as UnknownRecord }
function makeId(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 8)}` }

function defaultSettings(recordValue: AssessmentRecord) {
  const settings = object(object(recordValue).settings)
  return { mode: text(settings.mode) || 'auto_balanced', allowedTypes: allowedQuestionTypes(recordValue), counts: object(settings.counts), percentages: object(settings.percentages), defaultPoints: object(settings.defaultPoints), targetTotalPoints: settings.targetTotalPoints === undefined ? null : settings.targetTotalPoints }
}

function targetPointsMessage(target: unknown, current: number, itemCount: number) {
  if (target === null || target === undefined || target === '') return `Current: ${current} points · item count remains ${itemCount}`
  const targetValue = Number(target)
  if (!Number.isFinite(targetValue) || targetValue < 0) return `Current: ${current} points · enter a valid nonnegative target`
  const difference = Math.abs(targetValue - current)
  if (difference < 0.000001) return `Current: ${current} / ${targetValue} points · target allocated`
  return current < targetValue
    ? `Current: ${current} / ${targetValue} points · ${difference} points remain unallocated`
    : `Current: ${current} / ${targetValue} points · ${difference} points over target`
}

function localValidation(recordValue: AssessmentRecord): ValidationSummary {
  try {
    const result = assessmentValidation.validateAssessment({ ...recordValue, status: 'final' }, 'final')
    return { ready: result.ready, errors: result.errors.map((entry) => entry.message), warnings: result.warnings.map((entry) => entry.message) }
  } catch {
    const errors: string[] = []
    recordValue.items.forEach((item) => { if (!item.prompt.trim()) errors.push(`Item ${item.itemNumber}: add a question.`); if (pointsForItem(item) <= 0) errors.push(`Item ${item.itemNumber}: points must be greater than zero.`) })
    return { ready: errors.length === 0, errors, warnings: [] }
  }
}

function setAnswer(item: AssessmentItem, answer: AssessmentAnswer): AssessmentItem { return { ...item, answer } }

function rubricCriteria(answer: UnknownRecord): AssessmentScoringCriterion[] {
  return array(answer.rubric ?? answer.criteria).map((entry, index) => { const value = object(entry); return { id: text(value.id) || `criterion-${index + 1}`, label: text(value.label) || `Criterion ${index + 1}`, pointsPossible: number(value.pointsPossible ?? value.points, 0), ...(value.description ? { description: text(value.description) } : {}) } })
}

export function AssessmentEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, isDemo } = useApp()
  const [recordValue, setRecordValue] = useState<AssessmentRecord | null>(null)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiWorking, setAiWorking] = useState('')
  const [batchWorking, setBatchWorking] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgressState>(EMPTY_BATCH_PROGRESS)
  const [batchMessage, setBatchMessage] = useState('')
  const [batchFailures, setBatchFailures] = useState<AssessmentGenerationFailure[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionMap>({})
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [review, setReview] = useState<AssessmentFinalReview | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [warningsAccepted, setWarningsAccepted] = useState(false)
  const [usageEstimates, setUsageEstimates] = useState<AssessmentUsageEstimate[]>([])
  const controllerRef = useRef<AbortController | null>(null)
  const batchControllerRef = useRef<AbortController | null>(null)
  const recordRef = useRef<AssessmentRecord | null>(null)
  const resumeCheckedRef = useRef('')

  function refreshUsageEstimates() {
    const current = assessmentUsageEstimate()
    setUsageEstimates(Array.isArray(current) ? current : [current])
  }

  useEffect(() => {
    if (!user || !id) return
    resumeCheckedRef.current = ''
    let active = true
    setLoading(true)
    void loadAssessmentDocument(id, user.id, isDemo).then((next) => {
      if (!active) return
      if (!next) throw new Error('Assessment not found or you do not have access to it.')
      const normalized = normalizeAssessment(next)
      setRecordValue(normalized); recordRef.current = normalized; setTitle(normalized.title === 'Untitled assessment' ? '' : normalized.title); setInstructions(normalized.instructions); setSelectedIndex(0); setSuggestions({}); setError(''); refreshUsageEstimates()
    }).catch((nextError) => { if (active) setError(extractErrorMessage(nextError, 'Unable to open the assessment editor.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, user?.id, isDemo])

  useEffect(() => { recordRef.current = recordValue }, [recordValue])

  const view = recordValue ? normalizeAssessment(recordValue) : null
  const current = view?.items[selectedIndex] ?? null
  const readOnly = view ? view.status !== 'draft' : false
  const completion = recordValue ? assessmentCompletion(recordValue) : { filled: 0, total: 0, percent: 0, needsReview: 0, totalPoints: 0, objectivePoints: 0, teacherScoredPoints: 0 }
  const settings = useMemo(() => view ? defaultSettings(view) : null, [view])
  const allowedTypes = settings?.allowedTypes ?? []
  const reviewMessages = review ? finalReviewMessages(review) : null

  useEffect(() => {
    if (!user || !recordValue || loading || batchWorking || resumeCheckedRef.current === recordValue.id) return
    resumeCheckedRef.current = recordValue.id
    if (recordValue.status !== 'draft') {
      clearAssessmentGenerationCheckpoint(recordValue.id)
      return
    }
    const checkpoint = loadAssessmentGenerationCheckpoint(recordValue.id, user.id)
    if (!checkpoint) return
    const recovered = recoverAssessmentGenerationItems(recordValue, checkpoint)
    const recoveredRecord = recovered.recovered
      ? recordWithItems(recordValue, recovered.record.items, 'draft', title, instructions)
      : recordValue
    if (recovered.recovered) {
      recordRef.current = recoveredRecord
      setRecordValue(recoveredRecord)
    }
    const failures = checkpointFailures(checkpoint)
    setBatchFailures(failures)
    const pending = pendingAssessmentGenerationItemIds(checkpoint).filter((itemId) => {
      const item = recoveredRecord.items.find((candidate) => candidate.id === itemId)
      return Boolean(item && !item.prompt.trim() && !isLocked(item) && item.authorshipState === 'empty')
    })
    if (checkpoint.status === 'running' && checkpoint.autoResume && pending.length) {
      setBatchMessage(`${recovered.recovered ? `${recovered.recovered} generated item${recovered.recovered === 1 ? '' : 's'} recovered. ` : ''}Resuming ${pending.length} interrupted item${pending.length === 1 ? '' : 's'}…`)
      window.setTimeout(() => { void generateMissing(pending, { resumed: true, baseRecord: recoveredRecord }) }, 0)
      return
    }
    if (recovered.recovered) {
      void saveAssessmentDocument(recoveredRecord, isDemo).then((saved) => {
        recordRef.current = saved
        setRecordValue(saved)
      }).catch(() => {
        // The local checkpoint remains available for a later retry.
      })
    }
    if (failures.length) {
      setBatchMessage(`${Object.keys(checkpoint.generatedItems).length} generated item${Object.keys(checkpoint.generatedItems).length === 1 ? '' : 's'} recovered · ${failures.length} failed. Tap Generate missing to retry only empty items.`)
      saveAssessmentGenerationCheckpoint(pauseAssessmentGenerationCheckpoint(checkpoint))
    } else {
      clearAssessmentGenerationCheckpoint(recordValue.id)
    }
  }, [recordValue?.id, user?.id, loading, isDemo])

  useEffect(() => { if (view && selectedIndex >= view.items.length) setSelectedIndex(Math.max(0, view.items.length - 1)) }, [selectedIndex, view?.items.length])
  useEffect(() => () => { controllerRef.current?.abort(); batchControllerRef.current?.abort() }, [])

  function replaceItems(items: AssessmentItem[]) { if (!recordValue || !view || readOnly) return; const next = recordWithItems(recordValue, items, view.status, title, instructions); recordRef.current = next; setRecordValue(next); setSavedMessage('') }

  function updateSettings(patch: Partial<AssessmentSettings>) {
    setRecordValue((current) => {
      if (!current) return current
      const next = { ...current, settings: { ...defaultSettings(current), ...patch } as AssessmentSettings }
      recordRef.current = next
      return next
    })
    setWarningsAccepted(false)
    setSavedMessage('')
  }

  function updateSettingsMap(kind: 'counts' | 'percentages' | 'defaultPoints', type: QuestionType, raw: string) {
    const value = raw === '' ? undefined : number(raw, 0)
    const currentSettings = recordValue ? defaultSettings(recordValue) : null
    if (!currentSettings) return
    const nextMap = { ...object(currentSettings[kind]), ...(value === undefined ? {} : { [type]: value }) }
    if (value === undefined) delete nextMap[type]
    updateSettings({ [kind]: nextMap } as Partial<AssessmentSettings>)
  }

  function applyDistribution() {
    if (!recordValue || !view || readOnly || !settings) return
    try {
      const distribution = applyQuestionTypeDistributionToEmptySlots(view.items, settings as unknown as AssessmentSettings)
      const next = recordWithItems(recordValue, distribution.items, 'draft', title, instructions)
      recordRef.current = next
      setRecordValue(next)
      const changed = distribution.changedItemIds.length
      setSavedMessage(`Question types reconciled across empty slots${changed ? ` · ${changed} slot${changed === 1 ? '' : 's'} changed type` : ''}. Completed and locked questions were preserved.${distribution.warnings.length ? ` ${distribution.warnings.join(' ')}` : ''}`)
      setWarningsAccepted(false)
      setError('')
    } catch (nextError) { setError(extractErrorMessage(nextError, 'Unable to apply the distribution.')) }
  }

  function updateItem(index: number, updater: (item: AssessmentItem) => AssessmentItem, material = true) {
    if (!recordValue || !view || readOnly) return
    const item = view.items[index]
    if (!item || isLocked(item)) return
    let next = updater(cloneItem(item))
    next = recoverSingleFillBlankStructure(next)
    const answerChanged = JSON.stringify(item.answer) !== JSON.stringify(next.answer) || item.questionType !== next.questionType || item.prompt !== next.prompt || JSON.stringify(item.visual) !== JSON.stringify(next.visual)
    const scoringChanged = pointsForItem(item) !== pointsForItem(next)
    if (!next.prompt.trim()) { next.authorshipState = 'empty'; next.qaState = 'empty' }
    else if (material && answerChanged) { next.authorshipState = item.authorshipState === 'empty' ? 'manual' : 'teacher_edited'; next.qaState = 'answer_needs_recheck'; next.history = appendItemHistory(item, 'teacher_edit') as never }
    else if (material && scoringChanged) { next.authorshipState = item.authorshipState === 'empty' ? 'manual' : 'teacher_edited'; next.qaState = 'teacher_edited'; next.history = appendItemHistory(item, 'teacher_edit') as never }
    else if (material && item.authorshipState === 'ai_suggestion') { next.authorshipState = 'teacher_edited'; next.qaState = 'teacher_edited' }
    if (material) setWarningsAccepted(false)
    replaceItems(view.items.map((candidate, candidateIndex) => candidateIndex === index ? next : candidate))
  }

  function selectIndex(index: number) { if (!view || index < 0 || index >= view.items.length) return; setSelectedIndex(index); window.requestAnimationFrame(() => document.getElementById(`assessment-item-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }

  async function saveForGeneration(sourceOverride?: AssessmentRecord) {
    const source = sourceOverride ?? recordRef.current
    if (!source || source.status !== 'draft') return null
    const normalized = normalizeAssessment(source)
    const next = recordWithItems(source, normalized.items, 'draft', title.trim(), instructions)
    setSaving(true); setError('')
    try { const saved = await saveAssessmentDocument(next, isDemo); recordRef.current = saved; setRecordValue(saved); setTitle(saved.title); setInstructions(saved.instructions); return saved } catch (nextError) { setError(extractErrorMessage(nextError, 'Unable to save the draft before generation.')); return null } finally { setSaving(false) }
  }

  async function save(status: 'draft' | 'final' = 'draft') {
    if (!recordValue || !view || readOnly) return
    const next = recordWithItems(recordValue, view.items, status, title.trim(), instructions)
    if (status === 'final') {
      const initialReview = reviewAssessmentForFinalization(next)
      const finalReview = warningsAccepted ? reviewAssessmentForFinalization(next, { acknowledgedWarningCodes: initialReview.warnings.map((entry) => entry.code) }) : initialReview
      setReview(finalReview); setReviewOpen(true)
      if (!finalReview.ready) { setError('Resolve hard errors and accept any quality warnings before finalizing.'); return }
      const validation = localValidation(next)
      if (validation.errors.length > 0) { setError('Resolve the validation issues before finalizing this assessment.'); return }
    }
    setSaving(true); setError('')
    try { const saved = await saveAssessmentDocument(next, isDemo); recordRef.current = saved; setRecordValue(saved); setTitle(saved.title); setInstructions(saved.instructions); setSavedMessage(status === 'final' ? 'Assessment finalized and locked.' : 'Draft saved.'); if (status === 'final') setReview(reviewAssessmentForFinalization(saved)) } catch (nextError) { setError(extractErrorMessage(nextError, 'Unable to save this assessment.')) } finally { setSaving(false) }
  }

  async function duplicate() { if (!recordValue) return; setSaving(true); try { const created = await duplicateAssessmentDocument(recordValue, isDemo); navigate(`/assessments/${created.id}`) } catch (nextError) { setError(extractErrorMessage(nextError, 'Unable to duplicate this assessment.')) } finally { setSaving(false) } }

  async function generateItem(index: number, alternative = false) {
    if (!recordValue || !view || readOnly) return
    const item = view.items[index]
    if (!item || aiWorking || saving || batchWorking || isLocked(item)) return
    setAiWorking(item.id); setError('')
    let controller: AbortController | null = null
    try {
      const persisted = await saveForGeneration(); if (!persisted) return
      const persistedItem = normalizeAssessment(persisted).items[index]; if (!persistedItem) return
      controllerRef.current?.abort(); controller = new AbortController(); controllerRef.current = controller
      const suggestion = await generateAssessmentItemSuggestion({ assessment: persisted, item: persistedItem, demo: isDemo, alternative, teacherContext: persisted.instructions, signal: controller.signal })
      setSuggestions((currentSuggestions) => ({ ...currentSuggestions, [item.id]: suggestion }))
      if (suggestion.quotaPaused) setBatchMessage('Generation paused because the provider limit was reached. Your saved work is preserved.')
    } catch (nextError) { if (!controller?.signal.aborted) setError(extractErrorMessage(nextError, 'Unable to generate an item suggestion.')) } finally { refreshUsageEstimates(); if (controller && controllerRef.current === controller) controllerRef.current = null; setAiWorking('') }
  }

  async function checkAccuracy(index: number) {
    if (!recordValue || !view || readOnly) return
    const item = view.items[index]
    if (!item || aiWorking || isLocked(item)) return
    setAiWorking(item.id); setError('')
    let controller: AbortController | null = null
    try {
      const persisted = await saveForGeneration(); if (!persisted) return
      const persistedItem = normalizeAssessment(persisted).items[index]; if (!persistedItem) return
      controller = new AbortController(); controllerRef.current?.abort(); controllerRef.current = controller
      const result = await requestAssessmentVerification({ assessment: persisted, item: persistedItem, candidate: { questionType: persistedItem.questionType, prompt: persistedItem.prompt, answer: persistedItem.answer, rationale: persistedItem.rationale ?? '', referencedResources: [] }, demo: isDemo, signal: controller.signal })
      const passed = Boolean(result.verifier && !verifierRequiresRepair(result.verifier))
      const qaState: AssessmentItem['qaState'] = passed ? 'verified' : result.verifier ? 'needs_review' : 'answer_needs_recheck'
      const persistedView = normalizeAssessment(persisted)
      const nextItems = persistedView.items.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, qaState } : currentItem)
      const nextRecord = recordWithItems(persisted, nextItems, 'draft', persisted.title, persisted.instructions)
      recordRef.current = nextRecord
      setRecordValue(nextRecord)
      setSavedMessage(passed ? 'Accuracy check passed.' : 'Accuracy check needs teacher review.')
    } catch (nextError) { if (!controller?.signal.aborted) setError(extractErrorMessage(nextError, 'Accuracy check could not be completed.')) } finally { refreshUsageEstimates(); if (controller && controllerRef.current === controller) controllerRef.current = null; setAiWorking('') }
  }

  function acceptSuggestion(index: number) {
    if (!recordValue || !view || readOnly) return
    const item = view.items[index]; const suggestion = item && suggestions[item.id]
    if (!item || !suggestion || isLocked(item)) return
    const accepted = acceptAssessmentItemSuggestion(item, suggestion)
    replaceItems(view.items.map((candidate, itemIndex) => itemIndex === index ? accepted : candidate))
    setSuggestions((currentSuggestions) => { const next = { ...currentSuggestions }; delete next[item.id]; return next })
    setSavedMessage('Suggestion accepted and locked. Unlock it only if you want to edit it again.')
  }

  async function acceptVerifyAndFinalizeAll() {
    if (!recordValue || !view || readOnly || saving || batchWorking || aiWorking) return
    setSaving(true); setError(''); setSavedMessage('')
    try {
      const source = normalizeAssessment(recordRef.current ?? recordValue)
      const acceptedIds = new Set<string>()
      const structurallyBlocked = new Set<number>()
      const nextItems = source.items.map((item) => {
        if (!item.prompt.trim()) return item
        const repairedItem = recoverSingleFillBlankStructure(item)
        try {
          const candidate = teacherVerifyAndLockAssessmentItem(repairedItem, suggestions[item.id])
          const qa = validateAssessmentItemDeterministic(candidate, {
            allowedTypes: allowedTypes.length ? allowedTypes : undefined,
            expectedItemNumber: item.itemNumber,
            expectedCompetencyId: item.competencySnapshot.id,
            expectedCognitiveCategoryId: item.cognitiveCategorySnapshot.id,
          })
          if (!qa.valid) {
            structurallyBlocked.add(item.itemNumber)
            return unlockAssessmentItem(repairedItem)
          }
          acceptedIds.add(item.id)
          return candidate
        } catch {
          structurallyBlocked.add(item.itemNumber)
          return unlockAssessmentItem(repairedItem)
        }
      })

      const draft = recordWithItems(source, nextItems, 'draft', title.trim(), instructions)
      const firstReview = reviewAssessmentForFinalization(draft)
      const acknowledgedWarningCodes = [...new Set(firstReview.warnings.map((entry) => entry.code))]
      const verifiedReview = reviewAssessmentForFinalization(draft, { acknowledgedWarningCodes })
      setWarningsAccepted(true)
      setReview(verifiedReview)
      setReviewOpen(verifiedReview.hardErrors.length > 0)

      setSuggestions((currentSuggestions) => {
        const next = { ...currentSuggestions }
        acceptedIds.forEach((itemId) => { delete next[itemId] })
        return next
      })

      const savedDraft = await saveAssessmentDocument(draft, isDemo)
      recordRef.current = savedDraft
      setRecordValue(savedDraft)
      setTitle(savedDraft.title)
      setInstructions(savedDraft.instructions)

      const validation = localValidation(savedDraft)
      if (verifiedReview.hardErrors.length > 0 || validation.errors.length > 0) {
        const grouped = finalReviewMessages(verifiedReview).errors
        const blockerCount = Math.max(grouped.length, validation.errors.length, structurallyBlocked.size ? 1 : 0)
        setSavedMessage(`${acceptedIds.size} completed item${acceptedIds.size === 1 ? '' : 's'} accepted, teacher-verified, locked, and saved.`)
        setError(`${blockerCount} structural blocker${blockerCount === 1 ? '' : 's'} remain. Fix only the listed items; teacher approval is already done.`)
        return
      }

      const finalized = recordWithItems(savedDraft, normalizeAssessment(savedDraft).items, 'final', savedDraft.title, savedDraft.instructions)
      const savedFinal = await saveAssessmentDocument(finalized, isDemo)
      recordRef.current = savedFinal
      setRecordValue(savedFinal)
      setReview(reviewAssessmentForFinalization(savedFinal, { acknowledgedWarningCodes }))
      setReviewOpen(false)
      setSavedMessage(`${acceptedIds.size} completed item${acceptedIds.size === 1 ? '' : 's'} accepted, teacher-verified, locked, and assessment finalized.`)
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to accept, verify, and finalize the assessment.'))
    } finally {
      setSaving(false)
    }
  }


  async function generateMissing(itemIdsOverride?: string[], options: { resumed?: boolean; baseRecord?: AssessmentRecord } = {}) {
    const source = options.baseRecord ?? recordRef.current
    if (!source || source.status !== 'draft' || saving || batchWorking || aiWorking || !user) return
    let generationSource = source
    const sourceView = normalizeAssessment(source)
    setBatchWorking(true); setBatchMessage(''); setError('')
    if (!options.resumed) { setBatchProgress(EMPTY_BATCH_PROGRESS); setBatchFailures([]) }
    let controller: AbortController | null = null
    let checkpoint = options.resumed
      ? loadAssessmentGenerationCheckpoint(source.id, user.id)
      : null
    try {
      // In automatic distribution modes the teacher's enabled question types
      // are applied before generation. Only empty slots are changed; existing,
      // edited, accepted, and locked questions keep their current format.
      if (!options.resumed) {
        const generationSettings = defaultSettings(sourceView) as unknown as AssessmentSettings
        if (generationSettings.mode !== 'manual_per_item') {
          const distribution = applyQuestionTypeDistributionToEmptySlots(sourceView.items, generationSettings)
          generationSource = recordWithItems(source, distribution.items, 'draft', title, instructions)
          recordRef.current = generationSource
          setRecordValue(generationSource)
          if (distribution.changedItemIds.length) {
            setSavedMessage(`Question types were balanced across ${distribution.changedItemIds.length} empty slot${distribution.changedItemIds.length === 1 ? '' : 's'} before generation. Completed questions were preserved.`)
          }
        }
      }
      const persisted = await saveForGeneration(generationSource); if (!persisted) return
      const persistedView = normalizeAssessment(persisted)
      const selectedIds = itemIdsOverride?.length ? new Set(itemIdsOverride) : null
      const missingItems = persistedView.items.filter((item) => (!selectedIds || selectedIds.has(item.id)) && !item.prompt.trim() && !isLocked(item) && item.authorshipState !== 'teacher_edited' && item.authorshipState !== 'teacher_accepted' && !suggestions[item.id])
      if (!missingItems.length) {
        if (checkpoint) {
          const failures = checkpointFailures(checkpoint)
          if (failures.length) saveAssessmentGenerationCheckpoint(pauseAssessmentGenerationCheckpoint(checkpoint))
          else clearAssessmentGenerationCheckpoint(persisted.id)
        }
        setBatchMessage('No eligible empty items remain. Locked, accepted, edited, and already generated items were skipped.')
        return
      }
      checkpoint = checkpoint
        ? resumeAssessmentGenerationCheckpoint(checkpoint)
        : createAssessmentGenerationCheckpoint({ assessmentId: persisted.id, userId: user.id, itemIds: missingItems.map((item) => item.id) })
      saveAssessmentGenerationCheckpoint(checkpoint)
      setBatchFailures(checkpointFailures(checkpoint))
      setBatchProgress({ processed: 0, total: missingItems.length, succeeded: 0, failed: 0, cancelled: 0, remaining: missingItems.length })
      controller = new AbortController(); batchControllerRef.current?.abort(); batchControllerRef.current = controller
      const summary = await generateMissingAssessmentItems({
        assessment: persisted,
        demo: isDemo,
        itemIds: missingItems.map((item) => item.id),
        concurrency: 2,
        signal: controller.signal,
        onProgress: (progress) => {
          setBatchProgress({ processed: progress.processed, total: progress.total, succeeded: progress.succeeded, failed: progress.failed, cancelled: progress.cancelled, remaining: progress.remaining })
          if (progress.status === 'failed' && progress.message && checkpoint) {
            checkpoint = checkpointAssessmentGenerationFailure(checkpoint, progress.itemId, progress.message)
            saveAssessmentGenerationCheckpoint(checkpoint)
            setBatchFailures(checkpointFailures(checkpoint))
          }
        },
        onSuggestion: (item, suggestion) => {
          // Commit every successful result to the in-memory draft AND the
          // resumable local checkpoint immediately. A refresh can therefore
          // restore completed questions instead of paying for them again.
          const latest = recordRef.current
          if (!latest) return
          const latestView = normalizeAssessment(latest)
          const itemIndex = latestView.items.findIndex((candidate) => candidate.id === item.id)
          if (itemIndex < 0) return
          const currentItem = latestView.items[itemIndex]
          if (currentItem.prompt.trim() || currentItem.authorshipState !== 'empty' || isLocked(currentItem)) return
          const nextItems = latestView.items.map((candidate, index) => index === itemIndex ? item : candidate)
          const nextRecord = recordWithItems(latest, nextItems, 'draft', title.trim(), instructions)
          recordRef.current = nextRecord
          setRecordValue(nextRecord)
          setSuggestions((currentSuggestions) => ({ ...currentSuggestions, [item.id]: suggestion }))
          if (checkpoint) {
            checkpoint = checkpointAssessmentGenerationSuccess(checkpoint, item)
            saveAssessmentGenerationCheckpoint(checkpoint)
          }
        },
      })

      // Save the accumulated successful subset once at the end of this run.
      // During the run the local checkpoint protects every success against a
      // refresh without creating dozens of document versions/server writes.
      const latest = recordRef.current ?? persisted
      if (summary.results.length) {
        try {
          setSaving(true)
          const saved = await saveAssessmentDocument(latest, isDemo)
          recordRef.current = saved
          setRecordValue(saved)
        } catch (saveError) {
          if (checkpoint) {
            checkpoint = pauseAssessmentGenerationCheckpoint(checkpoint)
            saveAssessmentGenerationCheckpoint(checkpoint)
          }
          setError(`Generated items are recoverable on this device, but the batch checkpoint could not be saved to Supabase: ${extractErrorMessage(saveError, 'try Save draft again.')}`)
        } finally { setSaving(false) }
      }
      refreshUsageEstimates()
      const quotaPaused = summary.errors.some((entry) => /429|quota|rate.?limit|provider limit/i.test(entry.message))
      if (checkpoint) {
        if (summary.failed || summary.cancelled || quotaPaused) {
          checkpoint = pauseAssessmentGenerationCheckpoint(checkpoint)
          saveAssessmentGenerationCheckpoint(checkpoint)
        } else {
          clearAssessmentGenerationCheckpoint(persisted.id)
        }
      }
      setBatchMessage(quotaPaused
        ? `${summary.succeeded} generated and saved · ${summary.failed} failed. Generation paused because the provider limit was reached; empty items can be retried later.`
        : `${summary.succeeded} generated and saved${summary.failed ? ` · ${summary.failed} failed and remain empty` : ''}${summary.cancelled ? ` · ${summary.cancelled} cancelled` : ''}.`)
    } catch (nextError) {
      refreshUsageEstimates()
      if (checkpoint) {
        checkpoint = pauseAssessmentGenerationCheckpoint(checkpoint)
        saveAssessmentGenerationCheckpoint(checkpoint)
      }
      if (controller?.signal.aborted) setBatchMessage('Generation paused. Completed items are recoverable; empty items can be resumed or retried.')
      else setError(extractErrorMessage(nextError, 'Unable to generate missing items.'))
    } finally {
      if (controller && batchControllerRef.current === controller) batchControllerRef.current = null
      setBatchWorking(false)
    }
  }

  function cancelBatchGeneration() {
    if (recordValue && user) {
      const checkpoint = loadAssessmentGenerationCheckpoint(recordValue.id, user.id)
      if (checkpoint) saveAssessmentGenerationCheckpoint(pauseAssessmentGenerationCheckpoint(checkpoint))
    }
    batchControllerRef.current?.abort()
  }

  async function toggleLock(index: number) {
    if (!recordValue || !view || readOnly || saving) return
    const source = normalizeAssessment(recordRef.current ?? recordValue)
    const item = source.items[index]
    if (!item) return
    const unlocking = isLocked(item)
    if (!unlocking && !item.prompt.trim()) { setError('Add and review the question before locking this item.'); return }

    const repaired = unlocking ? recoverSingleFillBlankStructure(item) : item
    const changed = unlocking ? unlockAssessmentItem(repaired) : lockAssessmentItem(repaired)
    const next = recordWithItems(source, source.items.map((candidate, itemIndex) => itemIndex === index ? changed : candidate), 'draft', title.trim(), instructions)
    setSaving(true); setError('')
    try {
      const saved = await saveAssessmentDocument(next, isDemo)
      recordRef.current = saved
      setRecordValue(saved)
      setTitle(saved.title)
      setInstructions(saved.instructions)
      setWarningsAccepted(false)
      setSavedMessage(unlocking ? 'Item unlocked and saved. You can edit it now.' : 'Item locked and saved.')
    } catch (nextError) {
      setError(extractErrorMessage(nextError, unlocking ? 'Unable to persist the item unlock.' : 'Unable to persist the item lock.'))
    } finally {
      setSaving(false)
    }
  }
  function restoreHistory(index: number, historyIndex: number) { if (!recordValue || !view || readOnly) return; const item = view.items[index]; const history = array(object(item).history); const version = object(history[historyIndex]); if (!version || isLocked(item)) return; const restored: AssessmentItem = { ...item, prompt: text(version.prompt), questionType: (version.questionType as QuestionType) || item.questionType, answer: version.answer as AssessmentAnswer, rationale: text(version.rationale), teacherNotes: text(version.teacherNotes), pointsPossible: number(version.pointsPossible, pointsForItem(item)), points: version.points === null ? null : number(version.points, pointsForItem(item)), visual: version.visual as AssessmentItem['visual'], authorshipState: 'teacher_edited', qaState: 'answer_needs_recheck', locked: false, history: appendItemHistory(item, 'restore') as never }; replaceItems(view.items.map((candidate, itemIndex) => itemIndex === index ? restored : candidate)); setWarningsAccepted(false) }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Opening assessment editor…</strong></div>
  if (error && !recordValue) return <EmptyState icon={CircleAlert} title="Assessment unavailable" description={error}><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Back to assessments</Link></EmptyState>
  if (!recordValue || !view) return null
  if (!view.items.length) return <EmptyState icon={ClipboardCheck} title="Assessment has no items" description="Recreate the assessment from a finalized TOS."><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> Back to assessments</Link></EmptyState>

  return <>
    <PageHeader eyebrow="Assessment studio · Phase 4.4" title={view.status === 'draft' ? 'Assessment editor' : 'Final assessment'} description="Edit one complete question at a time. Finalized TOS item numbers, competencies, and cognitive categories remain immutable." actions={<div className="assessment-header-actions"><Link className="button ghost" to="/assessments"><ArrowLeft size={16} /> All assessments</Link><Link className="button ghost" to={`/assessments/${view.id}/print`}><FileDown size={16} /> Export</Link></div>} />
    {view.status !== 'draft' && <div className="assessment-locked panel"><ShieldCheck size={18} /><div><strong>{view.status === 'final' ? 'This assessment is finalized and locked.' : 'This assessment is archived.'}</strong><p>Duplicate it to create an editable draft.</p></div>{view.status === 'final' && <button className="button secondary" type="button" onClick={() => void duplicate()} disabled={saving}><Copy size={15} /> Duplicate</button>}</div>}
    {error && <div className="form-message error assessment-editor-message" role="alert">{error}</div>}
    {savedMessage && <div className="assessment-saved-message" role="status"><Check size={15} /> {savedMessage}</div>}
    <div className="assessment-editor-context panel"><div><small>Source TOS</small><strong>{view.sourceTosTitle}</strong><span>{[view.gradeLevel, view.learningArea, view.schoolYear].filter(Boolean).join(' · ')}</span></div><div className="assessment-editor-progress"><div><strong>{completion.filled}/{completion.total}</strong><span>items complete</span></div><div className="assessment-progress"><span style={{ width: `${completion.percent}%` }} /></div></div>{!readOnly && <div className="assessment-context-actions"><button className="button secondary assessment-batch-button" type="button" onClick={() => void generateMissing()} disabled={batchWorking || Boolean(aiWorking) || saving || !view.items.some((item) => !item.prompt.trim() && !isLocked(item))}><WandSparkles size={16} /> {batchWorking ? `Generated ${batchProgress.succeeded}/${batchProgress.total}` : 'Generate missing'}</button></div>}</div>
    <section className="panel assessment-score-summary"><div><strong>Items</strong><span>{view.items.length} / {view.totalItems}</span></div><div><strong>Total points</strong><span>{completion.totalPoints}</span></div><div><strong>Completed</strong><span>{completion.filled} / {completion.total}</span></div><div><strong>Needs review</strong><span>{completion.needsReview}</span></div><div><strong>Objective points</strong><span>{completion.objectivePoints}</span></div><div><strong>Teacher-scored points</strong><span>{completion.teacherScoredPoints}</span></div></section>
    {!readOnly && settings && <section className="panel assessment-settings-panel"><div className="assessment-section-heading"><span><ShieldCheck size={15} /></span><div><h2>Question types and distribution</h2><p>Teacher-controlled settings. TOS item allocation is unchanged.</p></div></div><div className="assessment-allowed-types">{TYPE_OPTIONS.map((option) => <label key={option.value}><input type="checkbox" checked={allowedTypes.includes(option.value)} onChange={(event) => { const nextAllowed = event.target.checked ? [...allowedTypes, option.value] : allowedTypes.filter((type) => type !== option.value); if (!nextAllowed.length) return; updateSettings({ allowedTypes: nextAllowed }) }} /><span>{typeLabel(option.value)}</span></label>)}</div><div className="assessment-distribution-row"><label>Mode<select value={text(settings.mode)} onChange={(event) => updateSettings({ mode: event.target.value as AssessmentSettings['mode'] })}><option value="auto_balanced">Auto / balanced · grouped sections</option><option value="fixed_counts">Fixed counts</option><option value="percentages">Percentages</option><option value="manual_per_item">Manual per item</option></select></label><label>Target total points<input type="number" min="0" step="1" value={settings.targetTotalPoints === null || settings.targetTotalPoints === undefined ? '' : String(settings.targetTotalPoints)} onChange={(event) => updateSettings({ targetTotalPoints: event.target.value === '' ? null : number(event.target.value, 0) })} /></label><span>{targetPointsMessage(settings.targetTotalPoints, completion.totalPoints, view.items.length)}</span></div>{(settings.mode === 'fixed_counts' || settings.mode === 'percentages') && <div className="assessment-distribution-fields"><strong>{settings.mode === 'fixed_counts' ? 'Items per type' : 'Percentage of item slots per type'}</strong>{allowedTypes.map((type) => <label key={`${settings.mode}-${type}`}>{typeLabel(type)}<input type="number" min="0" step={settings.mode === 'fixed_counts' ? '1' : '0.1'} value={String(object(settings[settings.mode === 'fixed_counts' ? 'counts' : 'percentages'])[type] ?? '')} onChange={(event) => updateSettingsMap(settings.mode === 'fixed_counts' ? 'counts' : 'percentages', type, event.target.value)} /></label>)}<small>Counts and percentages are reconciled deterministically to {view.items.length} item slots when applied. Question types are kept in contiguous test-paper sections following the order shown above. Point weight remains a separate metric.</small></div>}<div className="assessment-distribution-fields"><strong>Default points for new items</strong>{allowedTypes.map((type) => <label key={`points-${type}`}>{typeLabel(type)}<input type="number" min="0.1" step="0.5" value={String(object(settings.defaultPoints)[type] ?? defaultPointsForType(view, type))} onChange={(event) => updateSettingsMap('defaultPoints', type, event.target.value)} /></label>)}<small>These are editable convenience defaults; current item scores remain unchanged until a distribution is applied.</small></div><button className="button secondary" type="button" onClick={applyDistribution}><Sparkles size={15} /> Apply distribution to empty slots</button><small className="assessment-usage-estimate">{usageEstimates.length ? `Today’s GuroDesk request estimate (approximate): ${usageEstimates.map((entry) => `${entry.model} ${entry.requestCount}`).join(' · ')}. Provider usage/quota may differ.` : 'No local AI requests recorded today. Provider usage/quota may differ.'}</small></section>}
    {batchWorking && <div className="assessment-batch-progress panel"><div><LoaderCircle size={17} className="spin" /><strong>Generating missing items</strong><span>{batchProgress.succeeded}/{batchProgress.total} generated · {batchProgress.processed}/{batchProgress.total} processed{batchProgress.failed ? ` · ${batchProgress.failed} failed` : ''}{batchProgress.remaining ? ` · ${batchProgress.remaining} remaining` : ''}</span></div><button className="button ghost" type="button" onClick={cancelBatchGeneration}><X size={15} /> Cancel</button></div>}
    {batchMessage && <div className="assessment-batch-message" role="status"><Sparkles size={15} /> {batchMessage}</div>}
    {batchFailures.length > 0 && <div className="assessment-batch-message" role="status"><CircleAlert size={15} /><div><strong>{batchFailures.length} item{batchFailures.length === 1 ? '' : 's'} failed and remain empty.</strong><span>Tap Generate missing to retry them. No extra AI calls are made automatically.</span><details><summary>Show failure details</summary>{batchFailures.slice(0, 10).map((failure) => { const itemNumber = view.items.find((item) => item.id === failure.itemId)?.itemNumber; return <p key={failure.itemId}>{itemNumber ? `Item ${itemNumber}: ` : ''}{failure.message}</p> })}{batchFailures.length > 10 && <p>+ {batchFailures.length - 10} more failed items</p>}</details></div></div>}
    <section className="panel assessment-details-panel"><div className="assessment-details-heading"><div><small>Assessment details</small><strong>Title and learner directions</strong></div><span>{readOnly ? 'Locked after finalization' : 'Teacher-authored'}</span></div><div className="assessment-details-fields"><label>Assessment title<input disabled={readOnly} value={title} onChange={(event) => { setTitle(event.target.value); setSavedMessage('') }} placeholder="e.g. First summative test" /></label><label>Directions / instructions<textarea rows={3} disabled={readOnly} value={instructions} onChange={(event) => { setInstructions(event.target.value); setSavedMessage('') }} placeholder="Teacher-authored directions for learners" /></label></div></section>
    <div className="assessment-editor-layout"><aside className="assessment-item-navigator panel" aria-label="Assessment item navigator"><div className="assessment-navigator-heading"><div><small>Items</small><strong>{selectedIndex + 1} of {view.items.length}</strong></div><span>{completion.percent}% complete</span></div><nav className="assessment-item-buttons" aria-label="Choose assessment item">{view.items.map((item, index) => <button key={item.id} id={`assessment-item-${index}`} type="button" className={`assessment-item-button ${selectedIndex === index ? 'selected' : ''} state-${item.authorshipState} ${isLocked(item) ? 'locked' : ''}`} aria-current={selectedIndex === index ? 'step' : undefined} aria-label={`Item ${item.itemNumber}, ${stateLabel(object(item).qaState as string || item.authorshipState)}`} onClick={() => selectIndex(index)}><span>{item.itemNumber}</span><small>{stateLabel(object(item).qaState as string || item.authorshipState)}</small></button>)}</nav></aside>
      <main className="assessment-editor-main"><section className="panel assessment-item-card"><div className="assessment-item-card-heading"><div><span className="assessment-item-number">{current?.itemNumber}</span><div><span className={`assessment-state-chip ${String(object(current).qaState ?? current?.authorshipState)}`}>{current && stateLabel(String(object(current).qaState ?? current.authorshipState))}</span><h2>Question {current?.itemNumber}</h2></div></div><div className="assessment-item-nav-actions"><button className="icon-button" type="button" disabled={selectedIndex <= 0} onClick={() => selectIndex(selectedIndex - 1)} aria-label="Previous item"><ChevronLeft size={19} /></button><button className="icon-button" type="button" disabled={selectedIndex >= view.items.length - 1} onClick={() => selectIndex(selectedIndex + 1)} aria-label="Next item"><ChevronRight size={19} /></button></div></div>
        {current && <><div className="assessment-mapping-card"><div><small>Immutable TOS mapping</small><div className="assessment-mapping-badges"><span>{current.competencySnapshot.code || 'Competency'}</span><span>{current.cognitiveCategorySnapshot.shortLabel || current.cognitiveCategorySnapshot.label || 'Cognitive category'}</span></div><strong>{mappingLabel(current)}</strong><span>{mappingDetails(current)}</span></div><span className="assessment-mapping-lock"><ShieldCheck size={14} /> Locked by TOS</span></div><div className="assessment-type-picker" role="radiogroup" aria-label="Question type"><span className="assessment-field-label">Question type</span><div>{TYPE_OPTIONS.filter((option) => allowedTypes.includes(option.value) || option.value === current.questionType).map((option) => <button key={option.value} type="button" role="radio" aria-checked={current.questionType === option.value} className={current.questionType === option.value ? 'selected' : ''} disabled={readOnly || isLocked(current)} onClick={() => updateItem(selectedIndex, (item) => ({ ...item, questionType: option.value, answer: option.value === item.questionType ? item.answer : answerForType(option.value), pointsPossible: option.value === item.questionType ? pointsForItem(item) : defaultPointsForType(view, option.value), points: option.value === item.questionType ? item.points : defaultPointsForType(view, option.value) }))}><strong>{typeLabel(option.value)}</strong><small>{option.hint}</small></button>)}</div></div><label className="assessment-question-field">Question / prompt<textarea rows={5} disabled={readOnly || isLocked(current)} value={current.prompt} onChange={(event) => updateItem(selectedIndex, (item) => ({ ...item, prompt: event.target.value }))} placeholder="Write the question learners should answer." /></label><AssessmentVisualEditor visual={current.visual} disabled={readOnly || isLocked(current)} onChange={(visual) => updateItem(selectedIndex, (item) => ({ ...item, visual }))} /><TypeEditor item={current} readOnly={readOnly || isLocked(current)} onChange={(updater) => updateItem(selectedIndex, updater)} /><CommonFields item={current} readOnly={readOnly || isLocked(current)} onChange={(updater) => updateItem(selectedIndex, updater)} /><label className="assessment-question-field">Teacher notes <small>Private planning note; not shown in student preview.</small><textarea rows={3} disabled={readOnly || isLocked(current)} value={current.teacherNotes ?? ''} onChange={(event) => updateItem(selectedIndex, (item) => ({ ...item, teacherNotes: event.target.value }))} placeholder="Optional note for your review" /></label><HistoryPanel item={current} readOnly={readOnly || isLocked(current)} onRestore={(historyIndex) => restoreHistory(selectedIndex, historyIndex)} /></>}
      </section>
      {!readOnly && current && <section className="panel assessment-ai-card"><div className="assessment-ai-heading"><div><span className="eyebrow">Teacher-controlled assistance</span><h2>Question actions</h2><p>Accepting an AI suggestion also locks it in one step. Unlock only when you want to edit an accepted item again.</p></div><Sparkles size={22} /></div><div className="assessment-ai-actions"><button className="button secondary" type="button" disabled={Boolean(aiWorking) || batchWorking || saving || isLocked(current)} onClick={() => void generateItem(selectedIndex, Boolean(current.prompt.trim()))}><WandSparkles size={15} /> {aiWorking === current.id ? 'Working…' : current.prompt ? 'Generate alternative' : 'Generate question'}</button>{current.prompt && <button className="button ghost" type="button" disabled={Boolean(aiWorking) || batchWorking || saving || isLocked(current)} onClick={() => void checkAccuracy(selectedIndex)}><ShieldCheck size={15} /> Check accuracy</button>}{isLocked(current) ? <button className="button ghost" type="button" disabled={saving} onClick={() => void toggleLock(selectedIndex)}><Lock size={15} /> Unlock item</button> : !suggestions[current.id] && current.prompt.trim() ? <button className="button ghost" type="button" disabled={saving} onClick={() => void toggleLock(selectedIndex)}><Lock size={15} /> Lock item</button> : null}</div>{isDemo && <p className="assessment-demo-note"><Info size={14} /> Local demo preview; signed-in workspaces use the teacher's configured Gemini service.</p>}{suggestions[current.id] && <SuggestionPreview suggestion={suggestions[current.id]} onAccept={() => acceptSuggestion(selectedIndex)} />}</section>}
      <div className="assessment-prev-next"><button className="button ghost" type="button" disabled={selectedIndex <= 0} onClick={() => selectIndex(selectedIndex - 1)}><ChevronLeft size={16} /> Previous</button><span>Item {current?.itemNumber} of {view.items.length}</span><button className="button ghost" type="button" disabled={selectedIndex >= view.items.length - 1} onClick={() => selectIndex(selectedIndex + 1)}>Next <ChevronRight size={16} /></button></div></main></div>
    {!readOnly && <div className="assessment-sticky-actions"><button className="button secondary" type="button" disabled={saving || Boolean(aiWorking) || batchWorking} onClick={() => void save('draft')}><Save size={16} /> {saving ? 'Saving…' : 'Save draft'}</button><button className="button primary" type="button" disabled={saving || Boolean(aiWorking) || batchWorking} onClick={() => void acceptVerifyAndFinalizeAll()}><ClipboardCheck size={16} /> {saving ? 'Verifying…' : 'Accept, verify & finalize all'}</button></div>}
    {review && reviewMessages && <section className={`panel assessment-validation ${review.ready ? 'ready' : 'needs-attention'}`}><div className="assessment-validation-summary"><div><strong>{review.ready ? 'Teacher verification complete' : 'Only structural fixes remain'}</strong><span>{reviewMessages.errors.length} blocker{reviewMessages.errors.length === 1 ? '' : 's'} · {reviewMessages.warnings.length} grouped warning{reviewMessages.warnings.length === 1 ? '' : 's'} · {review.metrics.itemCount} items · {review.metrics.totalPoints} points</span></div><div className="assessment-review-actions"><button className="button ghost" type="button" onClick={() => setReviewOpen((value) => !value)} aria-expanded={reviewOpen}>{reviewOpen ? 'Hide details' : 'Show details'}</button></div></div>{reviewOpen && <div className="assessment-validation-details"><div className="assessment-review-distribution"><strong>Question type</strong><strong>Items</strong><strong>Points</strong>{TYPE_OPTIONS.filter((option) => review.metrics.typeCounts[option.value]).map((option) => <div className="assessment-review-distribution-row" key={`review-${option.value}`}><span>{typeLabel(option.value)}</span><span>{review.metrics.typeCounts[option.value] ?? 0}</span><span>{review.metrics.typePoints[option.value] ?? 0}</span></div>)}</div>{reviewMessages.errors.map((message, index) => <p className="error" key={`error-${index}-${message}`}><CircleAlert size={14} /> {message}</p>)}{reviewMessages.warnings.map((message, index) => <p className="warning" key={`warning-${index}-${message}`}><Info size={14} /> {message}</p>)}</div>}</section>}
  </>
}

function TypeEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) {
  const answer = answerObject(item)
  const type = item.questionType
  if (type === 'multiple_choice' || type === 'multiple_select') return <ChoiceEditor item={item} readOnly={readOnly} multi={type === 'multiple_select'} onChange={onChange} />
  if (type === 'true_false') return <fieldset className="assessment-choice-editor"><legend>Correct answer</legend><div className="assessment-binary-options" role="radiogroup" aria-label="True or false answer">{[true, false].map((value) => <button key={String(value)} type="button" role="radio" aria-checked={answer.value === value} className={answer.value === value ? 'selected' : ''} disabled={readOnly} onClick={() => onChange((current) => setAnswer(current, { type: 'true_false', value }))}>{value ? 'True' : 'False'}</button>)}</div></fieldset>
  if (type === 'short_answer' || type === 'identification') return <AcceptedAnswerEditor item={item} readOnly={readOnly} onChange={onChange} />
  if (type === 'fill_in_the_blank') return <FillEditor item={item} readOnly={readOnly} onChange={onChange} />
  if (type === 'numerical_answer') return <NumericalEditor item={item} readOnly={readOnly} onChange={onChange} />
  if (type === 'problem_solving') return <ProblemEditor item={item} readOnly={readOnly} onChange={onChange} />
  if (type === 'matching') return <MatchingEditor item={item} readOnly={readOnly} onChange={onChange} />
  if (type === 'essay' || type === 'constructed_response') return <ResponseEditor item={item} readOnly={readOnly} onChange={onChange} />
  return null
}

function ChoiceEditor({ item, readOnly, multi, onChange }: { item: AssessmentItem; readOnly: boolean; multi: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) {
  const answer = answerObject(item); const choices = array(answer.choices).map((entry, index) => { const value = object(entry); return { id: text(value.id) || String.fromCharCode(65 + index), text: text(value.text) } })
  const selected = array(answer.choiceIds).map(String)
  return <fieldset className="assessment-choice-editor"><legend>{multi ? 'Choices and all correct answers' : 'Choices and correct answer'}</legend><div className="assessment-choice-list">{choices.map((choice, index) => <div className="assessment-choice-row" key={choice.id}><input className={multi ? 'assessment-choice-checkbox' : 'assessment-choice-radio'} type={multi ? 'checkbox' : 'radio'} name={`correct-choice-${item.id}`} checked={multi ? selected.includes(choice.id) : String(answer.choiceId) === choice.id} disabled={readOnly} onChange={() => onChange((current) => { const next = answerObject(current); if (multi) { const ids = new Set(array(next.choiceIds).map(String)); ids.has(choice.id) ? ids.delete(choice.id) : ids.add(choice.id); return setAnswer(current, { type: 'multiple_select', choices: choices as AssessmentChoice[], choiceIds: [...ids], scoringPolicy: 'all_or_nothing' }) } return setAnswer(current, { type: 'multiple_choice', choices: choices as AssessmentChoice[], choiceId: choice.id }) })} aria-label={`Mark choice ${index + 1} correct`} /><span className="assessment-choice-letter">{String.fromCharCode(65 + index)}</span><input value={choice.text} disabled={readOnly} onChange={(event) => onChange((current) => { const nextChoices = choices.map((candidate) => candidate.id === choice.id ? { ...candidate, text: event.target.value } : candidate); return setAnswer(current, multi ? { type: 'multiple_select', choices: nextChoices, choiceIds: selected, scoringPolicy: 'all_or_nothing' } : { type: 'multiple_choice', choices: nextChoices, choiceId: String(answer.choiceId ?? '') }) })} placeholder={`Choice ${String.fromCharCode(65 + index)}`} aria-label={`Choice ${index + 1}`} /><button className="icon-button danger" type="button" disabled={readOnly || choices.length <= 2} onClick={() => onChange((current) => { const nextChoices = choices.filter((candidate) => candidate.id !== choice.id); return setAnswer(current, multi ? { type: 'multiple_select', choices: nextChoices, choiceIds: selected.filter((id) => id !== choice.id), scoringPolicy: 'all_or_nothing' } : { type: 'multiple_choice', choices: nextChoices, choiceId: String(answer.choiceId) === choice.id ? nextChoices[0]?.id ?? '' : String(answer.choiceId ?? '') }) })} aria-label={`Remove choice ${index + 1}`}><X size={15} /></button></div>)}</div><button className="button ghost assessment-add-choice" type="button" disabled={readOnly || choices.length >= 6} onClick={() => onChange((current) => setAnswer(current, multi ? { type: 'multiple_select', choices: [...choices, { id: makeId('choice'), text: '' }], choiceIds: selected, scoringPolicy: 'all_or_nothing' } : { type: 'multiple_choice', choices: [...choices, { id: makeId('choice'), text: '' }], choiceId: String(answer.choiceId ?? '') }))}><Plus size={15} /> Add choice</button><small className="assessment-field-help">Multiple select uses simple all-or-nothing scoring. No negative marking.</small></fieldset>
}

function AcceptedAnswerEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) { const answer = answerObject(item); const values = array(answer.acceptedAnswers).map(String); return <label className="assessment-question-field">Accepted answers <small>One answer or term per line; normalization remains conservative.</small><textarea rows={4} disabled={readOnly} value={values.join('\n')} onChange={(event) => onChange((current) => setAnswer(current, { type: current.questionType as 'short_answer' | 'identification', acceptedAnswers: event.target.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), caseSensitive: false }))} placeholder="Enter accepted answer variants" /></label> }

function FillEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) {
  const answer = answerObject(item)
  const blanks = array(answer.blanks).map((entry, index) => {
    const value = object(entry)
    return { id: text(value.id) || `blank-${index + 1}`, acceptedAnswers: array(value.acceptedAnswers).map(String), pointsPossible: value.pointsPossible === undefined ? undefined : number(value.pointsPossible, 1) }
  })
  return <fieldset className="assessment-choice-editor"><legend>Blank manager</legend><div className="assessment-fill-blanks">{blanks.map((blank, index) => <div className="assessment-fill-blank" key={blank.id}><strong>Blank {String.fromCharCode(65 + index)}</strong><input value={blank.acceptedAnswers.join('\n')} disabled={readOnly} onChange={(event) => onChange((current) => setAnswer(current, { type: 'fill_in_the_blank', blanks: blanks.map((candidate) => candidate.id === blank.id ? { ...candidate, acceptedAnswers: event.target.value.split(/\r?\n|;/).map((value) => value.trim()).filter(Boolean) } : candidate) }))} placeholder="Accepted answers, one per line" /><input type="number" min="0.1" step="0.5" value={blank.pointsPossible ?? ''} disabled={readOnly} onChange={(event) => onChange((current) => setAnswer(current, { type: 'fill_in_the_blank', blanks: blanks.map((candidate) => candidate.id === blank.id ? { ...candidate, pointsPossible: event.target.value === '' ? undefined : number(event.target.value, 1) } : candidate) }))} aria-label={`Points for blank ${index + 1}`} /><button className="icon-button danger" type="button" disabled={readOnly || blanks.length <= 1} onClick={() => onChange((current) => setAnswer(current, { type: 'fill_in_the_blank', blanks: blanks.filter((candidate) => candidate.id !== blank.id) }))} aria-label={`Remove blank ${index + 1}`}><X size={15} /></button></div>)}</div><button className="button ghost assessment-add-choice" type="button" disabled={readOnly || blanks.length >= 8} onClick={() => onChange((current) => { const usesBlankPoints = blanks.some((blank) => blank.pointsPossible !== undefined); const added = usesBlankPoints ? { id: makeId('blank'), acceptedAnswers: [] as string[], pointsPossible: 1 } : { id: makeId('blank'), acceptedAnswers: [] as string[] }; return setAnswer(current, { type: 'fill_in_the_blank', blanks: [...blanks, added] }) })}><Plus size={15} /> Add blank</button><small className="assessment-field-help">Write each blank in the prompt as ______. Blank points are optional; if used they must be entered for every blank and sum to the item points.</small></fieldset>
}

function NumericalEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) { const answer = answerObject(item); return <div className="assessment-two-field-grid"><label>Expected number<input type="number" step="any" disabled={readOnly} value={answer.value === undefined ? '' : String(answer.value)} onChange={(event) => onChange((current) => setAnswer(current, { type: 'numerical_answer', value: number(event.target.value, 0), tolerance: number(answer.tolerance, 0), ...(answer.unit ? { unit: text(answer.unit) } : {}), requireUnit: answer.requireUnit === true }))} /></label><label>Tolerance<input type="number" min="0" step="any" disabled={readOnly} value={answer.tolerance === undefined ? '' : String(answer.tolerance)} onChange={(event) => onChange((current) => setAnswer(current, { type: 'numerical_answer', value: number(answer.value, 0), tolerance: Math.max(0, number(event.target.value, 0)), ...(answer.unit ? { unit: text(answer.unit) } : {}), requireUnit: answer.requireUnit === true }))} /></label><label>Unit<input disabled={readOnly} value={text(answer.unit)} onChange={(event) => onChange((current) => setAnswer(current, { type: 'numerical_answer', value: number(answer.value, 0), tolerance: number(answer.tolerance, 0), unit: event.target.value, requireUnit: answer.requireUnit === true }))} placeholder="e.g. cm²" /></label><label className="assessment-inline-check"><input type="checkbox" checked={answer.requireUnit === true} disabled={readOnly} onChange={(event) => onChange((current) => setAnswer(current, { type: 'numerical_answer', value: number(answer.value, 0), tolerance: number(answer.tolerance, 0), ...(answer.unit ? { unit: text(answer.unit) } : {}), requireUnit: event.target.checked }))} /> Require unit</label></div> }

function ProblemEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) {
  const answer = answerObject(item)
  const subparts = array(answer.subparts).map((entry, index) => {
    const value = object(entry)
    return { id: text(value.id) || `part-${index + 1}`, prompt: text(value.prompt), expectedAnswer: value.expectedAnswer === undefined ? '' : value.expectedAnswer, pointsPossible: number(value.pointsPossible, 1) } as AssessmentSubpart
  })
  const write = (current: AssessmentItem, nextSubparts = subparts, patch: { finalAnswer?: string; solutionOutline?: string } = {}) => setAnswer(current, { type: 'problem_solving', finalAnswer: patch.finalAnswer ?? text(answer.finalAnswer), solutionOutline: patch.solutionOutline ?? text(answer.solutionOutline), ...(nextSubparts.length ? { subparts: nextSubparts } : {}) })
  return <div className="assessment-two-field-grid"><label>Expected final answer<textarea rows={2} disabled={readOnly} value={text(answer.finalAnswer)} onChange={(event) => onChange((current) => write(current, subparts, { finalAnswer: event.target.value }))} /></label><label>Solution outline / method<textarea rows={4} disabled={readOnly} value={text(answer.solutionOutline)} onChange={(event) => onChange((current) => write(current, subparts, { solutionOutline: event.target.value }))} placeholder="Expected steps for teacher scoring" /></label><fieldset className="assessment-subpart-editor"><legend>Optional subparts</legend>{subparts.map((part, index) => <div className="assessment-subpart-row assessment-subpart-detailed" key={part.id}><input value={part.prompt} disabled={readOnly} placeholder={`Part ${String.fromCharCode(97 + index)} prompt`} onChange={(event) => onChange((current) => write(current, subparts.map((candidate) => candidate.id === part.id ? { ...candidate, prompt: event.target.value } : candidate)))} /><input value={text(part.expectedAnswer)} disabled={readOnly} placeholder="Expected answer" onChange={(event) => onChange((current) => write(current, subparts.map((candidate) => candidate.id === part.id ? { ...candidate, expectedAnswer: event.target.value } : candidate)))} /><input type="number" min="0.1" step="0.5" value={part.pointsPossible} disabled={readOnly} onChange={(event) => onChange((current) => write(current, subparts.map((candidate) => candidate.id === part.id ? { ...candidate, pointsPossible: number(event.target.value, 1) } : candidate)))} aria-label={`Points for subpart ${index + 1}`} /><button className="icon-button danger" type="button" disabled={readOnly} onClick={() => onChange((current) => write(current, subparts.filter((candidate) => candidate.id !== part.id)))} aria-label={`Remove subpart ${index + 1}`}><X size={15} /></button></div>)}<button className="button ghost assessment-add-choice" type="button" disabled={readOnly || subparts.length >= 8} onClick={() => onChange((current) => write(current, [...subparts, { id: makeId('part'), prompt: '', expectedAnswer: '', pointsPossible: 1 }]))}><Plus size={15} /> Add subpart</button><small className="assessment-field-help">When subparts are used, their positive point values must total the item points.</small></fieldset></div>
}

function MatchingEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) {
  const answer = answerObject(item)
  const prompts: AssessmentMatchingPrompt[] = array(answer.prompts).map((entry, index) => { const value = object(entry); return { id: text(value.id) || `prompt-${index + 1}`, text: text(value.text) } })
  const choices: AssessmentMatchingChoice[] = array(answer.choices).map((entry, index) => { const value = object(entry); return { id: text(value.id) || String.fromCharCode(65 + index), text: text(value.text), ...(value.label ? { label: text(value.label) } : {}) } })
  const mappings: AssessmentMatchingMapping[] = array(answer.mappings).map((entry) => { const value = object(entry); return { promptId: text(value.promptId), choiceId: text(value.choiceId), ...(value.pointsPossible === undefined ? {} : { pointsPossible: number(value.pointsPossible, 1) }) } })
  const perMatch = answer.pointsPerMatch === undefined ? undefined : number(answer.pointsPerMatch, 1)
  const groupPoints = answer.groupPointsPossible === undefined ? undefined : number(answer.groupPointsPossible, pointsForItem(item))
  const move = <T,>(values: T[], index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= values.length) return values; const next = values.slice(); [next[index], next[target]] = [next[target], next[index]]; return next }
  const write = (current: AssessmentItem, nextPrompts: AssessmentMatchingPrompt[] = prompts, nextChoices: AssessmentMatchingChoice[] = choices, nextMappings: AssessmentMatchingMapping[] = mappings, reusable = answer.reusableChoices === true, perOverride?: number | null, groupOverride?: number | null) => {
    const nextPer = perOverride === undefined ? perMatch : perOverride === null ? undefined : perOverride
    const nextGroup = groupOverride === undefined ? groupPoints : groupOverride === null ? undefined : groupOverride
    return setAnswer(current, { type: 'matching', prompts: nextPrompts, choices: nextChoices, mappings: nextMappings, reusableChoices: reusable, ...(nextPer === undefined ? {} : { pointsPerMatch: nextPer }), ...(nextGroup === undefined ? {} : { groupPointsPossible: nextGroup }) })
  }
  return <fieldset className="assessment-choice-editor"><legend>Matching group</legend><div className="assessment-matching-columns"><div><strong>Column A prompts</strong>{prompts.map((prompt, index) => <div className="assessment-matching-entry" key={prompt.id}><input value={prompt.text} disabled={readOnly} placeholder={`Prompt ${index + 1}`} onChange={(event) => onChange((current) => write(current, prompts.map((candidate) => candidate.id === prompt.id ? { ...candidate, text: event.target.value } : candidate)))} /><button className="icon-button" type="button" disabled={readOnly || index === 0} onClick={() => onChange((current) => write(current, move(prompts, index, -1)))} aria-label={`Move prompt ${index + 1} up`}>↑</button><button className="icon-button" type="button" disabled={readOnly || index === prompts.length - 1} onClick={() => onChange((current) => write(current, move(prompts, index, 1)))} aria-label={`Move prompt ${index + 1} down`}>↓</button><button className="icon-button danger" type="button" disabled={readOnly || prompts.length <= 1} onClick={() => onChange((current) => write(current, prompts.filter((candidate) => candidate.id !== prompt.id), choices, mappings.filter((mapping) => mapping.promptId !== prompt.id)))} aria-label={`Remove prompt ${index + 1}`}><X size={15} /></button></div>)}<button className="button ghost assessment-add-choice" type="button" disabled={readOnly || prompts.length >= 12} onClick={() => onChange((current) => write(current, [...prompts, { id: makeId('prompt'), text: '' }]))}><Plus size={15} /> Add prompt</button></div><div><strong>Column B choices</strong>{choices.map((choice, index) => <div className="assessment-matching-entry" key={choice.id}><input value={choice.text} disabled={readOnly} placeholder={`Choice ${String.fromCharCode(65 + index)}`} onChange={(event) => onChange((current) => write(current, prompts, choices.map((candidate) => candidate.id === choice.id ? { ...candidate, text: event.target.value } : candidate)))} /><button className="icon-button" type="button" disabled={readOnly || index === 0} onClick={() => onChange((current) => write(current, prompts, move(choices, index, -1)))} aria-label={`Move choice ${index + 1} up`}>↑</button><button className="icon-button" type="button" disabled={readOnly || index === choices.length - 1} onClick={() => onChange((current) => write(current, prompts, move(choices, index, 1)))} aria-label={`Move choice ${index + 1} down`}>↓</button><button className="icon-button danger" type="button" disabled={readOnly || choices.length <= 1} onClick={() => onChange((current) => write(current, prompts, choices.filter((candidate) => candidate.id !== choice.id), mappings.filter((mapping) => mapping.choiceId !== choice.id)))} aria-label={`Remove choice ${index + 1}`}><X size={15} /></button></div>)}<button className="button ghost assessment-add-choice" type="button" disabled={readOnly || choices.length >= 16} onClick={() => onChange((current) => write(current, prompts, [...choices, { id: makeId('choice'), text: '' }]))}><Plus size={15} /> Add choice / distractor</button></div></div><div className="assessment-matching-mappings"><strong>Answer mapping and optional points</strong>{prompts.map((prompt) => { const mapping = mappings.find((entry) => entry.promptId === prompt.id); return <div className="assessment-matching-map-row" key={prompt.id}><label><span>{prompt.text || prompt.id}</span><select value={mapping?.choiceId ?? ''} disabled={readOnly} onChange={(event) => onChange((current) => { const retained = mappings.filter((entry) => entry.promptId !== prompt.id); const nextMappings = event.target.value ? [...retained, { promptId: prompt.id, choiceId: event.target.value, ...(mapping?.pointsPossible === undefined ? {} : { pointsPossible: mapping.pointsPossible }) }] : retained; return write(current, prompts, choices, nextMappings) })}><option value="">Choose match</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.id}. {choice.text}</option>)}</select></label><label>Match points<input type="number" min="0.1" step="0.5" value={mapping?.pointsPossible ?? ''} disabled={readOnly || !mapping} onChange={(event) => onChange((current) => { if (!mapping) return current; const nextMappings = mappings.map((entry) => entry.promptId === prompt.id ? { promptId: entry.promptId, choiceId: entry.choiceId, ...(event.target.value === '' ? {} : { pointsPossible: number(event.target.value, 1) }) } : entry); return write(current, prompts, choices, nextMappings, answer.reusableChoices === true, null, null) })} /></label></div> })}</div><div className="assessment-matching-controls"><label>Points per match (optional)<input type="number" min="0.1" step="0.5" value={perMatch ?? ''} disabled={readOnly} onChange={(event) => onChange((current) => { const nextPer = event.target.value === '' ? null : number(event.target.value, 1); const nextMappings = nextPer === null ? mappings : mappings.map((entry) => ({ promptId: entry.promptId, choiceId: entry.choiceId })); return write(current, prompts, choices, nextMappings, answer.reusableChoices === true, nextPer, nextPer === null ? undefined : null) })} /></label><span>Group total: {pointsForItem(item)} item points</span></div><label className="assessment-inline-check"><input type="checkbox" checked={answer.reusableChoices === true} disabled={readOnly} onChange={(event) => onChange((current) => write(current, prompts, choices, mappings, event.target.checked))} /> Allow reusable choices</label><small className="assessment-field-help">Each Column A response is scored separately. Use per-match points, one point value for every mapping, or leave both blank to divide the item total deterministically. Extra Column B choices are distractors; reuse is off by default.</small></fieldset>
}

function ResponseEditor({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) { const answer = answerObject(item); const criteria = rubricCriteria(answer); if (item.questionType === 'constructed_response') return <div className="assessment-two-field-grid"><label>Expected response<textarea rows={4} disabled={readOnly} value={text(answer.expectedResponse)} onChange={(event) => onChange((current) => setAnswer(current, { type: 'constructed_response', expectedResponse: event.target.value, sampleResponse: text(answer.sampleResponse), rubricGuidance: text(answer.rubricGuidance), rubric: criteria }))} /></label><label>Sample response<textarea rows={4} disabled={readOnly} value={text(answer.sampleResponse)} onChange={(event) => onChange((current) => setAnswer(current, { type: 'constructed_response', expectedResponse: text(answer.expectedResponse), sampleResponse: event.target.value, rubricGuidance: text(answer.rubricGuidance), rubric: criteria }))} /></label><label>Rubric / scoring guidance<textarea rows={3} disabled={readOnly} value={text(answer.rubricGuidance)} onChange={(event) => onChange((current) => setAnswer(current, { type: 'constructed_response', expectedResponse: text(answer.expectedResponse), sampleResponse: text(answer.sampleResponse), rubricGuidance: event.target.value, rubric: criteria }))} /></label><RubricEditor criteria={criteria} readOnly={readOnly} onChange={(next) => onChange((current) => setAnswer(current, { type: 'constructed_response', expectedResponse: text(answer.expectedResponse), sampleResponse: text(answer.sampleResponse), rubricGuidance: text(answer.rubricGuidance), rubric: next }))} /></div>; return <div className="assessment-two-field-grid"><label>Key points<textarea rows={5} disabled={readOnly} value={array(answer.keyPoints).map(String).join('\n')} onChange={(event) => onChange((current) => setAnswer(current, { type: 'essay', keyPoints: event.target.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), rubric: criteria, scoringNotes: text(answer.scoringNotes) }))} placeholder="One key point per line" /></label><label>Scoring notes<textarea rows={4} disabled={readOnly} value={text(answer.scoringNotes)} onChange={(event) => onChange((current) => setAnswer(current, { type: 'essay', keyPoints: array(answer.keyPoints).map(String), rubric: criteria, scoringNotes: event.target.value }))} /></label><RubricEditor criteria={criteria} readOnly={readOnly} onChange={(next) => onChange((current) => setAnswer(current, { type: 'essay', keyPoints: array(answer.keyPoints).map(String), rubric: next, scoringNotes: text(answer.scoringNotes) }))} /></div> }

function RubricEditor({ criteria, readOnly, onChange }: { criteria: AssessmentScoringCriterion[]; readOnly: boolean; onChange: (criteria: AssessmentScoringCriterion[]) => void }) { return <fieldset className="assessment-subpart-editor"><legend>Optional rubric criteria</legend>{criteria.map((criterion, index) => <div className="assessment-subpart-row" key={criterion.id}><input value={criterion.label} disabled={readOnly} placeholder={`Criterion ${index + 1}`} onChange={(event) => onChange(criteria.map((candidate) => candidate.id === criterion.id ? { ...candidate, label: event.target.value } : candidate))} /><input type="number" min="0.1" step="0.5" value={criterion.pointsPossible} disabled={readOnly} onChange={(event) => onChange(criteria.map((candidate) => candidate.id === criterion.id ? { ...candidate, pointsPossible: number(event.target.value, 0) } : candidate))} aria-label={`Points for ${criterion.label || `criterion ${index + 1}`}`} /><button className="icon-button danger" type="button" disabled={readOnly} onClick={() => onChange(criteria.filter((candidate) => candidate.id !== criterion.id))} aria-label={`Remove criterion ${index + 1}`}><X size={15} /></button></div>)}<button className="button ghost assessment-add-choice" type="button" disabled={readOnly || criteria.length >= 12} onClick={() => onChange([...criteria, { id: makeId('criterion'), label: '', pointsPossible: 1 }])}><Plus size={15} /> Add criterion</button><small className="assessment-field-help">If criteria are used, their positive point values must total the item points.</small></fieldset> }

function CommonFields({ item, readOnly, onChange }: { item: AssessmentItem; readOnly: boolean; onChange: (updater: (item: AssessmentItem) => AssessmentItem) => void }) { return <div className="assessment-common-fields"><label>Points possible<input type="number" min="0" step="1" disabled={readOnly} value={pointsForItem(item)} onChange={(event) => onChange((current) => ({ ...current, pointsPossible: Math.max(0, number(event.target.value, 0)), points: Math.max(0, number(event.target.value, 0)) }))} /></label><label>Rationale / answer explanation<textarea rows={3} disabled={readOnly} value={item.rationale ?? ''} onChange={(event) => onChange((current) => ({ ...current, rationale: event.target.value }))} placeholder="Optional teacher-facing rationale" /></label></div> }

function HistoryPanel({ item, readOnly, onRestore }: { item: AssessmentItem; readOnly: boolean; onRestore: (index: number) => void }) { const history = array(object(item).history); if (!history.length) return null; return <details className="assessment-history"><summary>Previous versions ({history.length})</summary>{history.map((entry, index) => <div className="assessment-history-row" key={`${index}-${text(object(entry).id)}`}><span>{text(object(entry).source) || 'Saved version'} · {text(object(entry).savedAt)}</span><button className="button ghost" type="button" disabled={readOnly} onClick={() => onRestore(index)}><RotateCcw size={14} /> Restore</button></div>)}</details> }

function SuggestionPreview({ suggestion, onAccept }: { suggestion: AssessmentItemSuggestion; onAccept: () => void }) { const answer = suggestion.candidate.answer as unknown as UnknownRecord; return <div className="assessment-suggestion-preview"><div className="assessment-suggestion-heading"><div><span className={`assessment-state-chip ${suggestion.qaState ?? 'ai_suggestion'}`}>{suggestion.qaState === 'verified' ? 'Accuracy checked' : suggestion.qaState === 'needs_review' ? 'Needs teacher review' : 'AI suggestion'}</span><strong>Preview only · {suggestion.requestsUsed ?? 1} request{suggestion.requestsUsed === 1 ? '' : 's'}</strong></div><button className="button primary" type="button" onClick={onAccept}><Check size={15} /> Accept & lock</button></div><p>{suggestion.candidate.prompt}</p>{suggestion.candidate.visual && <AssessmentDiagram visual={suggestion.candidate.visual} className="assessment-suggestion-visual" />}{suggestion.candidate.questionType === 'multiple_choice' && <ol type="A">{array(answer.choices).map((choice, index) => <li key={index}>{text(object(choice).text)}</li>)}</ol>}{suggestion.candidate.questionType === 'matching' && <small>Matching group with {array(answer.prompts).length} prompts and {array(answer.choices).length} choices.</small>}{suggestion.candidate.questionType === 'essay' && <small>Teacher-scored essay · see key points and rubric.</small>}{suggestion.verifier?.issues?.length ? <small>Review: {suggestion.verifier.issues.join(' · ')}</small> : null}</div> }
