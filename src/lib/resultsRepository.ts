import type { AssessmentRecord } from '../types/assessment'
import type {
  AssessmentResultSession,
  ClassLearner,
  LearnerInput,
  ResultAssessmentItemSnapshot,
  ResultAssessmentSnapshot,
  ResultItemOutcome,
  ResultLearnerSnapshot,
  ResultSaveBatch,
  ResultSessionInput,
  ScoreOnlyOutcome,
} from '../types/results'
import { supabase } from './supabase'
import {
  archiveDemoResultSession,
  createDemoResultsSample,
  deleteDemoClassLearner,
  deleteDemoDraftResultSession,
  readDemoClassLearners,
  readDemoResultSessions,
  saveDemoClassLearner,
  saveDemoResultSession,
} from './resultsDemo'
import { itemPossiblePoints } from './resultsScoring'

type DbRow = Record<string, unknown>

/** Lightweight list-card aggregates loaded without participant/outcome N+1 queries. */
export type ResultSessionListSummary = AssessmentResultSession & {
  learnerCount: number
  encodedLearnerCount: number
  responseCount: number
}

function asObject(value: unknown): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRow : {}
}

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

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapClassLearner(row: DbRow): ClassLearner {
  return {
    id: text(row.id),
    userId: text(row.user_id),
    assignmentId: text(row.assignment_id),
    sectionName: text(row.section_name),
    displayName: text(row.display_name),
    localReference: nullableText(row.local_reference),
    status: text(row.status, 'active') as ClassLearner['status'],
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

function normalizeSnapshot(value: unknown): ResultAssessmentSnapshot {
  const source = asObject(value)
  const items = Array.isArray(source.items) ? source.items : []
  const normalizedItems = items.map((value) => {
    const item = asObject(value)
    const pointsPossible = number(item.pointsPossible ?? item.points, 1)
    return {
      id: text(item.id),
      itemNumber: number(item.itemNumber ?? item.item_number),
      ...(Number.isSafeInteger(Number(item.pointStart ?? item.point_start)) ? { pointStart: number(item.pointStart ?? item.point_start) } : {}),
      ...(Number.isSafeInteger(Number(item.pointEnd ?? item.point_end)) ? { pointEnd: number(item.pointEnd ?? item.point_end) } : {}),
      prompt: text(item.prompt),
      questionType: text(item.questionType ?? item.question_type) as ResultAssessmentItemSnapshot['questionType'],
      answer: clone(item.answer) as ResultAssessmentItemSnapshot['answer'],
      pointsPossible,
      points: pointsPossible,
      competencySnapshot: clone(asObject(item.competencySnapshot ?? item.competency_snapshot)) as ResultAssessmentItemSnapshot['competencySnapshot'],
      cognitiveCategorySnapshot: clone(asObject(item.cognitiveCategorySnapshot ?? item.cognitive_category_snapshot)) as ResultAssessmentItemSnapshot['cognitiveCategorySnapshot'],
      mapping: clone(asObject(item.mapping)) as ResultAssessmentItemSnapshot['mapping'],
    }
  })
  const declaredTotal = number(source.totalPossiblePoints ?? source.total_possible_points, Number.NaN)
  const derivedTotal = normalizedItems.reduce((sum, item) => sum + itemPossiblePoints(item), 0)
  // A legacy snapshot may carry a stale total.  Keep the immutable item rows
  // authoritative instead of displaying a silently conflicting denominator;
  // final-save validation still rejects a client payload that disagrees.
  const totalPossiblePoints = Number.isFinite(declaredTotal) && Math.abs(declaredTotal - derivedTotal) < 0.000001
    ? declaredTotal
    : derivedTotal
  return {
    assessmentId: text(source.assessmentId ?? source.assessment_id),
    assessmentVersionNumber: number(source.assessmentVersionNumber ?? source.assessment_version_number, 1),
    assessmentTitle: text(source.assessmentTitle ?? source.assessment_title),
    assignmentId: text(source.assignmentId ?? source.assignment_id),
    gradeLevel: text(source.gradeLevel ?? source.grade_level),
    learningArea: text(source.learningArea ?? source.learning_area),
    schoolYear: text(source.schoolYear ?? source.school_year),
    gradingTermId: text(source.gradingTermId ?? source.grading_term_id),
    gradingTermLabel: text(source.gradingTermLabel ?? source.grading_term_label),
    curriculumPeriodIds: Array.isArray(source.curriculumPeriodIds) ? source.curriculumPeriodIds.map(String) : [],
    curriculumPeriodLabels: Array.isArray(source.curriculumPeriodLabels) ? source.curriculumPeriodLabels.map(String) : [],
    totalItems: number(source.totalItems ?? source.total_items, items.length),
    totalPossiblePoints,
    items: normalizedItems,
  }
}

function mapParticipant(row: DbRow): ResultLearnerSnapshot {
  return {
    participantId: text(row.id ?? row.participant_id),
    learnerId: text(row.learner_id),
    displayName: text(row.display_name_snapshot ?? row.display_name),
    localReference: nullableText(row.local_reference_snapshot ?? row.local_reference),
    learnerWasActive: Boolean(row.learner_was_active),
  }
}

function mapOutcome(row: DbRow): ResultItemOutcome {
  return {
    id: text(row.id),
    resultSessionId: text(row.result_session_id),
    participantId: text(row.participant_id),
    learnerId: text(row.learner_id),
    itemId: text(row.item_id),
    itemNumber: number(row.item_number),
    answer: row.learner_answer === null || row.learner_answer === undefined
      ? null : clone(row.learner_answer) as ResultItemOutcome['answer'],
    isCorrect: row.is_correct === null || row.is_correct === undefined ? null : Boolean(row.is_correct),
    earnedPoints: number(row.earned_points),
    possiblePoints: number(row.possible_points),
    teacherFeedback: nullableText(row.teacher_feedback),
    scoringSource: text(row.scoring_source, 'deterministic') as ResultItemOutcome['scoringSource'],
    updatedAt: text(row.updated_at),
  }
}

function mapScoreOnly(row: DbRow): ScoreOnlyOutcome {
  return {
    participantId: text(row.participant_id),
    learnerId: text(row.learner_id),
    rawScore: nullableNumber(row.raw_score),
    possiblePoints: number(row.possible_points),
    teacherFeedback: nullableText(row.teacher_feedback),
    updatedAt: text(row.updated_at),
  }
}

function mapSessionRow(row: DbRow, participants: DbRow[] = [], outcomes: DbRow[] = [], scores: DbRow[] = []): AssessmentResultSession {
  const snapshot = normalizeSnapshot(row.assessment_snapshot)
  const session: AssessmentResultSession = {
    id: text(row.id),
    userId: text(row.user_id),
    assignmentId: text(row.assignment_id),
    sectionName: text(row.section_name),
    assessmentId: text(row.assessment_document_id ?? snapshot.assessmentId),
    administrationDate: text(row.administration_date),
    title: text(row.title),
    entryMode: text(row.entry_mode, 'answer_sheet') as AssessmentResultSession['entryMode'],
    status: text(row.status, 'draft') as AssessmentResultSession['status'],
    assessmentSnapshot: snapshot,
    learners: participants.map(mapParticipant),
    itemOutcomes: outcomes.map(mapOutcome),
    scoreOnlyOutcomes: scores.map(mapScoreOnly),
    shortAnswerScoring: (() => {
      const config = clone(asObject(row.short_answer_scoring)) as Partial<AssessmentResultSession['shortAnswerScoring']>
      return {
        defaultMode: config.defaultMode === 'normalized_exact' ? 'normalized_exact' as const : 'manual' as const,
        itemModes: config.itemModes && typeof config.itemModes === 'object' ? config.itemModes : {},
      }
    })(),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    versionNumber: number(row.version_number, 1),
  }
  return session
}

function localSessionListSummary(session: AssessmentResultSession): ResultSessionListSummary {
  const encodedLearnerIds = session.entryMode === 'score_only'
    ? new Set(session.scoreOnlyOutcomes.filter((outcome) => outcome.rawScore !== null).map((outcome) => outcome.participantId))
    : new Set(session.itemOutcomes.filter((outcome) => outcome.answer !== null).map((outcome) => outcome.participantId))
  const responseCount = session.entryMode === 'score_only'
    ? session.scoreOnlyOutcomes.filter((outcome) => outcome.rawScore !== null).length
    : session.itemOutcomes.filter((outcome) => outcome.answer !== null).length
  return {
    ...session,
    learnerCount: session.learners.length,
    encodedLearnerCount: encodedLearnerIds.size,
    responseCount,
  }
}

function rowFromRpc(data: unknown): DbRow {
  if (Array.isArray(data)) return asObject(data[0])
  return asObject(data)
}

/**
 * Supabase/PostgREST deployments commonly default to a 1,000-row response
 * limit.  Result outcomes are loaded in deterministic pages so a 2,000+ cell
 * class is complete without issuing one request per learner or answer.
 */
async function loadResultRowsPaged(
  table: 'result_session_learners' | 'result_item_outcomes' | 'result_score_only_outcomes',
  id: string,
  userId: string,
  orderColumn: 'created_at' | 'item_number',
) {
  if (!supabase) return [] as DbRow[]
  const pageSize = 900
  const rows: DbRow[] = []
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from(table).select('*')
      .eq('result_session_id', id).eq('user_id', userId)
      .order(orderColumn, { ascending: true })
    // The primary ordering column is not unique. Stable tie-breakers keep a
    // row from moving between pages when the result has 2,000+ cells.
    query = table === 'result_item_outcomes'
      ? query.order('item_id', { ascending: true }).order('participant_id', { ascending: true })
      : query.order('id', { ascending: true })
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as unknown as DbRow[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

export async function loadClassLearners(
  userId: string,
  assignmentId: string,
  sectionName: string,
  demo: boolean,
): Promise<ClassLearner[]> {
  if (demo || !supabase) return readDemoClassLearners(userId, assignmentId, sectionName)
  const { data, error } = await supabase.from('class_learners')
    .select('*').eq('user_id', userId).eq('assignment_id', assignmentId).eq('section_name', sectionName)
    .order('status', { ascending: true }).order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => mapClassLearner(row as unknown as DbRow))
}

export async function saveClassLearner(input: LearnerInput, userId: string, demo: boolean): Promise<ClassLearner> {
  if (demo || !supabase) return saveDemoClassLearner(input, userId)
  const { data, error } = await supabase.rpc('save_class_learner', {
    p_learner_id: input.id ?? null,
    p_assignment_id: input.assignmentId,
    p_section_name: input.sectionName,
    p_display_name: input.displayName,
    p_local_reference: input.localReference ?? null,
    p_status: input.status ?? 'active',
  })
  if (error) throw error
  return mapClassLearner(rowFromRpc(data))
}

/**
 * Confirmed roster imports are sent as one bounded replacement batch.  The
 * database RPC validates every row and derives ownership from auth.uid().
 */
export async function saveClassLearnersBulk(inputs: LearnerInput[], userId: string, demo: boolean): Promise<ClassLearner[]> {
  if (inputs.length === 0) return []
  const assignmentId = inputs[0].assignmentId
  const sectionName = inputs[0].sectionName
  if (inputs.some((input) => input.assignmentId !== assignmentId || input.sectionName !== sectionName)) {
    throw new Error('A bulk roster import must contain one assignment section.')
  }
  if (demo || !supabase) {
    return inputs.map((input) => saveDemoClassLearner(input, userId))
  }
  const rows = inputs.map((input) => ({
    id: input.id ?? null,
    displayName: input.displayName,
    localReference: input.localReference ?? null,
    status: input.status ?? 'active',
  }))
  const { data, error } = await supabase.rpc('save_class_learners_bulk', {
    p_assignment_id: assignmentId,
    p_section_name: sectionName,
    p_rows: rows,
  })
  if (error) throw error
  return (Array.isArray(data) ? data : data ? [data] : [])
    .map((row) => mapClassLearner(row as unknown as DbRow))
}

export async function removeClassLearner(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) return deleteDemoClassLearner(id, userId)
  const { error } = await supabase.rpc('delete_class_learner', { p_learner_id: id })
  if (error) throw error
}

export async function loadResultSessions(
  userId: string,
  demo: boolean,
  filters: { assignmentId?: string; sectionName?: string; includeArchived?: boolean } = {},
): Promise<ResultSessionListSummary[]> {
  if (demo || !supabase) return readDemoResultSessions(userId, filters.assignmentId, filters.sectionName)
    .filter((item) => filters.includeArchived || item.status !== 'archived')
    .map(localSessionListSummary)
  let query = supabase.from('result_sessions').select('*').eq('user_id', userId)
  if (filters.assignmentId) query = query.eq('assignment_id', filters.assignmentId)
  if (filters.sectionName) query = query.eq('section_name', filters.sectionName)
  if (!filters.includeArchived) query = query.neq('status', 'archived')
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw error
  const sessions = (data ?? []).map((row) => mapSessionRow(row as unknown as DbRow))
  const { data: summaryData, error: summaryError } = await supabase.rpc('list_result_session_summaries')
  if (summaryError) throw summaryError
  const summaries = new Map<string, DbRow>()
  for (const row of (summaryData ?? []) as unknown as DbRow[]) summaries.set(text(row.result_session_id), row)
  return sessions.map((session) => {
    const summary = summaries.get(session.id)
    return {
      ...session,
      learnerCount: number(summary?.learner_count),
      encodedLearnerCount: number(summary?.encoded_learner_count),
      responseCount: number(summary?.response_count),
    }
  })
}

export async function loadResultSession(id: string, userId: string, demo: boolean): Promise<AssessmentResultSession | null> {
  if (demo || !supabase) return readDemoResultSessions(userId).find((item) => item.id === id) ?? null
  const [sessionResult, participants, outcomes, scores] = await Promise.all([
    supabase.from('result_sessions').select('*').eq('id', id).eq('user_id', userId).maybeSingle(),
    loadResultRowsPaged('result_session_learners', id, userId, 'created_at'),
    loadResultRowsPaged('result_item_outcomes', id, userId, 'item_number'),
    loadResultRowsPaged('result_score_only_outcomes', id, userId, 'created_at'),
  ])
  if (sessionResult.error) throw sessionResult.error
  if (!sessionResult.data) return null
  return mapSessionRow(
    sessionResult.data as unknown as DbRow,
    participants,
    outcomes,
    scores,
  )
}

function emptyDemoSession(input: ResultSessionInput, userId: string, assessment: AssessmentRecord, learners: ClassLearner[]) {
  if (assessment.status !== 'final') throw new Error('Results require a finalized assessment.')
  if (assessment.assignmentId !== input.assignmentId) throw new Error('Results assessment and assignment must match.')
  const now = new Date().toISOString()
  const items: ResultAssessmentItemSnapshot[] = assessment.items.map((item) => ({
    id: item.id,
    itemNumber: item.itemNumber,
    prompt: item.prompt,
    questionType: item.questionType,
    answer: clone(item.answer),
    pointsPossible: Number(item.pointsPossible ?? item.points ?? 1),
    points: Number(item.pointsPossible ?? item.points ?? 1),
    competencySnapshot: clone(item.competencySnapshot),
    cognitiveCategorySnapshot: clone(item.cognitiveCategorySnapshot),
    mapping: clone(item.mapping),
  }))
  const assessmentSnapshot: ResultAssessmentSnapshot = {
    assessmentId: assessment.id,
    assessmentVersionNumber: assessment.versionNumber,
    assessmentTitle: assessment.title,
    assignmentId: input.assignmentId,
    gradeLevel: assessment.gradeLevel,
    learningArea: assessment.learningArea,
    schoolYear: assessment.schoolYear,
    gradingTermId: assessment.gradingTermId,
    gradingTermLabel: assessment.gradingTermLabel,
    curriculumPeriodIds: [...assessment.curriculumPeriodIds],
    curriculumPeriodLabels: [...assessment.curriculumPeriodLabels],
    totalItems: items.length,
    totalPossiblePoints: items.reduce((total, item) => total + itemPossiblePoints(item), 0),
    items,
  }
  const participantSnapshots: ResultLearnerSnapshot[] = learners.map((learner) => ({
    participantId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `participant-${Date.now()}-${Math.random()}`,
    learnerId: learner.id,
    displayName: learner.displayName,
    localReference: learner.localReference,
    learnerWasActive: learner.status === 'active',
  }))
  return {
    id: input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `result-${Date.now()}-${Math.random()}`),
    userId,
    assignmentId: input.assignmentId,
    sectionName: input.sectionName,
    assessmentId: assessment.id,
    administrationDate: input.administrationDate,
    title: input.title.trim(),
    entryMode: input.entryMode,
    status: 'draft' as const,
    assessmentSnapshot,
    learners: participantSnapshots,
    itemOutcomes: [],
    scoreOnlyOutcomes: [],
    shortAnswerScoring: { defaultMode: 'manual' as const, itemModes: {} },
    createdAt: now,
    updatedAt: now,
    versionNumber: 0,
  }
}

export async function createResultSession(
  input: ResultSessionInput,
  userId: string,
  demo: boolean,
  assessment?: AssessmentRecord,
): Promise<AssessmentResultSession> {
  if (demo || !supabase) {
    if (!assessment) throw new Error('Demo result creation requires the finalized assessment record.')
    const requested = new Set(input.learnerIds)
    if (requested.size !== input.learnerIds.length) throw new Error('Duplicate learners are not allowed.')
    const learners = readDemoClassLearners(userId, input.assignmentId, input.sectionName)
      .filter((learner) => requested.has(learner.id))
    if (learners.length !== requested.size || learners.some((learner) => learner.status !== 'active')) {
      throw new Error('Every selected demo learner must be active in the assignment section.')
    }
    const session = emptyDemoSession(input, userId, assessment, learners)
    return saveDemoResultSession({ session, outcomes: [], scoreOnlyOutcomes: [] }, userId, 'draft')
  }
  const { data, error } = await supabase.rpc('create_result_session', {
    p_assessment_document_id: input.assessmentId,
    p_assignment_id: input.assignmentId,
    p_section_name: input.sectionName,
    p_title: input.title,
    p_administration_date: input.administrationDate,
    p_entry_mode: input.entryMode,
    p_learner_ids: input.learnerIds,
    p_short_answer_scoring: { defaultMode: 'manual', itemModes: {} },
  })
  if (error) throw error
  const row = rowFromRpc(data)
  const saved = await loadResultSession(text(row.id), userId, false)
  if (!saved) throw new Error('Result session was created but could not be reloaded.')
  return saved
}

export async function saveResultSession(
  batch: ResultSaveBatch,
  userId: string,
  demo: boolean,
  status: 'draft' | 'final' = 'draft',
): Promise<AssessmentResultSession> {
  if (demo || !supabase) return saveDemoResultSession(batch, userId, status)
  const { data, error } = await supabase.rpc('save_result_session', {
    p_session_id: batch.session.id,
    p_title: batch.session.title,
    p_administration_date: batch.session.administrationDate,
    p_entry_mode: batch.session.entryMode,
    p_short_answer_scoring: batch.session.shortAnswerScoring,
    p_item_outcomes: batch.outcomes,
    p_score_only_outcomes: batch.scoreOnlyOutcomes,
    p_expected_version: batch.session.versionNumber,
    p_status: status,
  })
  if (error) throw error
  const row = rowFromRpc(data)
  const saved = await loadResultSession(text(row.id || batch.session.id), userId, false)
  if (!saved) throw new Error('Result session was saved but could not be reloaded.')
  return saved
}

export async function archiveResultSession(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) return archiveDemoResultSession(id, userId)
  const { data, error } = await supabase.rpc('archive_result_session', { p_session_id: id })
  if (error) throw error
  return mapSessionRow(rowFromRpc(data))
}

export async function deleteDraftResultSession(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) return deleteDemoDraftResultSession(id, userId)
  const { error } = await supabase.rpc('delete_draft_result_session', { p_session_id: id })
  if (error) throw error
}

/** Explicitly opt in to labelled demo data; normal demo setup never seeds it. */
export function createAndStoreDemoResultsSample(
  assessment: AssessmentRecord,
  userId: string,
  assignmentId: string,
  sectionName: string,
) {
  const sample = createDemoResultsSample(assessment, userId, assignmentId, sectionName)
  sample.learners.forEach((learner) => saveDemoClassLearner({
    id: learner.id,
    assignmentId: learner.assignmentId,
    sectionName: learner.sectionName,
    displayName: learner.displayName,
    localReference: learner.localReference,
    status: learner.status,
  }, userId))
  return saveDemoResultSession({ session: sample.session, outcomes: sample.session.itemOutcomes, scoreOnlyOutcomes: [] }, userId, 'draft')
}
