import type { RemediationPlanDraft, RemediationPlanTarget, RemediationScope } from '../types/remediation'
import { supabase } from './supabase'

const DEMO_REMEDIATION_KEY = 'gurodesk.demo.remediationPlans.v1'

export type PersistedRemediationPlan = RemediationPlanDraft & {
  userId?: string
  reviewState: 'draft' | 'teacher_reviewed' | 'archived' | string
  threshold: number
  thresholdBasis: 'percentage_correct' | 'point_facility'
  thresholdComparison: 'below' | 'at_or_below'
}
type StoredDemoPlan = PersistedRemediationPlan & { userId: string }
type DbRow = Record<string, unknown>

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function text(value: unknown, fallback = '') {
  return value === null || value === undefined ? fallback : String(value)
}

function nullableText(value: unknown) {
  return value === null || value === undefined || value === '' ? null : String(value)
}

function readDemo(userId: string, resultSessionId?: string) {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_REMEDIATION_KEY) ?? '[]') as StoredDemoPlan[]
    return (Array.isArray(parsed) ? parsed : [])
      .filter((plan) => plan.userId === userId && (!resultSessionId || plan.resultSessionId === resultSessionId))
      .map(normalizeStoredDemoPlan)
  } catch {
    return []
  }
}

function writeDemo(values: StoredDemoPlan[]) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(DEMO_REMEDIATION_KEY, JSON.stringify(values))
}

function normalizeStoredDemoPlan(plan: StoredDemoPlan): StoredDemoPlan {
  return {
    ...clone(plan),
    threshold: Number.isFinite(Number(plan.threshold)) ? Number(plan.threshold) : 0.75,
    thresholdBasis: plan.thresholdBasis === 'point_facility' ? 'point_facility' : 'percentage_correct',
    thresholdComparison: plan.thresholdComparison === 'at_or_below' ? 'at_or_below' : 'below',
  }
}

function mapTarget(row: DbRow): RemediationPlanTarget {
  return {
    competencyId: text(row.competency_id),
    competencyText: text(row.competency_text_snapshot),
    curriculumPeriodId: nullableText(row.curriculum_period_id),
    curriculumPeriodLabel: text(row.curriculum_period_label),
    evidenceValue: row.evidence_value === null || row.evidence_value === undefined ? null : Number(row.evidence_value),
    evidenceLabel: text(row.evidence_label, 'percentage_correct') as RemediationPlanTarget['evidenceLabel'],
    itemNumbers: Array.isArray(row.item_numbers) ? row.item_numbers.map(Number) : [],
  }
}

function mapPlan(row: DbRow, targets: DbRow[] = [], participants: DbRow[] = []): PersistedRemediationPlan {
  return {
    id: text(row.id),
    resultSessionId: text(row.result_session_id),
    scope: text(row.scope, 'whole_class') as RemediationScope,
    selectedParticipantIds: participants.map((participant) => text(participant.participant_id)),
    targets: targets.map(mapTarget),
    teacherSelectedTarget: text(row.teacher_selected_target),
    plannedActivity: text(row.planned_activity),
    scheduledFor: nullableText(row.scheduled_for),
    followUpEvidence: text(row.follow_up_evidence),
    notes: text(row.notes),
    teacherReviewed: Boolean(row.teacher_reviewed),
    optionalAssistantSuggestion: nullableText(row.optional_assistant_suggestion),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    reviewState: text(row.review_state, 'draft'),
    threshold: Number(row.threshold ?? 0.75),
    thresholdBasis: text(row.threshold_basis, 'percentage_correct') as PersistedRemediationPlan['thresholdBasis'],
    thresholdComparison: text(row.threshold_comparison, 'below') as PersistedRemediationPlan['thresholdComparison'],
  }
}

export type RemediationPlanPersistenceOptions = {
  threshold?: number
  thresholdBasis?: 'percentage_correct' | 'point_facility'
  thresholdComparison?: 'below' | 'at_or_below'
}

