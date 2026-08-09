import { ArrowLeft, Check, Download, FileText, Lightbulb, Plus, Save, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { analyzeResultSession } from '../lib/itemAnalysis'
import { buildRemediationSignals } from '../lib/remediation'
import {
  archiveRemediationPlan,
  deleteDraftRemediationPlan,
  loadRemediationPlans,
  saveRemediationPlan,
} from '../lib/remediationRepository'
import { requestRemediationSuggestions } from '../lib/remediationAi'
import { loadResultSession } from '../lib/resultsRepository'
import type { ItemAnalysisResult } from '../types/itemAnalysis'
import type { RemediationAiSuggestions } from '../types/remediationAi'
import type { RemediationPlanDraft, RemediationScope, RemediationSignalResult } from '../types/remediation'
import type { AssessmentResultSession } from '../types/results'

type PersistedRemediationPlan = RemediationPlanDraft & {
  reviewState?: 'draft' | 'teacher_reviewed' | 'archived' | string
  /** Returned by newer repository mappers; absent in older clients. */
  threshold?: number
  thresholdBasis?: 'percentage_correct' | 'point_facility'
  thresholdComparison?: 'below' | 'at_or_below'
}

export type RemediationPageProps = {
  analysis?: ItemAnalysisResult | null
  session?: AssessmentResultSession | null
  initialPlan?: RemediationPlanDraft | null
  onSave?: (draft: RemediationPlanDraft) => Promise<void> | void
}

function normalizedPercent(value: unknown, fallback = 75) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric))
}

function splitList(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 10)
}

function classSignalKey(resultSessionId: string, competencyId: string | null | undefined, curriculumPeriodId: string | null | undefined) {
  return `${resultSessionId}::${competencyId ?? ''}::${curriculumPeriodId ?? ''}`
}

