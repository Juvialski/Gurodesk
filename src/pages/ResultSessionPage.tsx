import { Archive, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CircleAlert, FileUp, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnswerButtons } from '../components/results/AnswerButtons'
import { LearnerPicker } from '../components/results/LearnerPicker'
import { ResultMetric } from '../components/results/ResultMetric'
import { ResultsImportPanel } from '../components/results/ResultsImportPanel'
import { RubricScoringGrid } from '../components/results/RubricScoringGrid'
import { useApp } from '../contexts/AppContext'
import { normalizeImportKey } from '../lib/resultsImport'
import { archiveResultSession, deleteDraftResultSession, loadResultSession, saveResultSession } from '../lib/resultsRepository'
import { calculateResultTotals, calculateRubricTotals, calculateScoreOnlyTotals, formatScore, itemPossiblePoints, resultItemNumberLabel, scoreResultItem } from '../lib/resultsScoring'
import { validateResultSession } from '../lib/resultsValidation'
import type { LearnerItemAnswer, AssessmentResultSession, ResultAssessmentItemSnapshot, ResultItemOutcome, ResultRubricCriterionScore, ResultRubricOutcome, ScoreOnlyOutcome } from '../types/results'

const RESULT_AUTOSAVE_DELAY_MS = 1500

function itemOutcome(session: AssessmentResultSession, participantId: string, itemId: string) {
  return session.itemOutcomes.find((outcome) => outcome.participantId === participantId && outcome.itemId === itemId)
}

function scoreOutcome(session: AssessmentResultSession, participantId: string) {
  return session.scoreOnlyOutcomes.find((outcome) => outcome.participantId === participantId)
}

function rubricOutcome(session: AssessmentResultSession, participantId: string) {
  return (session.rubricOutcomes || []).find((outcome) => outcome.participantId === participantId)
}