export async function loadRemediationPlans(userId: string, resultSessionId: string | undefined, demo: boolean) {
  if (demo || !supabase) return readDemo(userId, resultSessionId)
  let query = supabase.from('remediation_plans').select('*').eq('user_id', userId)
  if (resultSessionId) query = query.eq('result_session_id', resultSessionId)
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw error
  const planRows = (data ?? []) as unknown as DbRow[]
  if (planRows.length === 0) return []
  const ids = planRows.map((row) => text(row.id))
  const [targetResult, participantResult] = await Promise.all([
    supabase.from('remediation_plan_targets').select('*').eq('user_id', userId).in('remediation_plan_id', ids),
    supabase.from('remediation_plan_participants').select('*').eq('user_id', userId).in('remediation_plan_id', ids),
  ])
  if (targetResult.error) throw targetResult.error
  if (participantResult.error) throw participantResult.error
  const targetsByPlan = new Map<string, DbRow[]>()
  const participantsByPlan = new Map<string, DbRow[]>()
  for (const row of (targetResult.data ?? []) as unknown as DbRow[]) {
    const key = text(row.remediation_plan_id)
    targetsByPlan.set(key, [...(targetsByPlan.get(key) ?? []), row])
  }
  for (const row of (participantResult.data ?? []) as unknown as DbRow[]) {
    const key = text(row.remediation_plan_id)
    participantsByPlan.set(key, [...(participantsByPlan.get(key) ?? []), row])
  }
  return planRows.map((row) => mapPlan(row, targetsByPlan.get(text(row.id)), participantsByPlan.get(text(row.id))))
}

export async function saveRemediationPlan(
  plan: RemediationPlanDraft,
  userId: string,
  demo: boolean,
  options: RemediationPlanPersistenceOptions = {},
) {
  const persistedPlan = plan as RemediationPlanDraft & Partial<Pick<PersistedRemediationPlan, 'threshold' | 'thresholdBasis' | 'thresholdComparison'>>
  const payload = {
    id: plan.id ?? null,
    resultSessionId: plan.resultSessionId,
    scope: plan.scope,
    selectedParticipantIds: [...plan.selectedParticipantIds],
    targets: plan.targets.map((target) => ({
      competencyId: target.competencyId,
      competencyText: target.competencyText,
      curriculumPeriodId: target.curriculumPeriodId,
      curriculumPeriodLabel: target.curriculumPeriodLabel,
      evidenceValue: target.evidenceValue,
      evidenceLabel: target.evidenceLabel,
      itemNumbers: [...target.itemNumbers],
    })),
    teacherSelectedTarget: plan.teacherSelectedTarget,
    plannedActivity: plan.plannedActivity,
    scheduledFor: plan.scheduledFor,
    followUpEvidence: plan.followUpEvidence,
    notes: plan.notes,
    teacherReviewed: plan.teacherReviewed,
    optionalAssistantSuggestion: plan.optionalAssistantSuggestion ?? null,
    threshold: options.threshold ?? persistedPlan.threshold ?? 0.75,
    thresholdBasis: options.thresholdBasis ?? persistedPlan.thresholdBasis ?? 'percentage_correct',
    thresholdComparison: options.thresholdComparison ?? persistedPlan.thresholdComparison ?? 'below',
  }
  if (demo || !supabase) {
    const values = typeof localStorage === 'undefined' ? [] : (() => {
      try { return JSON.parse(localStorage.getItem(DEMO_REMEDIATION_KEY) ?? '[]') as StoredDemoPlan[] } catch { return [] }
    })()
    const existing = values.find((item) => item.id === plan.id && item.userId === userId)
    const now = new Date().toISOString()
    const saved: StoredDemoPlan = {
      ...clone(plan),
      id: plan.id ?? `demo-remediation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      reviewState: plan.teacherReviewed ? 'teacher_reviewed' : 'draft',
      threshold: payload.threshold,
      thresholdBasis: payload.thresholdBasis,
      thresholdComparison: payload.thresholdComparison,
    }
    writeDemo([...values.filter((item) => !(item.id === saved.id && item.userId === userId)), saved])
    return clone(saved)
  }
  const { data, error } = await supabase.rpc('save_remediation_plan', { p_plan: payload })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as unknown as DbRow
  const plans = await loadRemediationPlans(userId, plan.resultSessionId, false)
  return plans.find((candidate) => candidate.id === text(row?.id)) ?? mapPlan(row)
}

export async function archiveRemediationPlan(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) {
    const values = readDemo(userId)
    const archived = values.find((plan) => plan.id === id)
    if (!archived) return null
    const saved = { ...archived, reviewState: 'archived' as const, updatedAt: new Date().toISOString() }
    writeDemo(values.map((plan) => plan.id === id ? saved : plan))
    return saved
  }
  const { data, error } = await supabase.rpc('archive_remediation_plan', { p_plan_id: id })
  if (error) throw error
  return mapPlan((Array.isArray(data) ? data[0] : data) as unknown as DbRow)
}

export async function deleteDraftRemediationPlan(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) {
    const values = readDemo(userId)
    const found = values.find((plan) => plan.id === id)
    if (found && found.reviewState !== 'draft') throw new Error('Only draft remediation plans may be deleted.')
    writeDemo(values.filter((plan) => plan.id !== id))
    return
  }
  const { error } = await supabase.rpc('delete_draft_remediation_plan', { p_plan_id: id })
  if (error) throw error
}