export function RemediationPage({ analysis: suppliedAnalysis = null, session: suppliedSession = null, initialPlan = null, onSave }: RemediationPageProps) {
  const { id: routeSessionId = '' } = useParams()
  const { user, isDemo } = useApp()
  const propInjected = Boolean(suppliedAnalysis && suppliedSession)
  const [session, setSession] = useState<AssessmentResultSession | null>(suppliedSession)
  const [analysis, setAnalysis] = useState<ItemAnalysisResult | null>(suppliedAnalysis)
  const [activePlan, setActivePlan] = useState<PersistedRemediationPlan | null>(initialPlan as PersistedRemediationPlan | null)
  const [loading, setLoading] = useState(!propInjected)
  const [error, setError] = useState('')
  const [threshold, setThreshold] = useState('75')
  const [basis, setBasis] = useState<'percentage_correct' | 'point_facility'>('percentage_correct')
  const [comparison, setComparison] = useState<'below' | 'at_or_below'>('below')
  const [scope, setScope] = useState<RemediationScope>(initialPlan?.scope ?? 'whole_class')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(initialPlan?.selectedParticipantIds ?? [])
  const [overrides, setOverrides] = useState<Record<string, 'include' | 'exclude' | 'default'>>({})
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [candidateTargetKey, setCandidateTargetKey] = useState('')
  const [targetInitialized, setTargetInitialized] = useState(false)
  const [plannedActivity, setPlannedActivity] = useState(initialPlan?.plannedActivity ?? '')
  const [scheduledFor, setScheduledFor] = useState(initialPlan?.scheduledFor ?? '')
  const [followUpEvidence, setFollowUpEvidence] = useState(initialPlan?.followUpEvidence ?? '')
  const [notes, setNotes] = useState(initialPlan?.notes ?? '')
  const [teacherSelectedTarget, setTeacherSelectedTarget] = useState(initialPlan?.teacherSelectedTarget ?? '')
  const [teacherReviewed, setTeacherReviewed] = useState(initialPlan?.teacherReviewed ?? false)
  const [acceptedAssistantText, setAcceptedAssistantText] = useState(initialPlan?.optionalAssistantSuggestion ?? '')
  const [languagePreference, setLanguagePreference] = useState('')
  const [localLanguageName, setLocalLanguageName] = useState('')
  const [preferredApproaches, setPreferredApproaches] = useState('')
  const [actualResources, setActualResources] = useState('')
  const [resourceNotes, setResourceNotes] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [numberOfSessions, setNumberOfSessions] = useState('')
  const [suggestions, setSuggestions] = useState<RemediationAiSuggestions | null>(null)
  const [suggestionWorking, setSuggestionWorking] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (propInjected) {
      setSession(suppliedSession)
      setAnalysis(suppliedAnalysis)
      setActivePlan(initialPlan as PersistedRemediationPlan | null)
      setLoading(false)
      return
    }
    if (!user || !routeSessionId) return
    let active = true
    setLoading(true)
    loadResultSession(routeSessionId, user.id, isDemo).then(async (nextSession) => {
      if (!nextSession) throw new Error('Results session not found.')
      const plans = await loadRemediationPlans(user.id, nextSession.id, isDemo)
      const nextPlan = (plans as PersistedRemediationPlan[]).find((plan) => plan.reviewState !== 'archived') ?? null
      if (!active) return
      setSession(nextSession)
      setAnalysis(analyzeResultSession(nextSession))
      setActivePlan(nextPlan)
    }).catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to load remediation planning.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [initialPlan, isDemo, propInjected, routeSessionId, suppliedAnalysis, suppliedSession, user?.id])

  useEffect(() => {
    if (!activePlan) return
    setThreshold(String(normalizedPercent(activePlan.threshold, 75)))
    setBasis(activePlan.thresholdBasis ?? 'percentage_correct')
    setComparison(activePlan.thresholdComparison ?? 'below')
    setScope(activePlan.scope)
    setSelectedParticipantIds([...activePlan.selectedParticipantIds])
    setPlannedActivity(activePlan.plannedActivity)
    setScheduledFor(activePlan.scheduledFor ?? '')
    setFollowUpEvidence(activePlan.followUpEvidence)
    setNotes(activePlan.notes)
    setTeacherSelectedTarget(activePlan.teacherSelectedTarget)
    setTeacherReviewed(activePlan.teacherReviewed)
    setAcceptedAssistantText(activePlan.optionalAssistantSuggestion ?? '')
    const resultSessionId = activePlan.resultSessionId
    const persistedTargetKeys = activePlan.targets.map((target) => classSignalKey(resultSessionId, target.competencyId, target.curriculumPeriodId))
    setOverrides(Object.fromEntries(persistedTargetKeys.map((key) => [key, 'include' as const])))
    setTargetKeys(persistedTargetKeys)
    setTargetInitialized(true)
  }, [activePlan])

  const signalResult = useMemo<RemediationSignalResult | null>(() => {
    if (!analysis) return null
    return buildRemediationSignals(analysis, {
      threshold: { percentageThreshold: Number(threshold) || 0, basis, comparison },
      scope,
      participantIds: scope === 'selected_learners' ? selectedParticipantIds : undefined,
      overrides,
    })
  }, [analysis, basis, comparison, overrides, scope, selectedParticipantIds, threshold])

  const signals = signalResult?.classSignals ?? []
  const availableCandidateTargets = (signalResult?.sourceAggregates ?? []).map((aggregate) => ({
    key: classSignalKey(analysis?.resultSessionId ?? '', aggregate.competencyId, aggregate.curriculumPeriodId),
    competencyText: aggregate.competencyText ?? 'Selected competency',
    curriculumPeriodLabel: aggregate.curriculumPeriodLabel,
  })).filter((candidate) => !signals.some((signal) => signal.key === candidate.key))
  const participants = analysis?.learners ?? []
  const selectedSignal = signals.find((signal) => targetKeys.includes(signal.key)) ?? signals[0] ?? null

  useEffect(() => {
    if (!analysis || signals.length === 0 || targetInitialized) return
    const keys = activePlan
      ? activePlan.targets.flatMap((target) => signals.filter((signal) => signal.competencyId === target.competencyId && signal.curriculumPeriodId === target.curriculumPeriodId).map((signal) => signal.key))
      : signals.map((signal) => signal.key)
    setTargetKeys(keys.length > 0 ? keys : signals.map((signal) => signal.key))
    setTargetInitialized(true)
  }, [activePlan, analysis, signals, targetInitialized])

  function toggleParticipant(id: string) {
    setSelectedParticipantIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  function toggleTarget(key: string, competency: string) {
    setTargetKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key])
    setTeacherSelectedTarget((current) => current || competency)
  }

  function setOverride(key: string, value: 'include' | 'exclude' | 'default') {
    setOverrides((current) => ({ ...current, [key]: value }))
  }

  function includeCandidateTarget() {
    const candidate = availableCandidateTargets.find((value) => value.key === candidateTargetKey)
    if (!candidate) return
    setOverride(candidate.key, 'include')
    setTargetKeys((current) => current.includes(candidate.key) ? current : [...current, candidate.key])
    setTeacherSelectedTarget((current) => current || candidate.competencyText)
    setCandidateTargetKey('')
  }

  async function requestSuggestions() {
    if (!session || !selectedSignal || !user) {
      setMessage('Select a result session and target competency first.')
      return
    }
    setSuggestionWorking(true)
    setMessage('')
    try {
      const next = await requestRemediationSuggestions({
        resultSessionId: session.id,
        competencyId: selectedSignal.competencyId,
        teacherConstraints: {
          languagePreference: languagePreference.trim() || undefined,
          localLanguageName: localLanguageName.trim() || undefined,
          preferredApproaches: splitList(preferredApproaches),
          actualResources: splitList(actualResources),
          resourceNotes: resourceNotes.trim() || undefined,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          numberOfSessions: numberOfSessions ? Number(numberOfSessions) : null,
        },
      })
      setSuggestions(next)
      setMessage('Optional suggestions are ready for teacher review. Nothing was added to the plan.')
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Unable to request optional suggestions.')
    } finally {
      setSuggestionWorking(false)
    }
  }

  function selectSuggestion(text: string) {
    // Selection only places text into an editable review box. It never alters
    // plannedActivity or the persisted plan until the teacher accepts and saves.
    setAcceptedAssistantText(text)
    setMessage('Edit the selected suggestion, then explicitly accept and save it.')
  }

  async function save() {
    if (!analysis || !signalResult) return
    const targets = signals.filter((signal) => targetKeys.includes(signal.key)).map((signal) => ({
      competencyId: signal.competencyId,
      competencyText: signal.competencyText,
      curriculumPeriodId: signal.curriculumPeriodId,
      curriculumPeriodLabel: signal.curriculumPeriodLabel,
      evidenceValue: signal.evidenceValue,
      evidenceLabel: signal.evidenceLabel,
      itemNumbers: signal.itemNumbers,
    }))
    const normalizedThreshold = Math.max(0, Math.min(1, (Number(threshold) || 0) / 100))
    if (targets.length === 0) {
      setMessage('Select at least one target competency before saving.')
      return
    }
    if (scope === 'selected_learners' && selectedParticipantIds.length === 0) {
      setMessage('Select at least one learner for this teacher-reviewed group.')
      return
    }
    const draft: RemediationPlanDraft = {
      id: activePlan?.id,
      resultSessionId: session?.id ?? analysis.resultSessionId,
      scope,
      selectedParticipantIds,
      targets,
      teacherSelectedTarget,
      plannedActivity: plannedActivity.trim(),
      scheduledFor: scheduledFor || null,
      followUpEvidence: followUpEvidence.trim(),
      notes: notes.trim(),
      teacherReviewed,
      optionalAssistantSuggestion: acceptedAssistantText.trim() || null,
      createdAt: activePlan?.createdAt,
      updatedAt: new Date().toISOString(),
    }
    try {
      const saved = user && session
        ? await saveRemediationPlan(draft, user.id, isDemo, { threshold: normalizedThreshold, thresholdBasis: basis, thresholdComparison: comparison })
        : await onSave?.(draft)
      if (saved && typeof saved === 'object') setActivePlan(saved as PersistedRemediationPlan)
      setMessage('Remediation plan saved for teacher review.')
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Unable to save the remediation plan.')
    }
  }

  async function archivePlan() {
    if (!activePlan?.id || !user) return
    if (!window.confirm('Archive this remediation plan? It will remain available as historical evidence.')) return
    try {
      await archiveRemediationPlan(activePlan.id, user.id, isDemo)
      setActivePlan(null)
      setMessage('Remediation plan archived. Its historical result evidence is unchanged.')
    } catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : 'Unable to archive this plan.') }
  }

  async function deletePlan() {
    if (!activePlan?.id || !user) return
    if (!window.confirm('Delete this draft remediation plan? This cannot be undone.')) return
    try {
      await deleteDraftRemediationPlan(activePlan.id, user.id, isDemo)
      setActivePlan(null)
      setMessage('Draft remediation plan deleted.')
    } catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : 'Unable to delete this draft.') }
  }

  if (loading) return <div className="loading-screen"><span className="loader" /><strong>Loading remediation planning…</strong></div>
  if (error) return <div className="remediation-page remediation-empty"><Users size={28} /><h1>Remediation planning</h1><p>{error}</p><Link className="button ghost" to="/results"><ArrowLeft size={16} /> Back to results</Link></div>
  if (!analysis || !session) return <div className="remediation-page remediation-empty"><Users size={28} /><h1>Remediation planning</h1><p>Open a results session with deterministic item analysis before creating a remediation plan.</p><Link className="button ghost" to="/results"><ArrowLeft size={16} /> Back to results</Link></div>
  if (session.status === 'archived') return <div className="remediation-page remediation-empty"><Users size={28} /><h1>Archived remediation evidence</h1><p>This result history and its saved remediation plan are read-only. Open the teacher report to review the preserved plan.</p><div className="remediation-actions"><Link className="button ghost" to={`/results/${session.id}/analysis`}><ArrowLeft size={16} /> Back to analysis</Link><Link className="button secondary" to={`/results/${session.id}/print`}><FileText size={16} /> Open report</Link></div></div>
  if (!signalResult?.available) return <div className="remediation-page remediation-empty"><Users size={28} /><h1>Remediation planning</h1><p>Score-only results cannot produce competency remediation signals. Encode item-level responses first.</p><Link className="button ghost" to={`/results/${session.id}`}><ArrowLeft size={16} /> Back to results</Link></div>

  return <div className="remediation-page">
    <header className="remediation-page-header"><div><p className="eyebrow">Results follow-up</p><h1>Remediation planning</h1><p>Review neutral instructional signals, choose a target group, and record the next evidence check.</p></div><div className="remediation-header-links"><Link className="button ghost" to={`/results/${session.id}`}><ArrowLeft size={15} /> Results</Link><Link className="button ghost" to={`/results/${session.id}/print`}><FileText size={15} /> Reports</Link></div></header>
    <section className="remediation-panel"><div className="remediation-panel-heading"><div><p className="eyebrow">1 · Evidence setting</p><h2>Choose the teacher threshold</h2></div><small>This is a configurable analytical convention, not a DepEd-mandated cutoff.</small></div><div className="remediation-form-grid"><label>Threshold (%)<input inputMode="decimal" type="number" min="0" max="100" step="1" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label><label>Evidence basis<select value={basis} onChange={(event) => setBasis(event.target.value as typeof basis)}><option value="percentage_correct">Percentage correct</option><option value="point_facility">Point facility</option></select></label><label>Comparison<select value={comparison} onChange={(event) => setComparison(event.target.value as typeof comparison)}><option value="below">Below threshold</option><option value="at_or_below">At or below threshold</option></select></label><label>Group<select value={scope} onChange={(event) => setScope(event.target.value as RemediationScope)}><option value="whole_class">Whole class</option><option value="selected_learners">Selected learners</option></select></label></div></section>

    {scope === 'selected_learners' && <section className="remediation-panel"><div className="remediation-panel-heading"><div><p className="eyebrow">2 · Learner group</p><h2>Select learners for this plan</h2></div><small>Names stay inside this teacher-authorized workspace and are not sent to AI.</small></div><div className="remediation-learner-picker">{participants.map((learner) => <label key={learner.participantId}><input type="checkbox" checked={selectedParticipantIds.includes(learner.participantId)} onChange={() => toggleParticipant(learner.participantId)} /><span>{learner.displayName}</span></label>)}</div></section>}

    <section className="remediation-panel"><div className="remediation-panel-heading"><div><p className="eyebrow">{scope === 'selected_learners' ? '3' : '2'} · Target competencies</p><h2>{signals.length} signal{signals.length === 1 ? '' : 's'} for review</h2></div><small>Select targets and override individual signals before saving.</small></div>{availableCandidateTargets.length > 0 && <div className="remediation-candidate-row"><label>Teacher-chosen additional competency<select value={candidateTargetKey} onChange={(event) => setCandidateTargetKey(event.target.value)}><option value="">Choose a mapped competency…</option>{availableCandidateTargets.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.competencyText} · {candidate.curriculumPeriodLabel}</option>)}</select></label><button className="button ghost" type="button" disabled={!candidateTargetKey} onClick={includeCandidateTarget}><Plus size={15} /> Include</button></div>}{signals.length === 0 ? <p className="remediation-muted">No competency currently meets this threshold. A teacher may still include a mapped competency above.</p> : <div className="remediation-signal-list">{signals.map((signal) => <article className="remediation-signal" key={signal.key}><div className="remediation-signal-top"><label className="remediation-signal-target"><input type="checkbox" checked={targetKeys.includes(signal.key)} onChange={() => toggleTarget(signal.key, signal.competencyText)} /><span><strong>{signal.competencyText}</strong><small>{signal.curriculumPeriodLabel} · Items {signal.itemNumbers.join(', ')}</small></span></label><strong>{signal.evidenceValue === null ? '—' : `${Math.round(signal.evidenceValue * 1000) / 10}%`} / {Math.round(signal.threshold * 1000) / 10}%</strong></div><p>{signal.instructionalMessage}</p><label className="remediation-override">Teacher override<select value={overrides[signal.key] ?? 'default'} onChange={(event) => setOverride(signal.key, event.target.value as 'include' | 'exclude' | 'default')}><option value="default">Use signal</option><option value="include">Include in plan</option><option value="exclude">Exclude from plan</option></select></label></article>)}</div>}</section>

    <section className="remediation-panel"><div className="remediation-panel-heading"><div><p className="eyebrow">{scope === 'selected_learners' ? '4' : '3'} · Plan details</p><h2>Record the next instructional step</h2></div></div><div className="remediation-form-grid"><label className="wide">Teacher-selected target<input value={teacherSelectedTarget} onChange={(event) => setTeacherSelectedTarget(event.target.value)} placeholder="What should learners demonstrate next?" /></label><label className="wide">Planned activity<textarea rows={3} value={plannedActivity} onChange={(event) => setPlannedActivity(event.target.value)} placeholder="Describe the reteaching or practice activity." /></label><label>Schedule/date<input type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label><label className="wide">Follow-up evidence/check<textarea rows={2} value={followUpEvidence} onChange={(event) => setFollowUpEvidence(event.target.value)} placeholder="What evidence will you collect?" /></label><label className="wide">Notes<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div><label className="remediation-review-check"><input type="checkbox" checked={teacherReviewed} onChange={(event) => setTeacherReviewed(event.target.checked)} /><span><strong>I reviewed and edited this plan.</strong><small>Saving records teacher review status only; it does not assign a label to a learner.</small></span></label><div className="remediation-actions"><button className="button primary" type="button" onClick={() => void save()}><Save size={16} /> Save plan</button>{activePlan?.id && activePlan.reviewState === 'draft' && <button className="button ghost danger" type="button" onClick={() => void deletePlan()}><Trash2 size={15} /> Delete draft</button>}{activePlan?.id && activePlan.reviewState !== 'archived' && <button className="button ghost" type="button" onClick={() => void archivePlan()}><Download size={15} /> Archive plan</button>}{message && <span className="remediation-save-message"><Check size={15} /> {message}</span>}</div></section>

    <section className="remediation-panel remediation-ai-panel"><div className="remediation-panel-heading"><div><p className="eyebrow">Optional teacher assistant</p><h2>Suggest activity ideas</h2></div><small>No learner names, IDs, raw answers, or per-learner histories leave this app. Suggestions never calculate scores and never auto-apply.</small></div><div className="remediation-form-grid"><label>Language preference<input value={languagePreference} onChange={(event) => setLanguagePreference(event.target.value)} placeholder="English, Filipino, or bilingual" /></label><label>Local-language preference<input value={localLanguageName} onChange={(event) => setLocalLanguageName(event.target.value)} placeholder="Optional" /></label><label className="wide">Preferred approaches<input value={preferredApproaches} onChange={(event) => setPreferredApproaches(event.target.value)} placeholder="Discussion, worked examples" /></label><label className="wide">Actual teacher-listed resources<input value={actualResources} onChange={(event) => setActualResources(event.target.value)} placeholder="Only list resources you actually have" /></label><label className="wide">Resource constraints<textarea rows={2} value={resourceNotes} onChange={(event) => setResourceNotes(event.target.value)} /></label><label>Minutes per session<input inputMode="numeric" type="number" min="1" max="600" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} /></label><label>Number of sessions<input inputMode="numeric" type="number" min="1" max="30" value={numberOfSessions} onChange={(event) => setNumberOfSessions(event.target.value)} /></label></div><div className="remediation-actions"><button className="button secondary" type="button" disabled={suggestionWorking || !selectedSignal} onClick={() => void requestSuggestions()}><Lightbulb size={16} /> {suggestionWorking ? 'Requesting…' : 'Request optional suggestions'}</button><span className="remediation-ai-boundary">Verified competency + aggregate evidence + your constraints only</span></div>{suggestions && <div className="remediation-suggestion-grid">{[['reteachingApproach', 'Reteaching approach'], ['practiceActivity', 'Practice activity'], ['formativeRecheck', 'Formative recheck'], ['enrichmentAlternative', 'Enrichment alternative']].map(([key, label]) => <article key={key} className="remediation-suggestion-card"><p className="eyebrow">{label}</p><p>{suggestions[key as keyof RemediationAiSuggestions]}</p><button className="button ghost" type="button" onClick={() => selectSuggestion(suggestions[key as keyof RemediationAiSuggestions])}>Select for review</button></article>)}</div>}<label className="wide remediation-accepted-suggestion">Accepted suggestion text (edit before saving)<textarea rows={3} value={acceptedAssistantText} onChange={(event) => setAcceptedAssistantText(event.target.value)} placeholder="Nothing accepted yet." /></label></section>
  </div>
}