function answerFromImportedValue(item: ResultAssessmentItemSnapshot, value: string | null): LearnerItemAnswer | null {
  const raw = value?.normalize('NFKC').trim() ?? ''
  if (!raw) return null
  if (item.questionType === 'multiple_choice' && item.answer.type === 'multiple_choice') {
    const letter = raw.toLocaleUpperCase('en-US')
    const byLetter = item.answer.choices[letter.charCodeAt(0) - 65]
    const byId = item.answer.choices.find((choice) => choice.id === raw)
    return byId ? { type: 'multiple_choice', choiceId: byId.id } : byLetter ? { type: 'multiple_choice', choiceId: byLetter.id } : null
  }
  if (item.questionType === 'true_false') {
    const normalized = raw.toLocaleLowerCase('en-US')
    if (['true', 't', 'yes', 'y', '1'].includes(normalized)) return { type: 'true_false', value: true }
    if (['false', 'f', 'no', 'n', '0'].includes(normalized)) return { type: 'true_false', value: false }
    return null
  }
  if (item.questionType === 'short_answer') return { type: 'short_answer', text: raw }
  if (item.questionType === 'identification') return { type: 'identification', text: raw }
  if (item.questionType === 'fill_in_the_blank') {
    const blankIds = item.answer.type === 'fill_in_the_blank' ? item.answer.blanks.map((blank) => blank.id) : []
    const values = raw.split('|').map((entry) => entry.trim())
    return { type: 'fill_in_the_blank', blanks: Object.fromEntries(blankIds.map((blankId, index) => [blankId, values[index] ?? ''])) }
  }
  if (item.questionType === 'numerical_answer') {
    const match = /^(?<value>[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:\s+(?<unit>.*))?$/iu.exec(raw)
    const numeric = Number(match?.groups?.value ?? raw)
    return Number.isFinite(numeric) ? { type: 'numerical_answer', value: numeric, unit: match?.groups?.unit?.trim() || undefined } : null
  }
  if (item.questionType === 'multiple_select' && item.answer.type === 'multiple_select') {
    const selectAnswer = item.answer
    const selected = raw.split(/[,;|]/).map((entry) => entry.trim()).filter(Boolean).map((entry) => {
      const letter = entry.toLocaleUpperCase('en-US')
      return selectAnswer.choices[letter.charCodeAt(0) - 65]?.id ?? entry
    })
    return { type: 'multiple_select', choiceIds: [...new Set(selected)] }
  }
  if (item.questionType === 'matching' && item.answer.type === 'matching') {
    const matches: Record<string, string> = {}
    for (const entry of raw.split(/[,;|]/).map((part) => part.trim()).filter(Boolean)) {
      const [promptKey, choiceKey] = entry.split(/\s*(?:=|→|->)\s*/u)
      const prompt = item.answer.prompts.find((candidate, index) => candidate.id === promptKey || String(index + 1) === promptKey)
      const letter = choiceKey?.toLocaleUpperCase('en-US') ?? ''
      const choice = item.answer.choices.find((candidate, index) => candidate.id === choiceKey || String.fromCharCode(65 + index) === letter)
      if (prompt && choice) matches[prompt.id] = choice.id
    }
    return Object.keys(matches).length ? { type: 'matching', matches } : null
  }
  if (item.questionType === 'problem_solving') return { type: 'problem_solving', solution: raw }
  if (item.questionType === 'essay') return { type: 'essay', text: raw }
  return { type: 'constructed_response', text: raw }
}

function teacherResponseMarker(item: ResultAssessmentItemSnapshot): LearnerItemAnswer | null {
  if (item.questionType === 'constructed_response') return { type: 'constructed_response' }
  if (item.questionType === 'short_answer') return { type: 'short_answer', text: '' }
  if (item.questionType === 'problem_solving') return { type: 'problem_solving' }
  if (item.questionType === 'essay') return { type: 'essay' }
  return null
}

function preserveTeacherAttempt(item: ResultAssessmentItemSnapshot, existing: ResultItemOutcome | undefined, answer: LearnerItemAnswer | null) {
  if (answer !== null) return answer
  if ((existing?.earnedPoints ?? 0) > 0 || Boolean(existing?.teacherFeedback?.trim())) return teacherResponseMarker(item)
  return null
}

export function ResultSessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, isDemo } = useApp()
  const [session, setSession] = useState<AssessmentResultSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeParticipantIndex, setActiveParticipantIndex] = useState(0)
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved')
  const dirtyRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef<AssessmentResultSession | null>(null)
  const pendingSaveRef = useRef<AssessmentResultSession | null>(null)
  const pendingSaveStatusRef = useRef<'draft' | 'final'>('draft')
  const saveBusyRef = useRef(false)
  const drainPromiseRef = useRef<Promise<void> | null>(null)
  const saveFailureRef = useRef<string | null>(null)
  const userRef = useRef(user)
  const demoRef = useRef(isDemo)
  userRef.current = user
  demoRef.current = isDemo

  useEffect(() => {
    if (!user || !id) return
    let active = true
    setLoading(true)
    void loadResultSession(id, user.id, isDemo)
      .then((nextSession) => {
        if (!active) return
        if (!nextSession) throw new Error('Result session not found or you do not have access to it.')
        setSession(nextSession)
        sessionRef.current = nextSession
        pendingSaveRef.current = null
        pendingSaveStatusRef.current = 'draft'
        setActiveParticipantIndex(0)
        setActiveItemIndex(0)
        dirtyRef.current = false
        setSaveState('saved')
      })
      .catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to open this result session.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, isDemo, user?.id])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !pendingSaveRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      void drainSaves()
    }
  }, [])

  const items = useMemo(() => session?.assessmentSnapshot.items ?? [], [session?.assessmentSnapshot.items])
  const participants = useMemo(() => session?.learners ?? [], [session?.learners])
  const activeParticipant = participants[activeParticipantIndex] ?? participants[0] ?? null
  const activeItem = items[activeItemIndex] ?? items[0] ?? null
  const readOnly = session?.status !== 'draft'
  const isRubricMode = session?.entryMode === 'rubric'
  const rubric = session?.rubricSnapshot

  const encodedParticipantIds = useMemo(() => {
    if (!session) return new Set<string>()
    if (session.entryMode === 'score_only') {
      return new Set(session.scoreOnlyOutcomes.filter((outcome) => outcome.rawScore !== null).map((outcome) => outcome.participantId))
    }
    if (isRubricMode) {
      return new Set((session.rubricOutcomes || []).filter((outcome) => outcome.criteriaScores.length > 0).map((outcome) => outcome.participantId))
    }
    return new Set(session.itemOutcomes.filter((outcome) => outcome.answer !== null).map((outcome) => outcome.participantId))
  }, [session, isRubricMode])

  const responsesEntered = useMemo(() => {
    if (!session) return 0
    if (session.entryMode === 'score_only') return session.scoreOnlyOutcomes.filter((outcome) => outcome.rawScore !== null).length
    if (isRubricMode) return (session.rubricOutcomes || []).filter((outcome) => outcome.criteriaScores.length > 0).length
    return session.itemOutcomes.filter((outcome) => outcome.answer !== null).length
  }, [session, isRubricMode])

  const responseSlots = isRubricMode
    ? participants.length * (rubric?.criteria?.length || 1)
    : participants.length * Math.max(1, session?.assessmentSnapshot.totalItems ?? items.length)

  const missingResponses = isRubricMode
    ? participants.length - encodedParticipantIds.size
    : session?.entryMode === 'score_only'
      ? participants.length - encodedParticipantIds.size
      : Math.max(0, responseSlots - responsesEntered)

  const currentTotals = useMemo(() => {
    if (!session || !activeParticipant) return { rawScore: 0, possiblePoints: session?.assessmentSnapshot.totalPossiblePoints ?? 0, percentage: null, attemptedItems: 0, omittedItems: 0, correctItems: 0, incorrectItems: 0, teacherScoredItems: 0, deterministicItems: 0 }
    if (isRubricMode) {
      const activeOutcome = rubricOutcome(session, activeParticipant.participantId)
      return calculateRubricTotals(activeOutcome, rubric?.totalPoints || session.assessmentSnapshot.totalPossiblePoints)
    }
    if (session.entryMode === 'score_only') {
      const outcome = scoreOutcome(session, activeParticipant.participantId)
      return calculateScoreOnlyTotals(outcome?.rawScore ?? null, session.assessmentSnapshot.totalPossiblePoints)
    }
    const outcomes = session.itemOutcomes.filter((outcome) => outcome.participantId === activeParticipant.participantId)
    return calculateResultTotals(outcomes, session.assessmentSnapshot.totalPossiblePoints)
  }, [session, activeParticipant, isRubricMode, rubric])

  function markDirty() {
    dirtyRef.current = true
    setSaveState('pending')
  }

  function queueSave(nextSession: AssessmentResultSession) {
    if (readOnly || !user) return
    markDirty()
    sessionRef.current = nextSession
    pendingSaveRef.current = nextSession
    if (pendingSaveStatusRef.current !== 'final') pendingSaveStatusRef.current = 'draft'
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { saveTimerRef.current = null; void drainSaves() }, RESULT_AUTOSAVE_DELAY_MS)
  }

  async function drainSaves() {
    const currentUser = userRef.current
    if (!currentUser) return
    if (saveBusyRef.current) {
      if (drainPromiseRef.current) await drainPromiseRef.current
      return
    }
    saveBusyRef.current = true
    saveFailureRef.current = null
    const work = (async () => {
      while (pendingSaveRef.current) {
        const nextSession = pendingSaveRef.current
        const status = pendingSaveStatusRef.current
        pendingSaveRef.current = null
        setSaveState('saving')
        try {
          const saved = await saveResultSession({
            session: nextSession,
            outcomes: nextSession.itemOutcomes,
            scoreOnlyOutcomes: nextSession.scoreOnlyOutcomes,
            rubricOutcomes: nextSession.rubricOutcomes,
          }, currentUser.id, demoRef.current, status)
          const newer = pendingSaveRef.current as AssessmentResultSession | null
          if (newer) {
            const rebased = { ...newer, versionNumber: saved.versionNumber, createdAt: saved.createdAt, updatedAt: newer.updatedAt }
            pendingSaveRef.current = rebased
            sessionRef.current = rebased
            setSession(rebased)
          } else {
            sessionRef.current = saved
            setSession(saved)
            dirtyRef.current = false
            setSaveState('saved')
          }
        } catch (nextError) {
          const failure = nextError instanceof Error ? nextError.message : 'Draft save failed.'
          saveFailureRef.current = failure
          if (!pendingSaveRef.current) pendingSaveRef.current = sessionRef.current ?? nextSession
          setSaveState('error')
          setError(failure)
          break
        }
      }
    })()
    drainPromiseRef.current = work
    try { await work } finally {
      saveBusyRef.current = false
      drainPromiseRef.current = null
    }
  }

  function updateRubricOutcomes(updatedOutcomes: ResultRubricOutcome[]) {
    if (!session || readOnly) return
    const nextSession: AssessmentResultSession = {
      ...session,
      rubricOutcomes: updatedOutcomes,
      updatedAt: new Date().toISOString(),
    }
    setSession(nextSession)
    queueSave(nextSession)
  }

  function updateItemOutcome(participantId: string, item: ResultAssessmentItemSnapshot, answer: LearnerItemAnswer | null, awardedPoints?: number | null, teacherFeedback?: string | null) {
    if (!session || readOnly) return
    const existing = itemOutcome(session, participantId, item.id)
    const participant = participants.find((candidate) => candidate.participantId === participantId)
    if (!participant) return
    const mode = session.shortAnswerScoring.itemModes[item.id] ?? session.shortAnswerScoring.defaultMode
    const nextOutcome = scoreResultItem({
      resultSessionId: session.id,
      participantId,
      learnerId: participant.learnerId,
      item,
      answer,
      awardedPoints: awardedPoints === undefined ? existing?.earnedPoints ?? null : awardedPoints,
      teacherFeedback: teacherFeedback === undefined ? existing?.teacherFeedback ?? null : teacherFeedback,
      shortAnswerMode: mode,
    })
    const nextSession = { ...session, itemOutcomes: [...session.itemOutcomes.filter((outcome) => !(outcome.participantId === participantId && outcome.itemId === item.id)), nextOutcome], updatedAt: new Date().toISOString() }
    setSession(nextSession)
    queueSave(nextSession)
  }

  function handleItemModeResponseChange(participantId: string, item: ResultAssessmentItemSnapshot, answer: LearnerItemAnswer | null) {
    updateItemOutcome(participantId, item, answer)
    if (autoAdvance && answer !== null && (item.questionType === 'multiple_choice' || item.questionType === 'true_false')) {
      const pIdx = participants.findIndex((p) => p.participantId === participantId)
      if (pIdx >= 0 && pIdx < participants.length - 1) {
        const nextParticipant = participants[pIdx + 1]
        setTimeout(() => {
          const nextRow = document.querySelector(`[data-participant-id="${nextParticipant.participantId}"]`) as HTMLElement | null
          const targetBtn = nextRow?.querySelector('button:not([disabled])') as HTMLElement | null
          if (targetBtn) {
            targetBtn.focus()
          }
        }, 40)
      }
    }
  }

  function updateScoreOnly(participantId: string, value: string) {
    if (!session || readOnly) return
    const participant = participants.find((candidate) => candidate.participantId === participantId)
    if (!participant) return
    const possiblePoints = session.assessmentSnapshot.totalPossiblePoints
    const rawScore = value.trim() === '' ? null : Math.max(0, Math.min(possiblePoints, Number(value)))
    const nextScore: ScoreOnlyOutcome = { participantId, learnerId: participant.learnerId, rawScore: Number.isFinite(rawScore) ? rawScore : null, possiblePoints, teacherFeedback: scoreOutcome(session, participantId)?.teacherFeedback ?? null, updatedAt: new Date().toISOString() }
    const nextSession = { ...session, scoreOnlyOutcomes: [...session.scoreOnlyOutcomes.filter((outcome) => outcome.participantId !== participantId), nextScore], updatedAt: new Date().toISOString() }
    setSession(nextSession)
    queueSave(nextSession)
  }

  function toggleShortAnswerMode(itemId: string) {
    if (!session || readOnly) return
    const current = session.shortAnswerScoring.itemModes[itemId] ?? session.shortAnswerScoring.defaultMode
    const nextMode = current === 'manual' ? 'normalized_exact' : 'manual'
    const nextItemModes: AssessmentResultSession['shortAnswerScoring']['itemModes'] = { ...session.shortAnswerScoring.itemModes, [itemId]: nextMode }
    const item = items.find((candidate) => candidate.id === itemId)
    const nextOutcomes = item
      ? session.itemOutcomes.map((outcome) => {
        if (outcome.itemId !== itemId || outcome.answer === null) return outcome
        const nextParticipant = participants.find((participant) => participant.participantId === outcome.participantId)
        if (!nextParticipant) return outcome
        return scoreResultItem({ resultSessionId: session.id, participantId: outcome.participantId, learnerId: nextParticipant.learnerId, item, answer: outcome.answer, awardedPoints: outcome.earnedPoints, teacherFeedback: outcome.teacherFeedback, shortAnswerMode: nextMode })
      })
      : session.itemOutcomes
    const nextSession: AssessmentResultSession = { ...session, shortAnswerScoring: { ...session.shortAnswerScoring, itemModes: nextItemModes }, itemOutcomes: nextOutcomes }
    setSession(nextSession)
    queueSave(nextSession)
  }

  async function save(status: 'draft' | 'final') {
    if (!user || !session) return
    if (status === 'final') {
      const validation = validateResultSession(session)
      if (!validation.ready) {
        setError(validation.errors.map((e) => e.message).join('. '))
        return
      }
    }
    pendingSaveStatusRef.current = status
    setSaving(true)
    setError('')
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      pendingSaveRef.current = session
      await drainSaves()
      if (saveFailureRef.current) throw new Error(saveFailureRef.current)
      setMessage(status === 'final' ? 'Result session finalized and locked.' : 'Result draft saved.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save results.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDraft() {
    if (!user || !session || session.status !== 'draft') return
    if (!window.confirm('Delete this draft result session? Encoded responses will be removed.')) return
    setSaving(true)
    try {
      await deleteDraftResultSession(session.id, user.id, isDemo)
      navigate('/results')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to delete draft.')
      setSaving(false)
    }
  }

  async function archiveFinal() {
    if (!user || !session || session.status !== 'final') return
    if (!window.confirm('Archive this result session? It will be moved to archived history.')) return
    setSaving(true)
    try {
      const archived = await archiveResultSession(session.id, user.id, isDemo)
      if (archived) setSession(archived)
      navigate('/results')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to archive result session.')
      setSaving(false)
    }
  }

  function applyImport(preview: import('../lib/resultsImport').ResultsImportPreview) {
    if (!session || readOnly) return false
    const byDisplayName = new Map<string, typeof participants>()
    const byReference = new Map<string, typeof participants>()
    for (const participant of participants) {
      const displayKey = normalizeImportKey(participant.displayName)
      const referenceKey = normalizeImportKey(participant.localReference)
      byDisplayName.set(displayKey, [...(byDisplayName.get(displayKey) ?? []), participant])
      if (referenceKey) byReference.set(referenceKey, [...(byReference.get(referenceKey) ?? []), participant])
    }
    function resolveLearner(key: string) {
      const candidates = new Map<string, typeof participants[number]>()
      for (const participant of [...(byDisplayName.get(normalizeImportKey(key)) ?? []), ...(byReference.get(normalizeImportKey(key)) ?? [])]) candidates.set(participant.participantId, participant)
      if (candidates.size !== 1) return { participant: null, ambiguous: candidates.size > 1 || (byDisplayName.get(normalizeImportKey(key))?.length ?? 0) > 1 || (byReference.get(normalizeImportKey(key))?.length ?? 0) > 1 }
      return { participant: [...candidates.values()][0], ambiguous: false }
    }
    const resolvedRows: Array<{ row: import('../lib/resultsImport').ResultsImportPreviewRow; participant: typeof participants[number] }> = []
    const missing: string[] = []
    const ambiguous: string[] = []
    for (const row of preview.rows) {
      const resolved = resolveLearner(row.learnerKey)
      if (!resolved.participant) {
        (resolved.ambiguous ? ambiguous : missing).push(row.learnerKey)
      } else resolvedRows.push({ row, participant: resolved.participant })
    }
    if (missing.length || ambiguous.length) {
      const issues = [missing.length ? `Not found: ${missing.join(', ')}` : '', ambiguous.length ? `Ambiguous: ${ambiguous.join(', ')}` : ''].filter(Boolean)
      setMessage(`Import not applied. Correct every learner mapping first. ${issues.join('. ')}.`)
      return false
    }
    const importedOutcomes: ResultItemOutcome[] = []
    const importedScores: ScoreOnlyOutcome[] = []
    const mappedItemNumbers = new Set(Object.values(preview.mapping.itemColumns))
    for (const { row, participant } of resolvedRows) {
      if (session.entryMode === 'score_only') {
        const rawScore = row.rawScore === null || row.rawScore.trim() === '' ? null : Number(row.rawScore)
        importedScores.push({ participantId: participant.participantId, learnerId: participant.learnerId, rawScore: Number.isFinite(rawScore) ? rawScore : null, possiblePoints: session.assessmentSnapshot.totalPossiblePoints, teacherFeedback: scoreOutcome(session, participant.participantId)?.teacherFeedback ?? null, updatedAt: new Date().toISOString() })
      } else {
        for (const item of items) {
          if (!mappedItemNumbers.has(item.itemNumber)) continue
          const existing = itemOutcome(session, participant.participantId, item.id)
          const answer = preserveTeacherAttempt(item, existing, answerFromImportedValue(item, row.answers[item.itemNumber] ?? null))
          importedOutcomes.push(scoreResultItem({ resultSessionId: session.id, participantId: participant.participantId, learnerId: participant.learnerId, item, answer, awardedPoints: existing?.earnedPoints ?? null, teacherFeedback: existing?.teacherFeedback ?? null, shortAnswerMode: session.shortAnswerScoring.itemModes[item.id] ?? session.shortAnswerScoring.defaultMode }))
        }
      }
    }
    const importedOutcomeKeys = new Set(importedOutcomes.map((outcome) => `${outcome.participantId}:${outcome.itemId}`))
    if (importedOutcomeKeys.size === 0 && importedScores.length === 0) {
      setMessage('No mapped result values were available to stage.')
      return false
    }
    const nextSession = { ...session, itemOutcomes: [...session.itemOutcomes.filter((outcome) => !importedOutcomeKeys.has(`${outcome.participantId}:${outcome.itemId}`)), ...importedOutcomes], scoreOnlyOutcomes: session.entryMode === 'score_only' ? [...session.scoreOnlyOutcomes.filter((outcome) => !importedScores.some((imported) => imported.participantId === outcome.participantId)), ...importedScores] : session.scoreOnlyOutcomes, updatedAt: new Date().toISOString() }
    setSession(nextSession); queueSave(nextSession)
    setMessage('Import staged in the local draft and queued for batch save. Unmapped item outcomes were preserved.')
    return true
  }

  if (loading) return <div className="panel results-loading"><span className="loader" /><strong>Opening result session…</strong></div>
  if (!session) return <div className="form-message error results-alert">{error || 'Result session unavailable.'}</div>

  const renderItemEditor = (participantId: string, item: ResultAssessmentItemSnapshot) => {
    if (item.id !== activeItem?.id) return null
    const outcome = itemOutcome(session, participantId, item.id)
    const mode = session.shortAnswerScoring.itemModes[item.id] ?? session.shortAnswerScoring.defaultMode
    const constructed = item.questionType === 'constructed_response' || item.questionType === 'problem_solving' || item.questionType === 'essay'
    const manualShort = item.questionType === 'short_answer' && mode === 'manual'
    const teacherScored = constructed || manualShort
    const responsePresent = Boolean(outcome?.answer)
    const preserveAnswer = (answer: LearnerItemAnswer | null) => teacherScored ? preserveTeacherAttempt(item, outcome, answer) : answer
    const toggleResponse = () => updateItemOutcome(participantId, item, responsePresent && (outcome?.earnedPoints ?? 0) <= 0 ? null : teacherResponseMarker(item), outcome?.earnedPoints ?? null, outcome?.teacherFeedback ?? null)
    const possiblePoints = itemPossiblePoints(item)
    return <article className="results-item-card" key={`${participantId}-${item.id}`}><div className="results-item-heading"><div><span className="results-item-number">{resultItemNumberLabel(item)}</span><span className="results-item-type">{item.questionType.replaceAll('_', ' ')}</span></div><span className="results-points-label">{formatScore(possiblePoints)} pt{possiblePoints === 1 ? '' : 's'}</span></div><p className="results-item-prompt">{item.prompt}</p>{item.questionType === 'short_answer' && <button className={`results-mode-toggle ${mode === 'normalized_exact' ? 'selected' : ''}`} type="button" disabled={readOnly} onClick={() => toggleShortAnswerMode(item.id)}><ShieldCheck size={14} /> {mode === 'normalized_exact' ? 'Normalized exact matching on' : 'Manual short-answer scoring'}<small>{mode === 'normalized_exact' ? 'NFKC + trim + whitespace; no semantic AI matching' : 'Teacher awards points; deterministic comparison is off'}</small></button>}<AnswerButtons item={item} value={outcome?.answer ?? null} disabled={readOnly} onChange={(answer) => updateItemOutcome(participantId, item, preserveAnswer(answer))} />{teacherScored && <div className="results-teacher-score"><button className="results-response-marker" type="button" disabled={readOnly || (responsePresent && (outcome?.earnedPoints ?? 0) > 0)} onClick={toggleResponse}>{responsePresent ? 'Response present' : 'Mark response present'}<small>{responsePresent && (outcome?.earnedPoints ?? 0) > 0 ? 'Awarded points keep this marker.' : 'Transcription is optional.'}</small></button><label>Awarded points<input type="number" inputMode="decimal" min="0" max={possiblePoints} step="0.01" value={outcome?.earnedPoints ?? ''} disabled={readOnly} onChange={(event) => updateItemOutcome(participantId, item, teacherResponseMarker(item) && preserveTeacherAttempt(item, outcome, teacherResponseMarker(item)), event.target.value === '' ? null : Number(event.target.value), outcome?.teacherFeedback ?? null)} /></label><label>Teacher feedback <span className="label-optional">optional</span><textarea value={outcome?.teacherFeedback ?? ''} disabled={readOnly} placeholder="Feedback stays with this result record" onChange={(event) => updateItemOutcome(participantId, item, teacherResponseMarker(item) && preserveTeacherAttempt(item, outcome, teacherResponseMarker(item)), outcome?.earnedPoints ?? 0, event.target.value)} /></label></div>}<div className="results-outcome-note">{outcome?.answer === null || !outcome ? 'Not answered yet' : outcome.isCorrect === true ? 'Correct · deterministic' : outcome.isCorrect === false ? 'Incorrect · deterministic' : 'Teacher-scored · correctness not inferred'}</div></article>
  }

  return <>
    <div className="results-sticky-actions"><div><Link className="text-link" to="/results"><ArrowLeft size={15} /> Results</Link><strong>{session.title}</strong><small>{session.assessmentSnapshot.assessmentTitle} · {session.sectionName}</small></div><div className="results-save-actions"><span className={`results-save-state ${saveState}`}>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'pending' ? 'Draft pending' : 'Save error'}</span>{session.status === 'draft' && <><button className="button ghost" type="button" disabled={saving} onClick={() => void save('draft')}><Save size={15} /> Save draft</button><button className="button primary" type="button" disabled={saving} onClick={() => void save('final')}><Check size={15} /> Finalize</button><button className="button ghost danger" type="button" disabled={saving} onClick={() => void deleteDraft()}><Trash2 size={15} /> Delete draft</button></>}{session.status === 'final' && <button className="button ghost" type="button" disabled={saving} onClick={() => void archiveFinal()}><Archive size={15} /> Archive history</button>}</div></div>
    {error && <div className="form-message error results-alert">{error}</div>}{message && <div className="form-message results-alert">{message}</div>}
    <section className="results-session-intro"><div><span className={`results-status ${session.status}`}>{session.status}</span><h1>{session.title}</h1><p>{session.assessmentSnapshot.assessmentTitle} · {isRubricMode ? `${rubric?.criteria?.length || 0} criteria` : `${session.assessmentSnapshot.totalItems} items`} · {session.assessmentSnapshot.totalPossiblePoints} possible points</p></div>{!isRubricMode && <ResultsImportPanel mode={session.entryMode} sectionName={session.sectionName} itemCount={session.assessmentSnapshot.totalItems} possiblePoints={session.assessmentSnapshot.totalPossiblePoints} items={items} onConfirm={applyImport} />}</section>
    <section className="results-metric-grid compact"><ResultMetric label="Learners encoded" value={encodedParticipantIds.size} hint={`of ${participants.length}`} tone="green" /><ResultMetric label="Responses" value={responsesEntered} hint={isRubricMode ? 'rubric scored' : session.entryMode === 'score_only' ? 'scores entered' : `of ${responseSlots}`} /><ResultMetric label="Missing" value={missingResponses} hint="not answered" tone={missingResponses ? 'amber' : 'green'} /><ResultMetric label="Current learner" value={activeParticipant ? `${formatScore(currentTotals.rawScore)}/${formatScore(currentTotals.possiblePoints)}` : '—'} hint={currentTotals.percentage === null ? 'percentage unavailable' : `${currentTotals.percentage}%`} tone="slate" /></section>

    {isRubricMode && rubric && (
      <div className="results-rubric-workspace">
        <RubricScoringGrid
          rubric={rubric}
          learners={participants}
          outcomes={session.rubricOutcomes || []}
          onChange={updateRubricOutcomes}
          disabled={readOnly}
        />
      </div>
    )}

    {!isRubricMode && session.entryMode === 'answer_sheet' && <div className="results-workspace"><aside className="panel results-picker-panel"><div className="results-section-heading compact"><div><h2>Learners</h2><p>Choose one, then enter answers rapidly.</p></div></div><LearnerPicker learners={participants} activeParticipantId={activeParticipant?.participantId ?? ''} encodedParticipantIds={encodedParticipantIds} onSelect={(participantId) => { const index = participants.findIndex((participant) => participant.participantId === participantId); if (index >= 0) setActiveParticipantIndex(index) }} /></aside><main className="results-encoding-main"><div className="results-item-nav" aria-label="Assessment items">{items.map((item, index) => <button className={index === activeItemIndex ? 'selected' : ''} type="button" key={item.id} onClick={() => setActiveItemIndex(index)}>{resultItemNumberLabel(item)}<small>{itemOutcome(session, activeParticipant?.participantId ?? '', item.id)?.answer ? 'done' : 'empty'}</small></button>)}</div><div className="results-next-actions" aria-label="Assessment item navigation"><button className="button secondary" type="button" disabled={activeItemIndex <= 0} onClick={() => setActiveItemIndex((index) => Math.max(0, index - 1))}>Previous item <ChevronLeft size={15} /></button><button className="button secondary" type="button" disabled={activeItemIndex >= items.length - 1} onClick={() => setActiveItemIndex((index) => Math.min(items.length - 1, index + 1))}>Next item <ChevronRight size={15} /></button></div><div className="results-progress-banner"><div><strong>{activeParticipant?.displayName}</strong><small>{activeParticipantIndex + 1} of {participants.length} learners · {currentTotals.attemptedItems}/{items.length} attempted</small></div><div className="results-progress-track"><span style={{ width: `${items.length ? Math.min(100, currentTotals.attemptedItems / items.length * 100) : 0}%` }} /></div><div className="results-next-actions"><button className="icon-button" type="button" disabled={activeParticipantIndex <= 0} onClick={() => setActiveParticipantIndex((index) => Math.max(0, index - 1))} aria-label="Previous learner"><ChevronLeft size={18} /></button><button className="button secondary" type="button" onClick={() => setActiveParticipantIndex((index) => Math.min(participants.length - 1, index + 1))}>Next learner <ChevronRight size={15} /></button></div></div><div className="results-item-list">{items.map((item) => renderItemEditor(activeParticipant?.participantId ?? '', item))}</div></main></div>}
    {!isRubricMode && session.entryMode === 'item' && <div className="results-item-mode"><div className="results-item-nav" aria-label="Assessment items">{items.map((item, index) => <button className={index === activeItemIndex ? 'selected' : ''} type="button" key={item.id} onClick={() => setActiveItemIndex(index)}>{resultItemNumberLabel(item)}<small>{new Set(session.itemOutcomes.filter((outcome) => outcome.itemId === item.id && outcome.answer !== null).map((outcome) => outcome.participantId)).size}/{participants.length}</small></button>)}</div><section className="results-item-class-panel"><div className="results-section-heading"><div><span className="eyebrow">Item mode</span><h2>Question {activeItem ? resultItemNumberLabel(activeItem) : ""}</h2><p>Mark this response across the class, then move directly to another item.</p></div><div className="results-next-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><label className="results-autoadvance-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}><input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} style={{ accentColor: '#2563eb' }} /> Auto-advance to next learner</label><button className="icon-button" type="button" disabled={activeItemIndex <= 0} onClick={() => setActiveItemIndex((index) => Math.max(0, index - 1))} aria-label="Previous item"><ChevronLeft size={18} /></button><button className="button secondary" type="button" onClick={() => setActiveItemIndex((index) => Math.min(items.length - 1, index + 1))}>Next item <ChevronRight size={15} /></button></div></div>{activeItem && <div className="results-class-response-list">{participants.map((participant) => { const outcome = itemOutcome(session, participant.participantId, activeItem.id); const teacherScored = activeItem.questionType === 'constructed_response' || activeItem.questionType === 'problem_solving' || activeItem.questionType === 'essay' || activeItem.questionType === 'short_answer' && (session.shortAnswerScoring.itemModes[activeItem.id] ?? session.shortAnswerScoring.defaultMode) === 'manual'; const teacherAnswer = (answer: LearnerItemAnswer | null) => teacherScored ? preserveTeacherAttempt(activeItem, outcome, answer) : answer; return <div className="results-class-response-row" key={participant.participantId} data-participant-id={participant.participantId}><div><strong>{participant.displayName}</strong><small>{participant.localReference || 'No local reference'}</small></div><AnswerButtons item={activeItem} value={outcome?.answer ?? null} disabled={readOnly} onChange={(answer) => handleItemModeResponseChange(participant.participantId, activeItem, teacherAnswer(answer))} />{teacherScored && <><button className="results-response-marker compact" type="button" disabled={readOnly || (Boolean(outcome?.answer) && (outcome?.earnedPoints ?? 0) > 0)} onClick={() => updateItemOutcome(participant.participantId, activeItem, Boolean(outcome?.answer) && (outcome?.earnedPoints ?? 0) <= 0 ? null : teacherResponseMarker(activeItem), outcome?.earnedPoints ?? null, outcome?.teacherFeedback ?? null)}>{outcome?.answer ? 'Present' : 'Mark present'}</button><input className="results-inline-points" type="number" inputMode="decimal" min="0" max={itemPossiblePoints(activeItem)} step="0.01" value={outcome?.earnedPoints ?? ''} disabled={readOnly} aria-label={`Awarded points for ${participant.displayName}`} onChange={(event) => updateItemOutcome(participant.participantId, activeItem, teacherResponseMarker(activeItem), event.target.value === '' ? null : Number(event.target.value))} /></>}</div>})}</div>}</section></div>}
    {!isRubricMode && session.entryMode === 'score_only' && <section className="panel results-score-only-panel"><div className="results-score-only-note"><CircleAlert size={17} /><p><strong>Score-only mode</strong> records an overall raw score efficiently. It cannot produce item, option, competency, or cognitive-category analysis.</p></div><div className="results-score-list">{participants.map((participant) => { const outcome = scoreOutcome(session, participant.participantId); return <label className="results-score-row" key={participant.participantId}><span><strong>{participant.displayName}</strong><small>{participant.localReference || 'No local reference'}</small></span><input type="number" inputMode="decimal" min="0" max={session.assessmentSnapshot.totalPossiblePoints} step="0.01" value={outcome?.rawScore ?? ''} disabled={readOnly} placeholder="Raw score" aria-label={`Raw score for ${participant.displayName}`} onChange={(event) => updateScoreOnly(participant.participantId, event.target.value)} /><b>/ {formatScore(session.assessmentSnapshot.totalPossiblePoints)}</b></label> })}</div></section>}
  </>
}
